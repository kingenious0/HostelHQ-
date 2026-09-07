import type { RoomType } from "@/lib/data";

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
}

/**
 * Calculates real-time room capacity and individual bed vacancy
 * from roomType configuration and confirmed bookings.
 */
export function calculateRoomTypeInventory(
  roomType: RoomType,
  confirmedBookings: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }>
): RoomTypeInventorySummary {
  const capacityPerRoom = Number(roomType.capacity) || 1;
  const configuredRoomNumbers = roomType.roomNumbers && roomType.roomNumbers.length > 0
    ? roomType.roomNumbers
    : Array.from({ length: Number(roomType.numberOfRooms) || 1 }, (_, i) => `Room ${i + 1}`);

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
  };
}
