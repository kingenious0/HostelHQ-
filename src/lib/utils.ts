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

/**
 * Parses 8-digit student institutional index numbers from email addresses.
 * E.g., '20849312@st.knust.edu.gh' or 'stu-20849312@hostelhq.com' -> '20849312'
 */
export function parseStudentCredentials(email?: string | null): string | null {
  if (!email) return null;
  const match = email.match(/\b\d{8}\b/);
  return match ? match[0] : null;
}

