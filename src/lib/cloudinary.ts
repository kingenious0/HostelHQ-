
export const CLOUD_NAME = 'dthdohxgs';
export const API_KEY    = '979481335337711';
export const API_SECRET = 'Mv-L9lHOeeQ7N2i8l4MizowQwKM';

// Browser upload (unsigned) – zero card
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', API_KEY);
  // Using an upload_preset is the standard, but since it's causing issues,
  // we can rely on the API key settings for an unsigned upload as a fallback.
  // This requires the default upload preset for your API key to be unsigned.
  form.append('upload_preset', 'firebase_studio_preset');
  form.append('folder', 'hostel-images');
  form.append('quality', 'auto:good');
  form.append('width', '800');
  form.append('crop', 'limit');
  form.append('fetch_format', 'auto'); // WebP when possible

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    // Provide more detailed error information
    const errorBody = await res.text();
    console.error("Cloudinary upload failed:", errorBody);
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  
  const data = await res.json();
  return data.secure_url; // https://res.cloudinary.com/ ...
}

// Browser video upload (unsigned) with auto-compression
export async function uploadVideo(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', API_KEY);
  form.append('upload_preset', 'firebase_studio_preset');
  form.append('folder', 'hostel-videos');
  form.append('resource_type', 'video');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Cloudinary video upload failed:", errorBody);
    throw new Error(`Video upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.secure_url;
}
// Client-side canvas image compression to eliminate upload lag
export async function compressImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> {
  // If not in browser or not an image (e.g., PDF), return untouched
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio downscale if exceeding bounds
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Prefer WebP or JPEG for fast compressed payloads
        const outputType = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression didn't reduce size, resolve original
              return resolve(file);
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

// Upload verification document (Student ID or Admission Letter) with 15-second timeout & progress
export async function uploadVerificationDocument(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File exceeds the 5MB size limit. Please choose a smaller document.');
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Invalid format. Only JPEG, PNG, WebP images and PDF documents are supported.');
  }

  onProgress?.('Compressing document...');
  let fileToUpload = file;
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImageFile(file, 1600, 1200, 0.75);
    } catch (compressErr) {
      console.warn('Canvas compression fallback to original file:', compressErr);
    }
  }

  onProgress?.('Uploading document...');

  const form = new FormData();
  form.append('file', fileToUpload);
  form.append('api_key', API_KEY);
  form.append('upload_preset', 'firebase_studio_preset');
  form.append('folder', 'student-verifications');

  const isPdf = fileToUpload.type === 'application/pdf' || fileToUpload.name.toLowerCase().endsWith('.pdf');
  const endpoint = isPdf
    ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`
    : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  // 15-second abort controller to prevent infinite hangs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('Document upload failed:', errorBody);
      throw new Error(`Upload failed (${res.statusText}). Please check your connection and try again.`);
    }

    const data = await res.json();
    onProgress?.('Upload completed');
    return data.secure_url;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Upload timed out after 15 seconds. Please ensure you have a stable internet connection.');
    }
    throw err;
  }
}
