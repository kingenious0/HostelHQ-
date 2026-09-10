"use client";

import * as React from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cleanHostelId } from "@/lib/dynamodb-service";

export interface DatabaseRoomUnit {
  id: string;
  hostelId: string;
  roomNumber: string;
  tierId: string;        // e.g., "3-in-a-room" or roomType ID
  tierCapacity: number;  // e.g., 3
  beds: Array<{
    id: string;
    isOccupied: boolean;
    studentId?: string | null;
  }>;
  status?: string;
  [key: string]: any;
}

/**
 * 1. Direct Database Hydration Layer
 * Queries Firestore subcollection `hostels/{hostelId}/rooms` (or nested `rooms` array) matching tierId/roomTypeId.
 * Returns [] if no records exist in the database (no fake fallbacks).
 */
export async function fetchLiveRoomsByTier(
  hostelId: string,
  tierId: string,
  confirmedBookings?: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string; studentId?: string }>
): Promise<DatabaseRoomUnit[]> {
  const cleanId = cleanHostelId(hostelId);
  if (!cleanId || !tierId) return [];

  try {
    const roomsRef = collection(db, "hostels", cleanId, "rooms");

    // 1. First attempt query by tierId
    let q = query(roomsRef, where("tierId", "==", tierId));
    let snapshot = await getDocs(q);

    // 2. Fallback query by roomTypeId
    if (snapshot.empty) {
      q = query(roomsRef, where("roomTypeId", "==", tierId));
      snapshot = await getDocs(q);
    }

    // 3. Fallback: fetch all rooms from subcollection and match in-memory
    let matchedDocs = snapshot.docs;
    if (snapshot.empty) {
      const allSnap = await getDocs(roomsRef);
      matchedDocs = allSnap.docs.filter((d: any) => {
        const data = d.data();
        const dTier = String(data.tierId || data.roomTypeId || data.roomType || data.type || "").trim().toLowerCase();
        const target = String(tierId).trim().toLowerCase();
        return dTier === target || (data.roomTypeId && String(data.roomTypeId) === String(tierId));
      });
    }

    // 4. Fallback: If subcollection has no matching rooms, check parent document's nested `rooms` array
    if (matchedDocs.length === 0) {
      const hostelDocSnap = await getDoc(doc(db, "hostels", cleanId));
      if (hostelDocSnap.exists()) {
        const hData = hostelDocSnap.data();
        if (Array.isArray(hData.rooms) && hData.rooms.length > 0) {
          const target = String(tierId).trim().toLowerCase();
          const filtered = hData.rooms.filter((r: any) => {
            const dTier = String(r.tierId || r.roomTypeId || r.roomType || r.type || "").trim().toLowerCase();
            return dTier === target || (r.roomTypeId && String(r.roomTypeId) === String(tierId));
          });

          if (filtered.length > 0) {
            return filtered.map((r: any, index: number) => {
              const capacity = Number(r.tierCapacity || r.capacity) || 1;
              const roomNum = r.roomNumber || r.number || r.name || `Room ${index + 1}`;
              const roomId = r.id || `${cleanId}-nested-${index + 1}`;

              let beds = Array.isArray(r.beds) && r.beds.length > 0 ? r.beds : null;

              if (!beds) {
                const bookingsForRoom = (confirmedBookings || []).filter(
                  (b) => b.roomId === roomId || b.roomNumber === roomNum
                );
                const occupiedCount = Math.min(
                  capacity,
                  bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(r.currentOccupancy || r.occupancy || 0)
                );

                beds = Array.from({ length: capacity }, (_, i) => ({
                  id: `${roomId}-bed-${i + 1}`,
                  isOccupied: i < occupiedCount,
                  studentId: bookingsForRoom[i]?.studentId || null,
                }));
              }

              return {
                id: roomId,
                hostelId: cleanId,
                roomNumber: roomNum,
                tierId: r.tierId || r.roomTypeId || tierId,
                tierCapacity: capacity,
                beds,
                status: r.status || "active",
                ...r,
              } as DatabaseRoomUnit;
            });
          }
        }
      }

      // No registered DB units exist: return empty array rather than fake hardcoded fallbacks
      return [];
    }

    return matchedDocs.map((docSnap: any, index: number) => {
      const data = docSnap.data();
      const capacity = Number(data.tierCapacity || data.capacity) || 1;
      const roomNum = data.roomNumber || data.number || data.name || `Room ${index + 1}`;

      // Calculate bed occupancy from room's beds array or confirmed bookings
      let beds = Array.isArray(data.beds) && data.beds.length > 0 ? data.beds : null;

      if (!beds) {
        // Synthesize beds based on confirmed bookings or currentOccupancy
        const bookingsForRoom = (confirmedBookings || []).filter(
          (b) => b.roomId === docSnap.id || b.roomNumber === roomNum
        );
        const occupiedCount = Math.min(
          capacity,
          bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(data.currentOccupancy || data.occupancy || 0)
        );

        beds = Array.from({ length: capacity }, (_, i) => ({
          id: `${docSnap.id}-bed-${i + 1}`,
          isOccupied: i < occupiedCount,
          studentId: bookingsForRoom[i]?.studentId || null,
        }));
      }

      return {
        id: docSnap.id,
        hostelId: cleanId,
        roomNumber: roomNum,
        tierId: data.tierId || data.roomTypeId || tierId,
        tierCapacity: capacity,
        beds,
        status: data.status || "active",
        ...data,
      } as DatabaseRoomUnit;
    });
  } catch (error) {
    console.error("Error fetching live rooms by tier:", error);
    return [];
  }
}

