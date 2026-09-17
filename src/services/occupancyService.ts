import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { isDynamoConfigured, scanEntities } from "@/lib/dynamodb";

export interface HostelOccupancyDetail {
  id: string;
  name: string;
  location: string;
  status: string;
  totalBeds: number;
  activeStudentsHoused: number;
  availableBeds: number;
  occupancyRate: number;
  institution?: string;
  roomTypes?: any[];
}

export interface LiveOccupancyMetrics {
  totalRegisteredBeds: number;
  totalOccupiedBeds: number;
  overallOccupancyRate: number;
  hostelDetails: HostelOccupancyDetail[];
}

export interface LiveExecutiveMetrics {
  totalHostels: number;
  accreditedCount: number;
  pendingCount: number;
  totalVerifiedBeds: number;
  activeOccupiedBeds: number;
  complianceRate: number;
  sanctionedPropertiesCount: number;
  complianceList: HostelOccupancyDetail[];
}

/**
 * Calculates bed capacity for a hostel document, checking totalBeds first,
 * then summing room types if explicit totalBeds is missing or 0.
 */
function calculateHostelTotalBeds(data: any): number {
  if (data.totalBeds && Number(data.totalBeds) > 0) {
    return Number(data.totalBeds);
  }
  if (Array.isArray(data.roomTypes) && data.roomTypes.length > 0) {
    let sum = 0;
    for (const rt of data.roomTypes) {
      const cap = Number(rt.capacity || 1);
      const rooms = Number(
        rt.numberOfRooms ||
          (Array.isArray(rt.roomNumbers) ? rt.roomNumbers.length : 1)
      );
      sum += cap * rooms;
    }
    if (sum > 0) return sum;
  }
  return Number(data.bedsCount || data.beds || 0);
}

/**
 * Live Occupancy Data Service:
 * Aggregates student room bookings and active allocations live from Firestore and DynamoDB.
 */
