import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Bed, PhysicalRoomWithBeds } from "./booking-mutation";

export interface RepairResult {
  totalHostels: number;
  repairedHostels: number;
  totalRoomsRepaired: number;
  details: Array<{
    hostelId: string;
    hostelName: string;
    roomsCount: number;
    bedsCount: number;
  }>;
  errors: Array<{ hostelId: string; error: string }>;
}

function normalizeSlug(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Self-healing Retroactive Database Repair Utility
 * Standardizes all physical rooms to adhere to the single-source-of-truth schema:
 * - rooms[].beds: Bed[] where beds.length === capacity
 * - tierId, tierSlug, and tierName properly linked to roomTypes
 * - Synthesizes physical rooms if hostel only has roomTypes without registered rooms
 * - Synchronizes both hostel document `rooms` array and `rooms/{roomId}` subcollection
 */
export async function repairAllHostelInventories(): Promise<RepairResult> {
  const result: RepairResult = {
    totalHostels: 0,
    repairedHostels: 0,
    totalRoomsRepaired: 0,
    details: [],
    errors: [],
  };

  try {
    const hostelsSnapshot = await getDocs(collection(db, "hostels"));
    result.totalHostels = hostelsSnapshot.size;

    for (const hostelDoc of hostelsSnapshot.docs) {
      const hostelId = hostelDoc.id;
      const data = hostelDoc.data() || {};
      const hostelName = data.name || "Unnamed Hostel";

      try {
        const roomTypes: any[] = Array.isArray(data.roomTypes) ? data.roomTypes : [];
        const existingDocRooms: any[] = Array.isArray(data.rooms) ? data.rooms : [];

        // Also fetch any subcollection rooms in hostels/{hostelId}/rooms
        const subRoomsSnap = await getDocs(collection(db, "hostels", hostelId, "rooms"));
        const subRooms: any[] = subRoomsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

        // Merge existing rooms from document and subcollection by id or roomNumber
        const mergedRoomsMap = new Map<string, any>();
        existingDocRooms.forEach((r, idx) => {
          const key = r.id || r.roomNumber || `doc-room-${idx}`;
          mergedRoomsMap.set(key, { ...r, id: r.id || key });
        });
        subRooms.forEach((r, idx) => {
          const key = r.id || r.roomNumber || `sub-room-${idx}`;
          if (mergedRoomsMap.has(key)) {
            mergedRoomsMap.set(key, { ...mergedRoomsMap.get(key), ...r });
          } else {
            mergedRoomsMap.set(key, { ...r, id: r.id || key });
          }
        });

        let allRooms: any[] = Array.from(mergedRoomsMap.values());

        // If no physical rooms exist at all, synthesize them from roomTypes
        if (allRooms.length === 0 && roomTypes.length > 0) {
          roomTypes.forEach((rt, rtIdx) => {
            const numRooms = Number(rt.numberOfRooms) || (Array.isArray(rt.roomNumbers) ? rt.roomNumbers.length : 0) || 1;
            const rtCapacity = Number(rt.capacity) || 1;
            const baseTierSlug = normalizeSlug(rt.name || `tier-${rtIdx + 1}`);

            for (let rIdx = 0; rIdx < numRooms; rIdx++) {
              const explicitRoomNumber = Array.isArray(rt.roomNumbers) && rt.roomNumbers[rIdx]
                ? String(rt.roomNumbers[rIdx])
                : `Room ${rtIdx + 1}${String.fromCharCode(65 + rIdx)}`;

              const roomId = `room-${hostelId}-${rt.id || baseTierSlug}-${rIdx + 1}`;
              allRooms.push({
                id: roomId,
                roomNumber: explicitRoomNumber,
                tierId: rt.id || `rt-${rtIdx + 1}`,
                tierSlug: baseTierSlug,
                tierName: rt.name || "Standard Room",
                capacity: rtCapacity,
                tierCapacity: rtCapacity,
                currentOccupancy: 0,
                status: "active",
                beds: [],
              });
            }
          });
        }

        // Process and heal each room
        const healedRooms: PhysicalRoomWithBeds[] = [];

        for (let idx = 0; idx < allRooms.length; idx++) {
          const rawRoom = allRooms[idx];
          const roomId = rawRoom.id || `room-${idx + 1}`;
          const roomNumber = rawRoom.roomNumber || `Room ${idx + 1}`;

          // Find associated roomType for metadata normalization
          const matchedRt = roomTypes.find(
            (rt) =>
              rt.id === rawRoom.tierId ||
              rt.id === rawRoom.roomTypeId ||
              (rt.name && rawRoom.tierName && rt.name.toLowerCase() === rawRoom.tierName.toLowerCase()) ||
              normalizeSlug(rt.name) === rawRoom.tierSlug
          );

          const roomCapacity = Number(
            rawRoom.capacity || rawRoom.tierCapacity || matchedRt?.capacity || 1
          );

          const tierId = rawRoom.tierId || rawRoom.roomTypeId || matchedRt?.id || "default-tier";
          const tierName = rawRoom.tierName || matchedRt?.name || rawRoom.tier || "Standard Room";
          const tierSlug = rawRoom.tierSlug || normalizeSlug(tierName);

          // Standardize beds array
          const rawBeds: any[] = Array.isArray(rawRoom.beds) ? rawRoom.beds : [];
          const occupiedCountFromProps = Number(rawRoom.currentOccupancy || rawRoom.occupancy) || 0;
          const wasLegacyBooked = Boolean(rawRoom.isBooked);

          const healedBeds: Bed[] = Array.from({ length: roomCapacity }, (_, bIdx) => {
            const existingBed = rawBeds[bIdx];
            let isOccupied = Boolean(existingBed?.isOccupied);

            // If bed has occupancy info, preserve it
            if (existingBed) {
              return {
                id: existingBed.id || `bed-${bIdx + 1}`,
                isOccupied,
                studentId: existingBed.studentId || null,
                bookedAt: existingBed.bookedAt || null,
                bookingRef: existingBed.bookingRef || null,
              };
            }

            // Fallback: infer occupation from currentOccupancy or legacy isBooked
            if (!isOccupied) {
              if (bIdx < occupiedCountFromProps) {
                isOccupied = true;
              } else if (wasLegacyBooked && bIdx === 0 && roomCapacity === 1) {
                isOccupied = true;
              }
            }

            return {
              id: `bed-${bIdx + 1}`,
              isOccupied,
              studentId: null,
              bookedAt: null,
              bookingRef: null,
            };
          });

          const totalOccupiedBeds = healedBeds.filter((b) => b.isOccupied).length;
          const isFullyBooked = totalOccupiedBeds >= roomCapacity;

          const healedRoom: PhysicalRoomWithBeds = {
            ...rawRoom,
            id: roomId,
            roomNumber,
            tierId,
            roomTypeId: tierId,
            tierSlug,
            tierName,
            capacity: roomCapacity,
            tierCapacity: roomCapacity,
            currentOccupancy: totalOccupiedBeds,
            beds: healedBeds,
            isFullyBooked,
            status: isFullyBooked ? "full" : "available",
          };

          // Remove deceptive poisonous root flags that cause entire rooms to disappear
          delete healedRoom.isBooked;

          healedRooms.push(healedRoom);

          // Sync individual room to subcollection hostels/{hostelId}/rooms/{roomId}
          try {
            await setDoc(doc(db, "hostels", hostelId, "rooms", roomId), healedRoom, { merge: true });
          } catch (subErr) {
            console.warn(`Could not sync subcollection room ${roomId}:`, subErr);
          }
        }

        // Save repaired rooms array back to parent hostel document
        await updateDoc(doc(db, "hostels", hostelId), {
          rooms: healedRooms,
          inventorySchemaVersion: 2,
          lastInventoryAuditAt: new Date().toISOString(),
        });

        const totalBedsInHostel = healedRooms.reduce((sum, r) => sum + r.beds.length, 0);
        result.repairedHostels += 1;
        result.totalRoomsRepaired += healedRooms.length;
        result.details.push({
          hostelId,
          hostelName,
          roomsCount: healedRooms.length,
          bedsCount: totalBedsInHostel,
        });
      } catch (hErr: any) {
        console.error(`Error repairing hostel ${hostelId}:`, hErr);
        result.errors.push({
          hostelId,
          error: hErr?.message || "Unknown error during hostel repair",
        });
      }
    }
  } catch (err: any) {
    console.error("Global inventory repair failed:", err);
    throw err;
  }

  return result;
}