/**
 * Convenience aggregator to query all rooms for a hostel once and index by tierId/roomTypeId.
 * Queries Firestore subcollection `hostels/{hostelId}/rooms` and falls back to nested `rooms` array.
 */
export async function fetchAllLiveRooms(
  hostelId: string,
  confirmedBookings?: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string; studentId?: string }>
): Promise<Record<string, DatabaseRoomUnit[]>> {
  const cleanId = cleanHostelId(hostelId);
  if (!cleanId) return {};

  try {
    const roomsRef = collection(db, "hostels", cleanId, "rooms");
    const snapshot = await getDocs(roomsRef);
    const grouped: Record<string, DatabaseRoomUnit[]> = {};

    if (!snapshot.empty) {
      snapshot.docs.forEach((docSnap: any, index: number) => {
        const data = docSnap.data();
        const capacity = Number(data.tierCapacity || data.capacity) || 1;
        const roomNum = data.roomNumber || data.number || data.name || `Room ${index + 1}`;
        const tierKey = data.tierId || data.roomTypeId || data.roomType || "default";

        let beds = Array.isArray(data.beds) && data.beds.length > 0 ? data.beds : null;

        if (!beds) {
          const bookingsForRoom = (confirmedBookings || []).filter(
            (b) => b.roomId === docSnap.id || b.roomNumber === roomNum
          );
          const occupiedCount = Math.min(
            capacity,
            bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(data.currentOccupancy || data.occupancy || 0)
          );

          beds = Array.from({ length: capacity }, (_, i) => ({
            id: `${docSnap.id}-bed-${i + 1}`,
            isOccupied: i < occupiedCount,
            studentId: bookingsForRoom[i]?.studentId || null,
          }));
        }

        const unit: DatabaseRoomUnit = {
          id: docSnap.id,
          hostelId: cleanId,
          roomNumber: roomNum,
          tierId: tierKey,
          tierCapacity: capacity,
          beds,
          status: data.status || "active",
          ...data,
        };

        if (!grouped[tierKey]) {
          grouped[tierKey] = [];
        }
        grouped[tierKey].push(unit);

        if (data.roomTypeId && data.roomTypeId !== tierKey) {
          if (!grouped[data.roomTypeId]) grouped[data.roomTypeId] = [];
          grouped[data.roomTypeId].push(unit);
        }
        if (data.tierId && data.tierId !== tierKey) {
          if (!grouped[data.tierId]) grouped[data.tierId] = [];
          grouped[data.tierId].push(unit);
        }
      });

      return grouped;
    }

    // Fallback: Check parent document's nested `rooms` array
    const hostelDocSnap = await getDoc(doc(db, "hostels", cleanId));
    if (hostelDocSnap.exists()) {
      const hData = hostelDocSnap.data();
      if (Array.isArray(hData.rooms) && hData.rooms.length > 0) {
        hData.rooms.forEach((r: any, index: number) => {
          const capacity = Number(r.tierCapacity || r.capacity) || 1;
          const roomNum = r.roomNumber || r.number || r.name || `Room ${index + 1}`;
          const roomId = r.id || `${cleanId}-nested-${index + 1}`;
          const tierKey = r.tierId || r.roomTypeId || r.roomType || r.type || "default";

          let beds = Array.isArray(r.beds) && r.beds.length > 0 ? r.beds : null;

          if (!beds) {
            const bookingsForRoom = (confirmedBookings || []).filter(
              (b) => b.roomId === roomId || b.roomNumber === roomNum
            );
            const occupiedCount = Math.min(
              capacity,
              bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(r.currentOccupancy || r.occupancy || 0)
            );

            beds = Array.from({ length: capacity }, (_, i) => ({
              id: `${roomId}-bed-${i + 1}`,
              isOccupied: i < occupiedCount,
              studentId: bookingsForRoom[i]?.studentId || null,
            }));
          }

          const unit: DatabaseRoomUnit = {
            id: roomId,
            hostelId: cleanId,
            roomNumber: roomNum,
            tierId: tierKey,
            tierCapacity: capacity,
            beds,
            status: r.status || "active",
            ...r,
          };

          if (!grouped[tierKey]) grouped[tierKey] = [];
          grouped[tierKey].push(unit);

          if (r.roomTypeId && r.roomTypeId !== tierKey) {
            if (!grouped[r.roomTypeId]) grouped[r.roomTypeId] = [];
            grouped[r.roomTypeId].push(unit);
          }
          if (r.tierId && r.tierId !== tierKey) {
            if (!grouped[r.tierId]) grouped[r.tierId] = [];
            grouped[r.tierId].push(unit);
          }
        });
      }
    }

    return grouped;
  } catch (error) {
    console.error("Error fetching all live rooms:", error);
    return {};
  }
}

