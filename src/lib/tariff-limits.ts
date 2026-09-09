/**
 * Campus Statutory Rent Cap Configurations & Utilities
 * Controls baseline rental tariffs for KNUST/AAMUSTED student accommodation zoning.
 */

export interface TariffLimits {
  oneInRoom: number;   // e.g. 9000
  twoInRoom: number;   // e.g. 6500
  threeInRoom: number; // e.g. 4500
  fourInRoom: number;  // e.g. 3500
  updatedAt: string;
  updatedBy: string;   // Coordinator / Dean User ID
}

export const DEFAULT_TARIFF_LIMITS: TariffLimits = {
  oneInRoom: 9000,
  twoInRoom: 6500,
  threeInRoom: 4500,
  fourInRoom: 3500,
  updatedAt: "2026-01-01T00:00:00.000Z",
  updatedBy: "University Housing Board",
};

export const STATUTORY_TARIFF_CEILINGS: Record<string, { label: string; maxPrice: number }> = {
  "1-in-a-room": { label: "1 in a Room (Single)", maxPrice: 9000 },
  "2-in-a-room": { label: "2 in a Room", maxPrice: 6500 },
  "3-in-a-room": { label: "3 in a Room", maxPrice: 4500 },
  "4-in-a-room": { label: "4 in a Room", maxPrice: 3500 },
};

/**
 * Returns the statutory ceiling for a given room configuration based on current dynamic limits.
 */
export function getStatutoryTariffCeiling(
  roomTypeName: string = "",
  capacity?: number,
  limits: TariffLimits = DEFAULT_TARIFF_LIMITS
): { label: string; maxPrice: number } {
  const norm = (roomTypeName || "").toLowerCase();

  if (norm.includes("1") || norm.includes("single") || norm.includes("one") || capacity === 1) {
    return { label: "1 in a Room (Single)", maxPrice: limits.oneInRoom };
  }
  if (norm.includes("2") || norm.includes("two") || norm.includes("double") || capacity === 2) {
    return { label: "2 in a Room", maxPrice: limits.twoInRoom };
  }
  if (norm.includes("3") || norm.includes("three") || norm.includes("triple") || capacity === 3) {
    return { label: "3 in a Room", maxPrice: limits.threeInRoom };
  }
  if (norm.includes("4") || norm.includes("four") || norm.includes("quad") || capacity === 4) {
    return { label: "4 in a Room", maxPrice: limits.fourInRoom };
  }

  // Default fallback to 4 in a room ceiling
  return { label: "Standard Room", maxPrice: limits.fourInRoom };
}

/**
 * Helper to fetch tariff limits from Firestore with fallback to defaults.
 */
export async function fetchTariffLimits(): Promise<TariffLimits> {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");
    const snap = await getDoc(doc(db, "settings", "tariff_limits"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        oneInRoom: Number(data.oneInRoom) || DEFAULT_TARIFF_LIMITS.oneInRoom,
        twoInRoom: Number(data.twoInRoom) || DEFAULT_TARIFF_LIMITS.twoInRoom,
        threeInRoom: Number(data.threeInRoom) || DEFAULT_TARIFF_LIMITS.threeInRoom,
        fourInRoom: Number(data.fourInRoom) || DEFAULT_TARIFF_LIMITS.fourInRoom,
        updatedAt: data.updatedAt || new Date().toISOString(),
        updatedBy: data.updatedBy || "Authorized Staff",
      };
    }
  } catch (err) {
    console.warn("[TariffLimits] Could not fetch tariff limits from Firestore, using defaults:", err);
  }
  return DEFAULT_TARIFF_LIMITS;
}
