#!/bin/bash
cd /home/hashtech/user_profile/backend/models

wget -q https://raw.githubusercontent.com/vladmandic/face-api/master/model/ssd_mobilenetv1_model-weights_manifest.json
wget -q https://raw.githubusercontent.com/vladmandic/face-api/master/model/ssd_mobilenetv1_model-shard1
wget -q https://raw.githubusercontent.com/vladmandic/face-api/master/model/ssd_mobilenetv1_model-shard2

echo "Downloaded SSD Mobilenet v1"
ls -la