/**
 * 2. Normalize Tier Query & Matching Keys
 * Eliminates false-negative filters caused by discrepancies between tierId, tierSlug, tierName, and numerical capacity.
 */
export function getRoomsForTier(allRooms: any[], tier: any): DatabaseRoomUnit[] {
  if (!Array.isArray(allRooms) || !tier) return [];

  const tierIdStr = String(tier.id || '').trim().toLowerCase();
  const tierSlugStr = String(tier.slug || tier.id || '').trim().toLowerCase();
  const tierNameStr = String(tier.name || tier.typeName || '').trim().toLowerCase();
  const tierCap = Number(tier.capacity || tier.tierCapacity) || 0;

  return allRooms.filter((room) => {
    if (!room) return false;

    const roomTierIdStr = String(room.tierId || room.roomTypeId || '').trim().toLowerCase();
    const roomTierSlugStr = String(room.tierSlug || '').trim().toLowerCase();
    const roomTierNameStr = String(room.tierName || room.roomType || room.type || '').trim().toLowerCase();
    const roomCap = Number(room.capacity || room.tierCapacity) || 0;

    const tierMatch =
      (roomTierIdStr && (roomTierIdStr === tierIdStr || roomTierIdStr === tierSlugStr)) ||
      (roomTierSlugStr && (roomTierSlugStr === tierSlugStr || roomTierSlugStr === tierIdStr)) ||
      (roomTierNameStr && tierNameStr && roomTierNameStr === tierNameStr) ||
      (roomTierIdStr && tierNameStr && roomTierIdStr.replace(/[^a-z0-9]/g, '') === tierNameStr.replace(/[^a-z0-9]/g, '')) ||
      (roomCap > 0 && tierCap > 0 && roomCap === tierCap);

    return Boolean(tierMatch);
  });
}

