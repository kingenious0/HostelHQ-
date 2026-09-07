import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGoogleMapsNavigationUrl(hostel: {
  lat?: number;
  lng?: number;
  name: string;
  location: string;
}): string {
  const latNum = Number(hostel.lat);
  const lngNum = Number(hostel.lng);

  if (!isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}&travelmode=walking`;
  }

  const fallbackQuery = encodeURIComponent(`${hostel.name}, ${hostel.location}, Ghana`);
  return `https://www.google.com/maps/dir/?api=1&destination=${fallbackQuery}&travelmode=walking`;
}
