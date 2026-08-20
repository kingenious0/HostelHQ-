import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Load face-api.js models (only once)
 */
export async function loadFaceDetectionModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    const MODEL_URL = '/models'; // Models will be in public/models folder
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log('✅ Face detection models loaded successfully');
  } catch (error) {
    console.error('❌ Error loading face detection models:', error);
    throw new Error('Failed to load face detection models');
  }
}

/**
 * Detect face in image and extract face descriptor
 * @param imageElement - Image or video element
 * @returns Face descriptor array (128 numbers) or null if no face detected
 */
export async function detectFaceDescriptor(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  try {
    // Ensure models are loaded
    await loadFaceDetectionModels();

    // Detect single face with landmarks and descriptor
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn('⚠️ No face detected in image');
      return null;
    }

    return detection.descriptor;
  } catch (error) {
    console.error('❌ Error detecting face:', error);
    return null;
  }
}

/**
 * Convert base64 image to HTMLImageElement
 */
export async function base64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

/**
 * Extract face descriptor from base64 image
 */
export async function getFaceDescriptorFromBase64(
  base64Image: string
): Promise<Float32Array | null> {
  try {
    const img = await base64ToImage(base64Image);
    return await detectFaceDescriptor(img);
  } catch (error) {
    console.error('❌ Error extracting face descriptor:', error);
    return null;
  }
}

/**
 * Compare two face descriptors using Euclidean distance
 * @param descriptor1 - First face descriptor
 * @param descriptor2 - Second face descriptor
 * @returns Distance value (0 = identical, higher = more different)
 */
export function compareFaceDescriptors(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Check if two faces match based on threshold
 * @param descriptor1 - First face descriptor
 * @param descriptor2 - Second face descriptor
 * @param threshold - Maximum distance for a match (default: 0.6)
 * @returns Object with match status and distance
 */
export function areFacesMatching(
  descriptor1: Float32Array,
  descriptor2: Float32Array,
  threshold: number = 0.6
): { isMatch: boolean; distance: number; similarity: number } {
  const distance = compareFaceDescriptors(descriptor1, descriptor2);
  const isMatch = distance < threshold;
  
  // Convert distance to similarity percentage (0-100%)
  // Lower distance = higher similarity
  const similarity = Math.max(0, Math.min(100, (1 - distance) * 100));

  return {
    isMatch,
    distance,
    similarity: Math.round(similarity)
  };
}

/**
 * Verify face from base64 image against stored descriptor
 * @param capturedImageBase64 - Base64 image of captured face
 * @param storedDescriptor - Stored face descriptor array
 * @param threshold - Matching threshold (default: 0.6)
 */
export async function verifyFace(
  capturedImageBase64: string,
  storedDescriptor: number[],
  threshold: number = 0.6
): Promise<{
  success: boolean;
  isMatch: boolean;
  distance: number;
  similarity: number;
  error?: string;
}> {
  try {
    // Extract descriptor from captured image
    const capturedDescriptor = await getFaceDescriptorFromBase64(capturedImageBase64);

    if (!capturedDescriptor) {
      return {
        success: false,
        isMatch: false,
        distance: 1,
        similarity: 0,
        error: 'No face detected in captured image'
      };
    }

    // Convert stored descriptor array to Float32Array
    const storedDescriptorFloat = new Float32Array(storedDescriptor);

    // Compare faces
    const result = areFacesMatching(capturedDescriptor, storedDescriptorFloat, threshold);

    return {
      success: true,
      ...result
    };
  } catch (error: any) {
    console.error('❌ Face verification error:', error);
    return {
      success: false,
      isMatch: false,
      distance: 1,
      similarity: 0,
      error: error.message || 'Face verification failed'
    };
  }
}

/**
 * Convert Float32Array descriptor to regular array for storage
 */
export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}
