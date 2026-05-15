#!/bin/bash
cd /home/hashtech/user_profile/backend/models

BASE_URL="https://raw.githubusercontent.com/vladmandic/face-api/master/model"

wget -q "$BASE_URL/tiny_face_detector_model-weights_manifest.json"
wget -q "$BASE_URL/tiny_face_detector_model.bin"
wget -q "$BASE_URL/face_landmark_68_tiny_model-weights_manifest.json"
wget -q "$BASE_URL/face_landmark_68_tiny_model.bin"
wget -q "$BASE_URL/face_recognition_model-weights_manifest.json"
wget -q "$BASE_URL/face_recognition_model.bin"

echo "Downloaded required face-api tiny detector + landmark + recognition models"
ls -la
