import cv2
import numpy as np
import time
from ultralytics import YOLO

class ObjectDetector:
    def __init__(self):
        print("Loading YOLOv8s model for accurate real-life object detection...")
        self.model = YOLO('yolov8s.pt')

    def detect(self, img_bytes):
        start_time = time.time()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return []

        # Stricter confidence threshold (0.45) for precise visible object identification (Requirement 1)
        results = self.model(img, imgsz=1024, conf=0.45)
        objects = []

        synonym_map = {
            "cell phone": "phone",
            "tv": "monitor/screen",
            "couch": "couch/sofa",
            "dining table": "table",
            "backpack": "backpack/bag",
            "handbag": "backpack/bag",
            "suitcase": "backpack/bag"
        }

        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                raw_name = self.model.names[cls_id]
                xyxy = box.xyxy[0].tolist()

                # Safeguard: 'watch' detections have a notorious false-positive rate (spectacles/cuffs confusion)
                # Elevate barrier to 0.80 to completely eradicate hallucinations (Requirement 4)
                if raw_name == "watch" and conf < 0.80:
                    continue

                # Standardized Name Mapping (Requirement 1)
                mapped_name = synonym_map.get(raw_name, raw_name)

                # Construct structured object format containing label, confidence, and bounding box (Requirement 1)
                objects.append({
                    "name": mapped_name,
                    "label": mapped_name,
                    "confidence": round(conf, 3),
                    "bbox": [round(coord, 1) for coord in xyxy]
                })

        # Deduplicate tags by keeping highest confidence match (Requirement 3)
        unique_objects = {}
        for obj in objects:
            name = obj["name"]
            if name not in unique_objects or obj["confidence"] > unique_objects[name]["confidence"]:
                unique_objects[name] = obj

        final_objects = list(unique_objects.values())
        
        processing_time = round((time.time() - start_time) * 1000, 2)
        
        print("================================================================")
        print("📦 AI OBJECT DETECTION ENGINE LOG")
        print("================================================================")
        print(f"• Model used: YOLOv8s (Analytical Strict Mode)")
        print(f"• Processing time: {processing_time} ms")
        print(f"• Confidence Threshold: >= 0.45")
        print(f"• Final High-Confidence Detections: {final_objects}")
        print("================================================================")

        return final_objects
