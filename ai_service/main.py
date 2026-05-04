import asyncio
import contextlib
import os
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List
import uvicorn
import cv2
import numpy as np
from deepface import DeepFace

app = FastAPI(title="Face AI Microservice (DeepFace)")

# Workers = 2 to avoid CPU thread thrashing. TensorFlow already uses multiple 
# internal threads per image, so too many parallel workers makes it SLOWER on CPU.
_executor = ThreadPoolExecutor(max_workers=2)


# ─── Model warm-up ────────────────────────────────────────────────────────────
@app.on_event("startup")
def load_model():
    print("Loading DeepFace Models... This may take a minute on first run to download.")
    try:
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        DeepFace.represent(
            dummy_img,
            model_name='Facenet512',
            detector_backend='mtcnn',
            enforce_detection=False
        )
        print(f"DeepFace Loaded Successfully! (Facenet512 + MTCNN) — {_executor._max_workers} parallel workers ready")
    except Exception as e:
        print("Model initialization error:", e)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "running",
        "engine": "DeepFace (Facenet512 / MTCNN)",
        "parallel_workers": _executor._max_workers,
    }


# ─── Core extraction logic (runs in thread pool) ──────────────────────────────
def _extract_faces_sync(img_bytes: bytes) -> dict:
    """
    CPU-bound face extraction — runs inside a thread-pool worker so multiple
    images can be processed truly in parallel without blocking the event loop.
    """
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "Invalid image file format.", "faces": []}

    last_error = None
    original_h, original_w = img.shape[:2]
    image_area = float(original_h * original_w)

    # Guard rails against tiny false positives (e.g. leaves/background patterns).
    min_face_px = max(15, int(float(os.getenv("FACE_MIN_BOX_PX", "18"))))
    min_face_area_ratio = float(os.getenv("FACE_MIN_AREA_RATIO", "0.0005"))
    min_face_area_px = float(os.getenv("FACE_MIN_AREA_PX", "600"))

    def _passes_face_quality(face_area: dict) -> bool:
        w = int(face_area.get("w", 0))
        h = int(face_area.get("h", 0))
        if w < min_face_px or h < min_face_px:
            return False
        area = float(w * h)
        if area < min_face_area_px:
            return False
        if image_area > 0:
            ratio = area / image_area
            if ratio < min_face_area_ratio:
                return False
            # Prevent hallucinated faces that take up the entire image (allow up to 98% for close-ups)
            if ratio > 0.98:
                return False
            # Reject faces with very abnormal aspect ratios (not a real face)
            aspect = max(w, h) / max(1, min(w, h))
            if aspect > 3.0:
                return False
        return True

    def run_scan(source_img: np.ndarray, max_dim: int):
        nonlocal last_error
        local_img = source_img
        h, w = local_img.shape[:2]
        scale = 1.0
        if h > max_dim or w > max_dim:
            scale = max_dim / max(h, w)
            local_img = cv2.resize(local_img, (int(w * scale), int(h * scale)))

        try:
            results = DeepFace.represent(
                img_path=local_img,
                model_name='Facenet512',
                detector_backend='retinaface',
                enforce_detection=True
            )

            if isinstance(results, dict):
                results = [results]

            # RetinaFace confidence threshold — 0.50 catches almost everything without false positives
            detection_threshold = 0.50
            faces = []
            for face in results:
                conf = face.get('face_confidence', 0.99)
                if conf < detection_threshold:
                    continue

                area = face['facial_area']
                if not _passes_face_quality(area):
                    continue

                # Scale bounding box coordinates back to original image size
                if scale != 1.0:
                    box = {
                        "_x": int(area['x'] / scale),
                        "_y": int(area['y'] / scale),
                        "_width": int(area['w'] / scale),
                        "_height": int(area['h'] / scale)
                    }
                else:
                    box = {
                        "_x": area['x'],
                        "_y": area['y'],
                        "_width": area['w'],
                        "_height": area['h']
                    }

                faces.append({
                    "box": box,
                    "confidence": conf,
                    "descriptor": face['embedding']
                })

            return {"faces": faces, "backend": "mtcnn"}
        except ValueError as e:
            last_error = e
            return {"faces": []}
        except Exception as e:
            last_error = e
            return {"faces": []}

    # ── Multi-pass scanning strategy ──────────────────────────────────────────
    # Pass 1: Standard scan at 1200px (good for most photos including groups)
    first_pass = run_scan(img, max_dim=1200)
    first_count = len(first_pass.get("faces", []))

    # Pass 2: For large/high-res images, try at higher resolution if we found 
    # fewer faces than expected (group photos with small faces)
    if max(original_h, original_w) > 1600:
        # If we found very few faces in a large image, the faces might be too small
        second_pass = run_scan(img, max_dim=1800)
        second_count = len(second_pass.get("faces", []))
        if second_count > first_count:
            first_pass = second_pass
            first_count = second_count

    # Pass 3: For very large images where we STILL have few faces, try full resolution
    if first_count <= 2 and max(original_h, original_w) > 2000:
        full_pass = run_scan(img, max_dim=2400)
        full_count = len(full_pass.get("faces", []))
        if full_count > first_count:
            first_pass = full_pass

    if first_pass.get("faces"):
        return first_pass

    if last_error:
        print("Face extraction fallback exhausted:", last_error)
    return {"faces": []}


# ─── Single image endpoint (original, kept for backwards compatibility) ────────
@app.post("/extract_faces")
async def extract_faces(file: UploadFile = File(...)):
    contents = await file.read()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _extract_faces_sync, contents)
    if "error" in result and result["error"] != "Invalid image file format.":
        return result
    if "error" in result:
        return JSONResponse(status_code=400, content=result)
    return result


# ─── BATCH endpoint — process multiple images in TRUE PARALLEL ────────────────
@app.post("/extract_faces_batch")
async def extract_faces_batch(files: List[UploadFile] = File(...)):
    """
    Process up to 10 images simultaneously.
    Returns a list of results in the SAME ORDER as the uploaded files.
    Each result: { "filename": str, "faces": [...] }
    """
    loop = asyncio.get_event_loop()

    # Read all file contents concurrently (I/O, not CPU — fine in async)
    contents_list = await asyncio.gather(*[f.read() for f in files])

    # Submit all to thread pool — TRUE parallel CPU execution
    futures = [
        loop.run_in_executor(_executor, _extract_faces_sync, contents)
        for contents in contents_list
    ]
    results = await asyncio.gather(*futures)

    return [
        {
            "filename": files[i].filename,
            "faces": results[i].get("faces", []),
            "backend": results[i].get("backend", None),
        }
        for i in range(len(files))
    ]


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
