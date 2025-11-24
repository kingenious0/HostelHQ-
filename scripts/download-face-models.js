const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'models');

const MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

// Create models directory if it doesn't exist
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log('✅ Created models directory');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('📥 Downloading face-api.js models...\n');
  
  for (const model of MODELS) {
    const url = `${MODEL_BASE_URL}/${model}`;
    const dest = path.join(PUBLIC_DIR, model);
    
    // Skip if already exists
    if (fs.existsSync(dest)) {
      console.log(`⏭️  Skipped: ${model} (already exists)`);
      continue;
    }
    
    try {
      console.log(`⬇️  Downloading: ${model}...`);
      await downloadFile(url, dest);
      console.log(`✅ Downloaded: ${model}`);
    } catch (error) {
      console.error(`❌ Failed to download ${model}:`, error.message);
    }
  }
  
  console.log('\n🎉 All models downloaded successfully!');
}

downloadModels().catch(console.error);
