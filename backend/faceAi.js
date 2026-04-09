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
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
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
    // Use ssdMobilenetv1 for more accurate detection
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) return null;
    return detections[0].descriptor;
  } catch (err) {
    console.error('Error processing image:', err);
    return null;
  }
}

async function identifyFace(targetImagePath, knownUsers) {
  const targetDescriptor = await getFaceDescriptor(targetImagePath);
  if (!targetDescriptor) return null;

  // Set distance threshold to 0.60
  const faceMatcher = new faceapi.FaceMatcher(knownUsers, 0.60);
  const bestMatch = faceMatcher.findBestMatch(targetDescriptor);

  if (bestMatch.label === 'unknown') return null;
  return bestMatch;
}

async function identifyAllFaces(targetImagePath, knownUsers) {
  await loadModels();
  try {
    const img = await canvas.loadImage(targetImagePath);
    // Find all faces in the image using SSD Mobilenet v1
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) return [];

    const faceMatcher = new faceapi.FaceMatcher(knownUsers, 0.60);
    
    // Match each detected face against our known users
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
    return results;
  } catch (err) {
    console.error('Error identifying multiple faces:', err);
    return [];
  }
}

module.exports = { getFaceDescriptor, identifyFace, identifyAllFaces, loadModels };
