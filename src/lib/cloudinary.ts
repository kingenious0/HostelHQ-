
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
