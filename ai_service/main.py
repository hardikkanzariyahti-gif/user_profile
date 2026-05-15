import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List
import uvicorn
import cv2
import numpy as np
from insightface.app import FaceAnalysis
from mtcnn import MTCNN
import warnings

from objectDetectionService import ObjectDetector
from ocrService import OCRProcessor
from sceneClassifier import SceneClassifier

# Suppress InsightFace/Scikit-Image FutureWarnings
warnings.filterwarnings("ignore", category=FutureWarning, module="insightface")

app = FastAPI(title="Face AI Microservice (InsightFace)")

# Workers = 2 to avoid CPU thread thrashing. 
_executor = ThreadPoolExecutor(max_workers=2)

# Global FaceAnalysis instance and state
face_app = None
mtcnn_detector = None
object_detector = None
ocr_processor = None
scene_classifier = None
current_det_size = (640, 640)

@app.on_event("startup")
def load_model():
    global face_app
    print("Loading InsightFace Model (Buffalo_L)...")
    # Buffalo_L is the high-accuracy model (ResNet100 + RetinaFace)
    # providers: use CPU for reliability in most environments, or CUDA if available
    providers = ['CPUExecutionProvider']
    face_app = FaceAnalysis(name='buffalo_l', providers=providers)
    
    # Set a fixed ultra-high detection resolution (1280x1280) to find small faces in group photos with higher sensitivity (det_thresh=0.35)
    face_app.prepare(ctx_id=0, det_size=(1280, 1280), det_thresh=0.35)
    
    global mtcnn_detector
    print("Loading MTCNN as fallback...")
    mtcnn_detector = MTCNN()

    global object_detector, ocr_processor, scene_classifier
    try:
        object_detector = ObjectDetector()
        ocr_processor = OCRProcessor()
        scene_classifier = SceneClassifier()
    except Exception as e:
        print(f"Error loading metadata models: {e}")
    
    print(f"AI Models Loaded! — 1280x1280 InsightFace + MTCNN Fallback ready + Metadata Models ready")

@app.get("/")
def root():
    return {
        "status": "running",
        "engine": "InsightFace (Buffalo_L)",
        "parallel_workers": _executor._max_workers,
    }

