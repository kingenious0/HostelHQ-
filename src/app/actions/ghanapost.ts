"use server";

export interface GhanaPostLocationResult {
  lat: number;
  lng: number;
  area: string;
  district: string;
  region: string;
  street: string;
  postCode: string;
  digitalAddress: string;
  formattedAddress: string;
}

export interface GhanaPostResponse {
  success: boolean;
  data?: GhanaPostLocationResult;
  error?: string;
}

/**
 * Server Action to look up a GhanaPostGPS digital address code (e.g. "AK-238-1489").
 * Reverse-engineered SperixLabs REST endpoint with fallback and sanitization.
 */
export async function lookupGhanaPostGPSAction(rawAddress: string): Promise<GhanaPostResponse> {
  if (!rawAddress || !rawAddress.trim()) {
    return {
      success: false,
      error: "Please enter a valid GhanaPostGPS digital address (e.g. AK-238-1489).",
    };
  }

  const cleanAddress = rawAddress.trim().toUpperCase();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch("https://ghanapostgps.sperixlabs.org/get-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: cleanAddress }),
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Address service responded with status ${response.status}. Please verify the code or set location manually.`,
      };
    }

    const json = await response.json();

    if (!json.found || !json.data?.Table || json.data.Table.length === 0) {
      return {
        success: false,
        error: "We couldn't find that address — check the code, or set your location manually below.",
      };
    }

    const table = json.data.Table[0];
    const lat = Number(table.CenterLatitude);
    const lng = Number(table.CenterLongitude);

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return {
        success: false,
        error: "Invalid coordinates returned for this address code. Please set location manually.",
      };
    }

    const area = (table.Area || "").trim();
    const district = (table.District || "").trim();
    const region = (table.Region || "").trim();
    let street = (table.Street || "").trim();
    if (street.toUpperCase() === "[UNKNOWN]") {
      street = "";
    }
    const postCode = (table.PostCode || "").trim();
    const digitalAddress = (table.GPSName || cleanAddress).trim();

    // Construct human-friendly formatted address with fallbacks
    const addressParts = [street, area, district, region, "Ghana"].filter(Boolean);
    const formattedAddress = addressParts.join(", ") || `${cleanAddress}, Ghana`;

    return {
      success: true,
      data: {
        lat,
        lng,
        area,
        district,
        region,
        street,
        postCode,
        digitalAddress,
        formattedAddress,
      },
    };
  } catch (err: any) {
    console.error("lookupGhanaPostGPSAction error:", err);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: "Address lookup request timed out. Please check your connection or set location manually.",
      };
    }
    return {
      success: false,
      error: "We couldn't reach the address service. Please check the code, or set your location manually below.",
    };
  }
}
