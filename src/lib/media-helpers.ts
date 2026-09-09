/**
 * Media Field Normalization & Binding Utilities
 * Standardizes property photo, gallery, and video accessors across
 * all table components, cards, review sheets, and audit modals.
 */

export function getHostelPhotos(hostel: any): string[] {
  if (!hostel) return ['/hero-student-housing.jpg'];

  // Priority search for property-level photo collections
  const candidates = [
    hostel.photos,
    hostel.images,
    hostel.galleryUrls,
    hostel.media?.photos,
  ];

  let rawPhotos: any[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      rawPhotos = candidate;
      break;
    }
  }

  // Filter for valid string URLs, removing falsy values or invalid objects
  let normalized = rawPhotos
    .map((p) => {
      if (typeof p === 'string') return p.trim();
      if (p && typeof p === 'object' && typeof p.url === 'string') return p.url.trim();
      return '';
    })
    .filter((url) => url.length > 0 && !url.includes('[object Object]'));

  // If no root-level photos found, check nested room types for images
  if (normalized.length === 0) {
    const roomSources = hostel.roomTypes || hostel.rooms || [];
    if (Array.isArray(roomSources)) {
      const roomPhotos = roomSources.flatMap((r: any) => {
        const rList = Array.isArray(r.images)
          ? r.images
          : Array.isArray(r.photos)
          ? r.photos
          : [];
        return rList;
      });

      normalized = roomPhotos
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((url) => url.length > 0 && !url.includes('[object Object]'));
    }
  }

  // Final fallback to system university student housing hero asset
  if (normalized.length === 0) {
    return ['/hero-student-housing.jpg'];
  }

  return Array.from(new Set(normalized));
}

export function getHostelVideos(hostel: any): string[] {
  if (!hostel) return [];

  const videoList: string[] = [];

  // 1. Check direct hostel-level video arrays/URLs
  if (Array.isArray(hostel.videos)) {
    videoList.push(...hostel.videos);
  } else if (typeof hostel.videos === 'string' && hostel.videos.trim()) {
    videoList.push(hostel.videos.trim());
  }

  if (typeof hostel.videoUrl === 'string' && hostel.videoUrl.trim()) {
    videoList.push(hostel.videoUrl.trim());
  }

  if (Array.isArray(hostel.media?.videos)) {
    videoList.push(...hostel.media.videos);
  }

  // 2. Check roomTypes / rooms walkthrough video arrays & URLs
  const rooms = hostel.roomTypes || hostel.rooms || [];
  if (Array.isArray(rooms)) {
    rooms.forEach((r: any) => {
      if (Array.isArray(r.videos)) {
        videoList.push(...r.videos);
      }
      if (typeof r.videoUrl === 'string' && r.videoUrl.trim()) {
        videoList.push(r.videoUrl.trim());
      }
      if (Array.isArray(r.media?.videos)) {
        videoList.push(...r.media.videos);
      }
    });
  }

  // Filter valid URLs and deduplicate
  const cleanVideos = videoList
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')));

  return Array.from(new Set(cleanVideos));
}

export function getCoverPhoto(hostel: any): string {
  const photos = getHostelPhotos(hostel);
  return photos[0] || '/hero-student-housing.jpg';
}