/**
 * Returns a flat list of all physical room units for a hostel.
 */
export async function fetchAllLiveRoomsList(
  hostelId: string,
  confirmedBookings?: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string; studentId?: string }>
): Promise<DatabaseRoomUnit[]> {
  const cleanId = cleanHostelId(hostelId);
  if (!cleanId) return [];

  try {
    const roomsRef = collection(db, "hostels", cleanId, "rooms");
    const snapshot = await getDocs(roomsRef);
    const result: DatabaseRoomUnit[] = [];

    if (!snapshot.empty) {
      snapshot.docs.forEach((docSnap: any, index: number) => {
        const data = docSnap.data();
        const capacity = Number(data.tierCapacity || data.capacity) || 1;
        const roomNum = data.roomNumber || data.number || data.name || `Room ${index + 1}`;
        const tierKey = data.tierId || data.roomTypeId || data.roomType || "default";

        let beds = Array.isArray(data.beds) && data.beds.length === capacity ? data.beds : null;

        if (!beds) {
          const bookingsForRoom = (confirmedBookings || []).filter(
            (b) => b.roomId === docSnap.id || b.roomNumber === roomNum
          );
          const occupiedCount = Math.min(
            capacity,
            bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(data.currentOccupancy || data.occupancy || 0)
          );

          beds = Array.from({ length: capacity }, (_, i) => ({
            id: `${docSnap.id}-bed-${i + 1}`,
            isOccupied: i < occupiedCount,
            studentId: bookingsForRoom[i]?.studentId || null,
          }));
        }

        result.push({
          id: docSnap.id,
          hostelId: cleanId,
          roomNumber: roomNum,
          tierId: tierKey,
          tierCapacity: capacity,
          capacity,
          beds,
          status: data.status || "active",
          ...data,
        } as DatabaseRoomUnit);
      });

      return result;
    }

    // Fallback: parent hostel document nested `rooms` array
    const hostelDocSnap = await getDoc(doc(db, "hostels", cleanId));
    if (hostelDocSnap.exists()) {
      const hData = hostelDocSnap.data();
      if (Array.isArray(hData.rooms) && hData.rooms.length > 0) {
        hData.rooms.forEach((r: any, index: number) => {
          const capacity = Number(r.tierCapacity || r.capacity) || 1;
          const roomNum = r.roomNumber || r.number || r.name || `Room ${index + 1}`;
          const roomId = r.id || `${cleanId}-nested-${index + 1}`;
          const tierKey = r.tierId || r.roomTypeId || r.roomType || r.type || "default";

          let beds = Array.isArray(r.beds) && r.beds.length === capacity ? r.beds : null;

          if (!beds) {
            const bookingsForRoom = (confirmedBookings || []).filter(
              (b) => b.roomId === roomId || b.roomNumber === roomNum
            );
            const occupiedCount = Math.min(
              capacity,
              bookingsForRoom.length > 0 ? bookingsForRoom.length : Number(r.currentOccupancy || r.occupancy || 0)
            );

            beds = Array.from({ length: capacity }, (_, i) => ({
              id: `${roomId}-bed-${i + 1}`,
              isOccupied: i < occupiedCount,
              studentId: bookingsForRoom[i]?.studentId || null,
            }));
          }

          result.push({
            id: roomId,
            hostelId: cleanId,
            roomNumber: roomNum,
            tierId: tierKey,
            tierCapacity: capacity,
            capacity,
            beds,
            status: r.status || "active",
            ...r,
          } as DatabaseRoomUnit);
        });
        return result;
      }
    }

    return [];
  } catch (error) {
    console.error("Error fetching live rooms list:", error);
    return [];
  }
}

