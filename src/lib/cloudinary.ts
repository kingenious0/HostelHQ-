
export const CLOUD_NAME = 'dthdohxgs';
export const API_KEY    = '979481335337711';
export const API_SECRET = 'Mv-L9lHOeeQ7N2i8l4MizowQwKM';

// Browser upload (unsigned) – zero card
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', API_KEY);
  form.append('upload_preset', 'firebase_studio_preset'); // Use an unsigned upload preset
  form.append('folder', 'hostel-images');
  form.append('quality', 'auto:good');
  form.append('width', '800');
  form.append('crop', 'limit');
  form.append('fetch_format', 'auto'); // WebP when possible

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url; // https://res.cloudinary.com/ ...
}
