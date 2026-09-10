import { doc, runTransaction, type Transaction } from "firebase/firestore";
import { db } from "./firebase";

export interface Bed {
  id: string;
  isOccupied: boolean;
  studentId?: string | null;
  bookedAt?: string | null;
  bookingRef?: string | null;
}

export interface PhysicalRoomWithBeds {
  id: string;
  roomNumber: string;
  tierId: string;
  tierSlug?: string;
  tierName?: string;
  capacity: number;
  tierCapacity?: number;
  beds: Bed[];
  isFullyBooked?: boolean;
  status?: string;
  [key: string]: any;
}

/**
 * 1. Atomic Bed-Level Booking Mutation Handler
 * Bookings target and mutate ONLY the specific bed inside the target roomId.
 * The parent room and tier remain open, queryable, and visible as long as openBeds > 0.
 */
export async function secureBedReservation({
  hostelId,
  roomId,
  bedId,
  studentId,
  bookingReference,
}: {
  hostelId: string;
  roomId: string;
  bedId: string;
  studentId: string;
  bookingReference: string;
}) {
  const hostelRef = doc(db, "hostels", hostelId);

  return await runTransaction(db, async (transaction: any) => {
    const hostelDoc = await transaction.get(hostelRef);
    if (!hostelDoc.exists()) throw new Error("Hostel not found");

    const hostelData = hostelDoc.data();
    const rooms: PhysicalRoomWithBeds[] = [...(hostelData.rooms || [])];

    // Locate target physical room by id or roomNumber
    const roomIndex = rooms.findIndex(
      (r: any) =>
        r.id === roomId ||
        r.roomNumber === roomId ||
        r.roomNumber === `Room ${roomId}` ||
        `room-${r.roomNumber}` === roomId
    );
    if (roomIndex === -1) throw new Error("Room unit not found");

    const targetRoom: PhysicalRoomWithBeds = { ...rooms[roomIndex] };
    const roomCapacity = Number(targetRoom.capacity || targetRoom.tierCapacity) || 1;

    // Ensure beds array exists and matches capacity
    if (!Array.isArray(targetRoom.beds) || targetRoom.beds.length !== roomCapacity) {
      targetRoom.beds = Array.from({ length: roomCapacity }, (_, i) => {
        const existingBed = Array.isArray(targetRoom.beds) ? targetRoom.beds[i] : null;
        return {
          id: existingBed?.id || `bed-${i + 1}`,
          isOccupied: Boolean(existingBed?.isOccupied),
          studentId: existingBed?.studentId || null,
          bookedAt: existingBed?.bookedAt || null,
          bookingRef: existingBed?.bookingRef || null,
        };
      });
    } else {
      targetRoom.beds = targetRoom.beds.map((b) => ({ ...b }));
    }

    // Locate target bed
    let bedIndex = targetRoom.beds.findIndex((b) => b.id === bedId);
    if (bedIndex === -1) {
      // Fallback: choose the first vacant bed in this room
      bedIndex = targetRoom.beds.findIndex((b) => !b.isOccupied);
    }

    if (bedIndex === -1) {
      throw new Error("No vacant beds available in this room unit.");
    }

    if (targetRoom.beds[bedIndex].isOccupied) {
      throw new Error("This bed has already been secured by another student.");
    }

    // Mutate ONLY target bed
    targetRoom.beds[bedIndex] = {
      ...targetRoom.beds[bedIndex],
      isOccupied: true,
      studentId,
      bookedAt: new Date().toISOString(),
      bookingRef: bookingReference,
    };

    // Calculate room-level state without collapsing or unpublishing parent room/tier
    const remainingOpenBeds = targetRoom.beds.filter((b) => !b.isOccupied).length;
    targetRoom.isFullyBooked = remainingOpenBeds === 0;

    // Write back target room into the preserved rooms array
    rooms[roomIndex] = targetRoom;
    transaction.update(hostelRef, { rooms });

    return {
      success: true,
      roomId: targetRoom.id,
      roomNumber: targetRoom.roomNumber,
      bedId: targetRoom.beds[bedIndex].id,
      remainingOpenBeds,
      isFullyBooked: targetRoom.isFullyBooked,
    };
  });
}
