import type { RoomType, Hostel } from "@/lib/data";

export interface PhysicalRoomState {
  roomNumber: string;
  roomId: string;
  roomTypeId: string;
  capacity: number;
  occupancy: number;
  spotsLeft: number;
  status: 'empty' | 'partial' | 'full';
  gender: string;
}

export interface RoomTypeInventorySummary {
  roomTypeId: string;
  roomTypeName: string;
  capacityPerRoom: number;
  totalRooms: number;
  totalBeds: number;
  totalOccupiedBeds: number;
  totalAvailableBeds: number;
  emptyRoomsCount: number;
  partialRoomsCount: number;
  fullRoomsCount: number;
  rooms: PhysicalRoomState[];
  isSoldOut: boolean;
}

/**
 * Calculates real-time room capacity and individual bed vacancy
 * from roomType configuration and confirmed bookings.
 */
export function calculateRoomTypeInventory(
  roomType: RoomType,
  confirmedBookings: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }> = []
): RoomTypeInventorySummary {
  const capacityPerRoom = Math.max(1, Number(roomType.capacity) || 1);
  const rawNumConfigured = Number(roomType.numberOfRooms);
  // Default to at least 1 room if not explicitly 0 and availability is not Full
  const numConfigured = !isNaN(rawNumConfigured) && rawNumConfigured > 0
    ? rawNumConfigured
    : (Array.isArray(roomType.roomNumbers) && roomType.roomNumbers.length > 0)
      ? roomType.roomNumbers.length
      : roomType.availability === 'Full'
        ? 0
        : 1;

  const configuredRoomNumbers = roomType.roomNumbers && roomType.roomNumbers.length > 0
    ? roomType.roomNumbers
    : numConfigured > 0
      ? Array.from({ length: numConfigured }, (_, i) => `Room ${i + 1}`)
      : ['Room 1'];

  const totalRooms = configuredRoomNumbers.length;
  const totalBeds = totalRooms * capacityPerRoom;

  // Filter bookings belonging to this roomType
  const relevantBookings = confirmedBookings.filter(
    (b) => b.roomTypeId === roomType.id || (!b.roomTypeId && b.roomNumber && configuredRoomNumbers.includes(b.roomNumber))
  );

  // Calculate occupancy per individual room number
  const roomOccupancyMap: Record<string, number> = {};
  relevantBookings.forEach((b) => {
    const key = b.roomNumber || (b.roomId ? `id-${b.roomId}` : configuredRoomNumbers[0]);
    roomOccupancyMap[key] = (roomOccupancyMap[key] || 0) + 1;
  });

  const rooms: PhysicalRoomState[] = configuredRoomNumbers.map((roomNum, idx) => {
    const occupancy = roomOccupancyMap[roomNum] || 0;
    const spotsLeft = Math.max(0, capacityPerRoom - occupancy);
    let status: 'empty' | 'partial' | 'full' = 'empty';
    if (spotsLeft === 0) status = 'full';
    else if (occupancy > 0) status = 'partial';

    return {
      roomNumber: roomNum,
      roomId: `${roomType.id || 'rt'}-room-${idx + 1}`,
      roomTypeId: roomType.id || '',
      capacity: capacityPerRoom,
      occupancy,
      spotsLeft,
      status,
      gender: 'Mixed',
    };
  });

  const totalOccupiedBeds = rooms.reduce((acc, r) => acc + r.occupancy, 0);
  const totalAvailableBeds = Math.max(0, totalBeds - totalOccupiedBeds);
  const emptyRoomsCount = rooms.filter((r) => r.status === 'empty').length;
  const partialRoomsCount = rooms.filter((r) => r.status === 'partial').length;
  const fullRoomsCount = rooms.filter((r) => r.status === 'full').length;

  const isExplicitSoldOut =
    (roomType as any).status === 'sold-out' ||
    (roomType as any).status === 'full' ||
    roomType.availability === 'Full';

  const isSoldOut = isExplicitSoldOut || (totalBeds > 0 && totalAvailableBeds <= 0);

  return {
    roomTypeId: roomType.id || '',
    roomTypeName: roomType.name,
    capacityPerRoom,
    totalRooms,
    totalBeds,
    totalOccupiedBeds,
    totalAvailableBeds,
    emptyRoomsCount,
    partialRoomsCount,
    fullRoomsCount,
    rooms,
    isSoldOut,
  };
}

/**
 * Helper to determine if a room type is 100% capacity / sold-out.
 */
export function isRoomTypeSoldOut(
  roomType?: RoomType | null,
  confirmedBookings?: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }>
): boolean {
  if (!roomType) return false;

  // 1. Explicit sold-out status or full availability
  if ((roomType as any).status === 'sold-out' || (roomType as any).status === 'full') return true;
  if (roomType.availability === 'Full') return true;

  // 2. Direct capacity vs occupancy check
  const capacityPerRoom = Math.max(1, Number(roomType.capacity) || 1);
  const rawNumRooms = Number(roomType.numberOfRooms);
  const numRooms = !isNaN(rawNumRooms) && rawNumRooms > 0
    ? rawNumRooms
    : (roomType.roomNumbers && roomType.roomNumbers.length > 0)
      ? roomType.roomNumbers.length
      : 1;
  const totalConfiguredCapacity = capacityPerRoom * numRooms;

  if (roomType.occupancy !== undefined && totalConfiguredCapacity > 0) {
    if (Number(roomType.occupancy) >= totalConfiguredCapacity) {
      return true;
    }
  }

  // 3. Real-time calculated inventory from confirmed bookings if provided
  if (confirmedBookings && confirmedBookings.length > 0) {
    const summary = calculateRoomTypeInventory(roomType, confirmedBookings);
    if (summary.isSoldOut) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to determine if an entire hostel is 100% capacity / sold-out.
 */
export function isHostelSoldOut(
  hostel?: Hostel | null,
  confirmedBookings?: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }>
): boolean {
  if (!hostel) return false;

  // 1. Explicit hostel-level sold-out status or full availability
  if ((hostel.status as any) === 'sold-out' || (hostel as any).status === 'full') return true;
  if (hostel.availability === 'Full') return true;

  // 2. Direct hostel totalCapacity vs occupancy check if defined
  if (hostel.totalCapacity !== undefined && hostel.totalCapacity > 0 && hostel.occupancy !== undefined) {
    if (Number(hostel.occupancy) >= Number(hostel.totalCapacity)) {
      return true;
    }
  }

  // 3. If all configured room types are individually sold out, the hostel is sold out
  if (hostel.roomTypes && hostel.roomTypes.length > 0) {
    const allRoomsSoldOut = hostel.roomTypes.every((rt) => isRoomTypeSoldOut(rt, confirmedBookings));
    if (allRoomsSoldOut) {
      return true;
    }
  }

  return false;
}

