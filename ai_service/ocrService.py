import easyocr
import cv2
import numpy as np

class OCRProcessor:
    def __init__(self):
        print("Loading EasyOCR model...")
        # We use CPU by default for stability across environments
        self.reader = easyocr.Reader(['en'], gpu=False)

    def extract_text(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return []

        results = self.reader.readtext(img)
        texts = []
        for (bbox, text, prob) in results:
            if prob > 0.4:
                texts.append(text)
        return texts