export async function fetchLiveHostelOccupancyMetrics(): Promise<LiveOccupancyMetrics> {
  let hostelsList: any[] = [];
  let bookingsList: any[] = [];

  // 1. Fetch all registered hostels from Firestore
  try {
    const hostelsSnapshot = await getDocs(collection(db, "hostels"));
    hostelsList = hostelsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (fsErr) {
    console.warn("Firestore hostels query notice:", fsErr);
  }

  // Fallback / merge with DynamoDB if available and Firestore was empty
  if (hostelsList.length === 0 && isDynamoConfigured()) {
    try {
      const dynHostels = await scanEntities<any>("HOSTEL");
      hostelsList = dynHostels.map((h) => ({
        id: (h.id || "").replace(/^HOSTEL#/i, ""),
        ...h,
      }));
    } catch (dynErr) {
      console.warn("DynamoDB hostels scan notice:", dynErr);
    }
  }

  // 2. Fetch all active/confirmed bookings in bulk to prevent N+1 query latency
  const activeBookingsCountByHostel: Record<string, number> = {};

  try {
    const bookingsSnapshot = await getDocs(collection(db, "bookings"));
    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toLowerCase();
      // Only count active/confirmed/approved bookings
      if (
        status === "confirmed" ||
        status === "approved" ||
        status === "active" ||
        status === "paid" ||
        status === "completed"
      ) {
        const rawHostelId = data.hostelId || data.hostel_id || "";
        const cleanId = rawHostelId.replace(/^HOSTEL#/i, "").trim();
        if (cleanId) {
          activeBookingsCountByHostel[cleanId] =
            (activeBookingsCountByHostel[cleanId] || 0) + 1;
        }
      }
    });
  } catch (bErr) {
    console.warn("Firestore bookings query notice:", bErr);
  }

  // Also merge DynamoDB bookings if configured
  if (isDynamoConfigured()) {
    try {
      const dynBookings = await scanEntities<any>("BOOKING");
      dynBookings.forEach((b) => {
        const status = (b.status || "").toLowerCase();
        if (
          status === "confirmed" ||
          status === "approved" ||
          status === "active" ||
          status === "paid"
        ) {
          const rawHostelId = b.hostelId || b.hostel_id || "";
          const cleanId = rawHostelId.replace(/^HOSTEL#/i, "").trim();
          if (cleanId && !activeBookingsCountByHostel[cleanId]) {
            activeBookingsCountByHostel[cleanId] =
              (activeBookingsCountByHostel[cleanId] || 0) + 1;
          }
        }
      });
    } catch (_) {}
  }

  let totalRegisteredBeds = 0;
  let totalOccupiedBeds = 0;
  const hostelDetails: HostelOccupancyDetail[] = [];

  for (const hostel of hostelsList) {
    const hostelId = (hostel.id || "").replace(/^HOSTEL#/i, "").trim();
    const capacity = calculateHostelTotalBeds(hostel);

    // Active student count from live confirmed bookings (with fallback to recorded occupiedBeds)
    const bookingCount = activeBookingsCountByHostel[hostelId] ?? 0;
    const activeStudentCount =
      bookingCount > 0
        ? bookingCount
        : Number(hostel.occupiedBeds || hostel.activeStudentsHoused || 0);

    totalRegisteredBeds += capacity;
    totalOccupiedBeds += activeStudentCount;

    const occupancyRate =
      capacity > 0 ? Math.round((activeStudentCount / capacity) * 100) : 0;
    const availableBeds = Math.max(0, capacity - activeStudentCount);

    hostelDetails.push({
      id: hostelId,
      name: hostel.name || "Unnamed Hostel",
      location: hostel.location || "Kumasi",
      status: hostel.status || "accredited",
      totalBeds: capacity,
      activeStudentsHoused: activeStudentCount,
      availableBeds,
      occupancyRate,
      institution: hostel.institution || "AAMUSTED",
      roomTypes: hostel.roomTypes || [],
    });
  }

  const overallOccupancyRate =
    totalRegisteredBeds > 0
      ? Math.round((totalOccupiedBeds / totalRegisteredBeds) * 100)
      : 0;

  return {
    totalRegisteredBeds,
    totalOccupiedBeds,
    overallOccupancyRate,
    hostelDetails,
  };
}

/**
 * Live Executive Metrics Service:
 * Aggregates portfolio metrics, verified bed counts, and compliance matrices
 * dynamically for executive briefing reports (Dean, Pro-VC, and VC).
 */
export async function fetchLiveExecutiveMetrics(): Promise<LiveExecutiveMetrics> {
  const occupancyData = await fetchLiveHostelOccupancyMetrics();
  const hostels = occupancyData.hostelDetails;

  const totalHostels = hostels.length;
  let accreditedCount = 0;
  let pendingCount = 0;
  let sanctionedCount = 0;

  hostels.forEach((h) => {
    const st = (h.status || "").toLowerCase();
    if (
      st === "accredited" ||
      st === "approved" ||
      st === "live" ||
      st === "active"
    ) {
      accreditedCount++;
    } else if (
      st === "pending" ||
      st === "pending_review" ||
      st === "pending_accreditation"
    ) {
      pendingCount++;
    } else if (
      st === "sanctioned" ||
      st === "suspended" ||
      st === "suspended_overpriced" ||
      st === "revoked"
    ) {
      sanctionedCount++;
    }
  });

  const complianceRate =
    totalHostels > 0 ? Math.round((accreditedCount / totalHostels) * 100) : 0;

  return {
    totalHostels,
    accreditedCount,
    pendingCount,
    totalVerifiedBeds: occupancyData.totalRegisteredBeds,
    activeOccupiedBeds: occupancyData.totalOccupiedBeds,
    complianceRate,
    sanctionedPropertiesCount: sanctionedCount,
    complianceList: hostels,
  };
}
