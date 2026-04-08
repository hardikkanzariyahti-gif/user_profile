const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'models');

let isLoaded = false;

async function loadModels() {
  if (isLoaded) return;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    isLoaded = true;
    console.log('AI Models loaded successfully 🧠');
  } catch (err) {
    console.error('Error loading AI models:', err);
  }
}

async function getFaceDescriptor(imagePath) {
  await loadModels();
  try {
    const img = await canvas.loadImage(imagePath);
    const detections = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detections) return null;
    return detections.descriptor;
  } catch (err) {
    console.error('Error processing image:', err);
    return null;
  }
}

async function identifyFace(targetImagePath, knownUsers) {
  const targetDescriptor = await getFaceDescriptor(targetImagePath);
  if (!targetDescriptor) return null;

  const faceMatcher = new faceapi.FaceMatcher(knownUsers);
  const bestMatch = faceMatcher.findBestMatch(targetDescriptor);

  if (bestMatch.label === 'unknown') return null;
  return bestMatch;
}

module.exports = { getFaceDescriptor, identifyFace, loadModels };