def _extract_faces_sync(img_bytes: bytes) -> dict:
    if face_app is None:
        return {"error": "Model not loaded.", "faces": []}
        
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "Invalid image file format.", "faces": []}

    h, w = img.shape[:2]

    # Pre-processing: Apply CLAHE to improve contrast for better detection
    try:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl,a,b))
        enhanced_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    except:
        enhanced_img = img

    # Multi-Pass Detection: Try different resolutions and enhancements to find small/snow faces
    faces = []
    # Pass 1: Try on original image (1280) - highly recommended for bright snow/outdoor scenes
    faces = face_app.get(img)

    # Pass 2: Try CLAHE enhanced image (1280) - great for shadow/indoor scenes
    if not faces:
        faces = face_app.get(enhanced_img)
    
    # Pass 3: Try smaller resolution (640)
    if not faces:
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        faces = face_app.get(img) or face_app.get(enhanced_img)
        face_app.prepare(ctx_id=0, det_size=(1280, 1280))

    # Pass 3: MTCNN Fallback (Stronger for low-res webcam/mobile quality)
    if not faces and mtcnn_detector:
        # print("[AI] No faces found with InsightFace, trying MTCNN fallback...")
        rgb_img = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2RGB)
        mt_results = mtcnn_detector.detect_faces(rgb_img)
        
        for res in mt_results:
            if res['confidence'] < 0.8: continue
            
            x, y, w, h = res['box']
            # Crop with generous margin to help InsightFace align
            margin_w, margin_h = int(w * 0.3), int(h * 0.3)
            x1_c, y1_c = max(0, x - margin_w), max(0, y - margin_h)
            x2_c, y2_c = min(img.shape[1], x + w + margin_w), min(img.shape[0], y + h + margin_h)
            face_crop = enhanced_img[y1_c:y2_c, x1_c:x2_c]
            
            if face_crop.size == 0: continue
            
            # Re-run InsightFace on this focused crop
            crop_faces = face_app.get(face_crop)
            if crop_faces:
                for cf in crop_faces:
                    # Translate coordinates back to original image
                    cf.bbox[0] += x1_c
                    cf.bbox[1] += y1_c
                    cf.bbox[2] += x1_c
                    cf.bbox[3] += y1_c
                    faces.append(cf)
                    break # Usually only one face in the crop
            else:
                # Last resort: use the MTCNN box if we really need it, but without descriptor
                # (This won't help for recognition, but will prevent the "No face" error)
                pass

    # Laplacian variance for blur detection
    def get_blur_score(face_img):
        if face_img is None or face_img.size == 0:
            return 0
        gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var()

    results = []
    for face in faces:
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = max(0, int(bbox[0])), max(0, int(bbox[1])), min(w, int(bbox[2])), min(h, int(bbox[3]))
        
        width = x2 - x1
        height = y2 - y1

        # Reduce noise filter to 10x10 for better sensitivity in large group photos
        if (width < 10 or height < 10):
            continue

        face_roi = img[y1:y2, x1:x2]
        blur_score = get_blur_score(face_roi)
        
        # Relaxed thresholds for standard validation
        is_clear = bool(blur_score > 1.2) # Relaxed from 1.5
        is_confident = bool(face.det_score > 0.12) # Relaxed from 0.15
        
        pose = face.pose.tolist() if hasattr(face, 'pose') else [0, 0, 0]

        # Expand bounding box by 30% for a better crop containing full forehead, ears, and chin
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        w_new = int(width * 1.30)
        h_new = int(height * 1.30)
        ex1 = max(0, cx - w_new // 2)
        ey1 = max(0, cy - h_new // 2)
        ex2 = min(w, cx + w_new // 2)
        ey2 = min(h, cy + h_new // 2)

        landmarks = face.kps.tolist() if hasattr(face, 'kps') and face.kps is not None else []

        print(f"[Face Analysis] Box: {width}x{height}, ExpandedBox: {ex2-ex1}x{ey2-ey1}, Conf: {face.det_score:.4f}, Blur: {blur_score:.2f}")

        results.append({
            "box": {"_x": x1, "_y": y1, "_width": width, "_height": height},
            "expandedBox": {"_x": ex1, "_y": ey1, "_width": ex2 - ex1, "_height": ey2 - ey1},
            "faceCropSize": {"width": width, "height": height},
            "landmarks": landmarks,
            "confidence": float(face.det_score),
            "blur_score": float(blur_score),
            "pose": pose,
            "quality": {
                "is_valid": is_clear and is_confident,
                "reason": "Clear" if (is_clear and is_confident) else ("Too blurry" if not is_clear else "Face not clear")
            },
            "descriptor": face.normed_embedding.tolist()
        })

    # Meta Analysis
    person_count = len(results)
    
    # Dominant Color extraction (simple center-crop average)
    try:
        center_h, center_w = h // 2, w // 2
        crop = img[max(0, center_h-50):min(h, center_h+50), max(0, center_w-50):min(w, center_w+50)]
        avg_color_bgr = np.mean(crop, axis=(0, 1))
        dominant_color = "#{:02x}{:02x}{:02x}".format(int(avg_color_bgr[2]), int(avg_color_bgr[1]), int(avg_color_bgr[0]))
    except:
        dominant_color = "#888888"

    print(f"[Image Analysis] Resized size: {w}x{meta_h if 'meta_h' in locals() else h}, Detected faces: {person_count}")

    return {
        "faces": results, 
        "backend": "insightface",
        "metadata": {
            "person_count": person_count,
            "dominant_color": dominant_color,
            "aspect_ratio": round(w / h, 2),
            "orientation": "landscape" if w > h else "portrait"
        }
    }

@app.post("/extract_faces")
async def extract_faces(file: UploadFile = File(...)):
    contents = await file.read()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _extract_faces_sync, contents)
    return result

def _extract_metadata_sync(img_bytes: bytes) -> dict:
    objects = object_detector.detect(img_bytes) if object_detector else []
    texts = ocr_processor.extract_text(img_bytes) if ocr_processor else []
    scenes = scene_classifier.classify(img_bytes) if scene_classifier else []
    return {
        "objects": objects,
        "ocrText": texts,
        "scenes": scenes
    }

@app.post("/extract_metadata")
async def extract_metadata(file: UploadFile = File(...)):
    contents = await file.read()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _extract_metadata_sync, contents)
    return result

@app.post("/extract_faces_batch")
async def extract_faces_batch(files: List[UploadFile] = File(...)):
    loop = asyncio.get_event_loop()
    contents_list = await asyncio.gather(*[f.read() for f in files])
    
    futures = [
        loop.run_in_executor(_executor, _extract_faces_sync, contents)
        for contents in contents_list
    ]
    results = await asyncio.gather(*futures)

    return [
        {
            "filename": files[i].filename,
            "faces": results[i].get("faces", []),
            "backend": "insightface",
        }
        for i in range(len(files))
    ]

@app.post("/check_frame")
async def check_frame(file: UploadFile = File(...), angle: str = "front"):
    """Lite check for live suggestions. Returns only quality/location info, no descriptors."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"status": "error", "message": "Invalid frame"}
    
    h, w = img.shape[:2]

    # Pre-processing: Apply CLAHE to improve contrast
    try:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl,a,b))
        enhanced_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    except:
        enhanced_img = img

    faces = face_app.get(enhanced_img)

    if not faces and mtcnn_detector:
        # Fallback for live guidance too
        rgb_img = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2RGB)
        mt_results = mtcnn_detector.detect_faces(rgb_img)
        if mt_results:
            res = max(mt_results, key=lambda x: x['box'][2] * x['box'][3])
            x, y, w_box, h_box = res['box']
            # Fake face object for compatibility
            class FakeFace:
                def __init__(self, bbox, score):
                    self.bbox = np.array([bbox[0], bbox[1], bbox[0]+bbox[2], bbox[1]+bbox[3]])
                    self.det_score = score
            faces = [FakeFace([x, y, w_box, h_box], res['confidence'])]

    if not faces:
        return {"status": "no_face", "message": "No face detected"}

    # Use the largest face
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    bbox = face.bbox.astype(int)
    
    # Calculate centerness
    face_center_x = (bbox[0] + bbox[2]) / 2
    img_center_x = w / 2
    off_center = abs(face_center_x - img_center_x) / w

    # Calculate blur
    face_roi = img[max(0, bbox[1]):min(h, bbox[3]), max(0, bbox[0]):min(w, bbox[2])]
    if face_roi is None or face_roi.size == 0:
        return {"status": "error", "message": "Invalid face crop"}
    gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

    # Pose detection for automatic enrollment
    # pose is [pitch, yaw, roll]
    pose = face.pose.tolist() if hasattr(face, 'pose') else [0, 0, 0]
    pitch, yaw, roll = pose

    status = "ok"
    msg = "Perfect! Ready to capture"
    
    # Relaxed thresholds for "simple validation"
    if blur_score < 1.8:
        status = "blurry"
        msg = "Image is blurry, hold still..."
    elif off_center > 0.45:
        status = "not_centered"
        msg = "Center your face."
    elif (bbox[2]-bbox[0]) < w * 0.1:
        status = "too_far"
        msg = "Move closer."
    elif face.det_score < 0.2:
        status = "low_conf"
        msg = "Face not clear."
    else:
        # Multi-angle Pose validation (pitch, yaw, roll)
        # Yaw: looking left is positive (> 15), looking right is negative (< -15)
        if angle == "front":
            if abs(yaw) > 18:
                status = "wrong_angle"
                msg = "Look straight at the camera."
            elif abs(pitch) > 18:
                status = "wrong_angle"
                msg = "Look straight at the camera."
        elif angle == "left":
            if yaw < 12:
                status = "wrong_angle"
                msg = "Turn your head to the LEFT."
        elif angle == "right":
            if yaw > -12:
                status = "wrong_angle"
                msg = "Turn your head to the RIGHT."

    return {
        "status": status,
        "message": msg,
        "face_present": True,
        "score": float(face.det_score),
        "blur": float(blur_score),
        "pose": {
            "pitch": float(pitch),
            "yaw": float(yaw),
            "roll": float(roll)
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
