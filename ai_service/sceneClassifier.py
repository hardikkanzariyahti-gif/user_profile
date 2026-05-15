from transformers import pipeline
import io
from PIL import Image

class SceneClassifier:
    def __init__(self):
        print("Loading Zero-Shot CLIP Image Classifier (Analytical Hierarchy Mode)...")
        # Use openai/clip-vit-base-patch32: lightweight, extremely powerful zero-shot vision model
        self.classifier = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32")
        
    def classify(self, img_bytes):
        try:
            image = Image.open(io.BytesIO(img_bytes))
            
            # ── STAGE 1: MUTUALLY EXCLUSIVE ENVIRONMENT CLASSIFICATION ────────────────
            # Forces CLIP to normalize scores summing to 1.0 across top-level contexts.
            # Resolves high-risk environment conflicts perfectly.
            env_candidates = ["an indoor room", "an outdoor natural landscape", "a city street"]
            env_res = self.classifier(image, candidate_labels=env_candidates, multi_label=False)
            
            best_env = env_res[0]['label']
            best_score = float(env_res[0]['score'])
            
            is_indoor = False
            primary_env = "unknown"
            
            if best_env == "an indoor room" and best_score >= 0.50:
                is_indoor = True
                primary_env = "indoor"
            elif (best_env == "an outdoor natural landscape" or best_env == "a city street") and best_score >= 0.65:
                # Strict confidence barrier (0.65) for outdoor/nature to eliminate false tagging
                primary_env = "outdoor/nature"
            
            # ── STAGE 2: MULTI-LABEL ATTRIBUTE GATEWAY ────────────────────────────────
            # Discover independent attributes like glasses, portrait orientation, and workspaces.
            attr_candidates = [
                "glasses", "spectacles", "portrait photo", "group photo", "office workspace",
                "nature forest trees", "mountain scenery", "lake beach ocean"
            ]
            attr_res = self.classifier(image, candidate_labels=attr_candidates, multi_label=True)
            
            scenes = []
            
            # Map attributes to standardized, clean canonical tags
            label_mapping = {
                "spectacles": "glasses",
                "office workspace": "office/workspace",
                "nature forest trees": "outdoor/nature",
                "mountain scenery": "outdoor/nature",
                "lake beach ocean": "outdoor/nature",
                "portrait photo": "portrait"
            }
            
            # Explicitly append base environment classification if resolved
            if primary_env != "unknown":
                scenes.append({
                    "label": primary_env,
                    "confidence": round(best_score, 3)
                })
            
            for r in attr_res:
                label = r['label']
                score = float(r['score'])
                
                # Rigorous baseline threshold: 0.60
                threshold = 0.60
                
                # DYNAMIC FAILSAFE: If Stage 1 positively identified INDOORS, 
                # secondary outdoor attributes must clear a near-perfect barrier (0.85) to register.
                if is_indoor and label in ["nature forest trees", "mountain scenery", "lake beach ocean"]:
                    threshold = 0.85
                
                if score >= threshold:
                    mapped = label_mapping.get(label, label)
                    scenes.append({
                        "label": mapped,
                        "confidence": round(score, 3)
                    })
            
            # Deduplicate and retain max-confidence ratings
            unique_scenes = {}
            for s in scenes:
                lab = s["label"]
                if lab not in unique_scenes or s["confidence"] > unique_scenes[lab]["confidence"]:
                    unique_scenes[lab] = s
            
            final_list = sorted(list(unique_scenes.values()), key=lambda x: x['confidence'], reverse=True)
            
            # FALLBACK REQUIREMENT: If uncertain, assign environment label explicitly to 'unknown'
            has_valid_env = any(s["label"] in ["indoor", "outdoor/nature"] for s in final_list)
            if not has_valid_env:
                # Ensure uncertain assets safely resolve to 'unknown' scene type
                final_list.append({
                    "label": "unknown",
                    "confidence": 0.50
                })
            
            print("================================================================")
            print("👁️  CLIP HIERARCHICAL SCENE CLASSIFICATION LOG")
            print("================================================================")
            print(f"• Primary Environment: {primary_env} (score={round(best_score, 3)})")
            print(f"• Final Scene Contexts: {final_list}")
            print("================================================================")
            
            return final_list
            
        except Exception as e:
            print(f"Error classifying scene: {e}")
            return [{"label": "unknown", "confidence": 0.0}]
