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

    # --- OPTIMIZATION: Internal Resizing (Fast Scan) ---
    # Downscaling large images before scanning reduces CPU math workload significantly.
    max_dim = 800
    h, w = img.shape[:2]
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    for backend in ("mtcnn", "opencv"):
        try:
            results = DeepFace.represent(
                img_path=img,
                model_name='Facenet512',
                detector_backend=backend,
                enforce_detection=True
            )

            if isinstance(results, dict):
                results = [results]

            # inclusive threshold for MTCNN, stricter for OpenCV fallback
            DETECTION_THRESHOLD = 0.85 if backend == "mtcnn" else 0.95
            faces = []
            for face in results:
                conf = face.get('face_confidence', 0.99)
                if conf < DETECTION_THRESHOLD:
                    continue
                    
                area = face['facial_area']
                faces.append({
                    "box": {
                        "_x": area['x'],
                        "_y": area['y'],
                        "_width": area['w'],
                        "_height": area['h']
                    },
                    "confidence": conf,
                    "descriptor": face['embedding']
                })

            if faces:
                return {"faces": faces, "backend": backend}
        except ValueError as e:
            last_error = e
            continue
        except Exception as e:
            last_error = e
            continue

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
