import contextlib
import os
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn
import cv2
import numpy as np
from deepface import DeepFace

app = FastAPI(title="Face AI Microservice (DeepFace)")

@app.on_event("startup")
def load_model():
    print("Loading DeepFace Models... This may take a minute on first run to download.")
    try:
        # Dummy call to initialize/download the models immediately
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        DeepFace.represent(dummy_img, model_name='Facenet512', detector_backend='retinaface', enforce_detection=False)
        print("DeepFace Loaded Successfully! (Facenet512 + RetinaFace)")
    except Exception as e:
        print("Model initialization error:", e)

@app.get("/")
def root():
    return {"status": "running", "engine": "DeepFace (Facenet512 / RetinaFace)"}

@app.post("/extract_faces")
async def extract_faces(file: UploadFile = File(...)):
    contents = await file.read()
    
    # Convert uploaded file bytes to OpenCV image
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image file format."})
    
    try:
        # Process image with DeepFace (RetinaFace for perfect detection, Facenet512 for perfect Apple/Google vectors)
        results = DeepFace.represent(
            img_path=img, 
            model_name='Facenet512', 
            detector_backend='retinaface', 
            enforce_detection=True
        )
        
        faces = []
        for face in results:
            area = face['facial_area']
            
            faces.append({
                "box": {
                    "_x": area['x'],
                    "_y": area['y'],
                    "_width": area['w'],
                    "_height": area['h']
                },
                "confidence": face.get('face_confidence', 0.99),
                "descriptor": face['embedding'] # 512-dimensional vector
            })
            
        return {"faces": faces}
    except ValueError:
        # Deepface throws ValueError if it strictly finds no faces
        return {"faces": []}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