/**
 * Dynamic Real-Time Aggregator
 * Calculates metrics on the fly using runtime DB units.
 */
export function computeTierAvailability(rooms: DatabaseRoomUnit[], expectedCapacity: number) {
  const totalRoomsCount = rooms.length;

  // Total capacity dynamically summed from real DB units
  const totalBeds = rooms.reduce(
    (acc, room) => acc + (room.beds?.length || room.tierCapacity || expectedCapacity),
    0
  );

  // Vacant beds calculated directly from actual occupancy flags
  const openBeds = rooms.reduce((acc, room) => {
    if (room.beds && room.beds.length > 0) {
      return acc + room.beds.filter((b) => !b.isOccupied).length;
    }
    return acc + (room.tierCapacity || expectedCapacity);
  }, 0);

  const fullyOpenRooms = rooms.filter((r) =>
    r.beds ? r.beds.every((b) => !b.isOccupied) : true
  ).length;

  return {
    totalRoomsCount,
    totalBeds,
    openBeds,
    fullyOpenRooms,
    occupiedBeds: totalBeds - openBeds,
  };
}

/**
 * 3. Reusable Presentation Component (<LiveVacancyMeter />)
 * Single source of truth display component shared across Hostel Details and Room Modal.
 */
interface LiveVacancyMeterProps {
  rooms: DatabaseRoomUnit[];
  tierCapacity: number;
  interactive?: boolean;
  selectedRoomNumber?: string;
  onSelectRoom?: (room: DatabaseRoomUnit) => void;
}

export function LiveVacancyMeter({
  rooms,
  tierCapacity,
  interactive = false,
  selectedRoomNumber,
  onSelectRoom,
}: LiveVacancyMeterProps) {
  const { totalRoomsCount, totalBeds, openBeds, fullyOpenRooms } = computeTierAvailability(
    rooms,
    tierCapacity
  );

  // Display "No registered rooms currently open for this tier" only if tierRooms.length === 0 or openBeds === 0.
  if (rooms.length === 0 || openBeds === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
        No registered rooms currently open for this tier.
      </div>
    );
  }

  const isSoldOut = openBeds === 0;

  return (
    <div className="space-y-3 p-4 rounded-2xl border bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-sm font-medium">
        <span className="text-foreground">
          {openBeds} of {totalBeds} total beds open across {totalRoomsCount} rooms
        </span>
        <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 font-semibold shrink-0">
          ✓ All {fullyOpenRooms} Rooms Open
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{ width: `${totalBeds > 0 ? ((totalBeds - openBeds) / totalBeds) * 100 : 0}%` }}
        />
      </div>

      {/* Room-by-Room Dynamic Bed Indicators */}
      <div className="space-y-2 pt-1">
        {rooms.map((room) => {
          const bedList = room.beds?.length
            ? room.beds
            : Array.from({ length: tierCapacity }, (_, i) => ({ id: `temp-${i}`, isOccupied: false }));

          const roomOpenBeds = bedList.filter((b) => !b.isOccupied).length;
          const isRoomFull = roomOpenBeds === 0;
          const isSelected = selectedRoomNumber === room.roomNumber;

          return (
            <div
              key={room.id}
              onClick={() => interactive && !isRoomFull && onSelectRoom?.(room)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                isSelected
                  ? "bg-primary/5 border-primary ring-2 ring-primary/30"
                  : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60"
              } ${interactive && !isRoomFull ? "cursor-pointer hover:border-primary/50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {room.roomNumber}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isRoomFull ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isRoomFull ? "Full • 0 beds open" : `${roomOpenBeds} beds open`}
                </span>
              </div>

              {/* Dynamic Bed Indicator Dots: strictly renders tierCapacity count */}
              <div className="flex items-center gap-1.5">
                {bedList.map((bed, idx) => (
                  <span
                    key={bed.id || idx}
                    className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                      bed.isOccupied
                        ? "bg-slate-300 border-slate-400 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                        : "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    ✓
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
