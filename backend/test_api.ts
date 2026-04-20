import fs from 'fs';
import path from 'path';

async function test() {
  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  if (files.length === 0) {
    console.log("No images to test.");
    return;
  }
  
  const imagePath = path.join(UPLOADS_DIR, files[0]);
  console.log("Testing with image:", imagePath);
  
  try {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, path.basename(imagePath));

    const res = await fetch('http://localhost:8000/extract_faces', {
      method: 'POST',
      body: formData
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 500));
  } catch (err: any) {
    console.error("Fetch error:", err.message);
  }
}

test();
