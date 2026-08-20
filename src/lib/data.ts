import { ably } from './ably';
import {
  getHostelById as getHostelFromDynamo,
  listHostels as listHostelsFromDynamo,
  getAgentById as getAgentFromDynamo,
  updateUserLocation as updateAgentLocationInDynamo,
} from './dynamodb-service';

export type RoomType = {
  id?: string;
  name: string;
  price: number;
  availability: 'Available' | 'Limited' | 'Full';
  beds?: string;
  bathrooms?: string;
};

export type Review = {
  id: string;
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  createdAt: string; // ISO string
  status: 'pending' | 'approved';
};

export type Hostel = {
  id: string;
  name: string;
  location: string;
  rating: number;
  reviews: Review[];
  amenities: string[];
  images: string[];
  description: string;
  agentId?: string;
  lat?: number;
  lng?: number;
  availability: 'Available' | 'Limited' | 'Full';
  roomTypes: RoomType[];
  priceRange: {
    min: number;
    max: number;
  };
  isFeatured?: boolean;
  distanceToUniversity?: string;
  billsIncluded?: string[];
  billsExcluded?: string[];
  securityAndSafety?: string[];
  [key: string]: any;
};

export type AppUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'agent' | 'admin';
};

export type Agent = AppUser & {
  role: 'agent';
  rating: number;
  vehicle: string;
  status: 'online' | 'offline';
  location: { lat: number; lng: number };
  imageUrl: string;
  phone: string;
};

export type Visit = {
  id: string;
  studentId: string;
  agentId: string;
  visitDate: Date | string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
};

export const staticHostels: Hostel[] = [
  {
    id: '1',
    name: 'Doku Hostel',
    location: 'AAMUSTED, Kumasi (~5 min walk)',
    rating: 4.5,
    reviews: [],
    amenities: ['Balconies', 'TV Room', 'Comfortable'],
    images: [
      'https://picsum.photos/seed/hostel-building-1/800/600',
      'https://picsum.photos/seed/hostel-room-1/800/600',
    ],
    description:
      'Approx. walking time: ~5–10 minutes. Route: Leave AAMUSTED via the main exit and walk along Sunyani Road / Denkyembuoso Road. Price: GHC ~3,000–4,400. Amenities: Balconies, TV/common area, comfortable rooms. Click here for directions: https://www.google.com/maps/dir/?api=1&origin=AAMUSTED+Tanoso+Kumasi+Ghana&destination=Doku+Kaakyire+Hostel+Denkyembuoso+Road+Kumasi+Ghana&travelmode=walking',
    lat: 6.69,
    lng: -1.66,
    availability: 'Available',
    roomTypes: [
      { id: 'rt1', name: '4 in a room', price: 3700, availability: 'Available' },
      { id: 'rt2', name: '2 in a room', price: 4500, availability: 'Limited' },
    ],
    priceRange: { min: 3700, max: 4500 },
  },
];

let simulationInterval: NodeJS.Timeout | null = null;

export const simulateAgentMovementWithAbly = (
  agentId: string,
  destinationLat: number,
  destinationLng: number
) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }

  const channel = ably.channels.get(`agent:${agentId}:gps`);
  let step = 0;
  const totalSteps = 20;

  simulationInterval = setInterval(async () => {
    try {
      const agent = await getAgentFromDynamo(agentId);
      if (!agent) {
        if (simulationInterval) clearInterval(simulationInterval);
        return;
      }

      const currentLoc = agent.location || { lat: 6.69, lng: -1.66 };
      const newLat = currentLoc.lat + (destinationLat - currentLoc.lat) / (totalSteps - step);
      const newLng = currentLoc.lng + (destinationLng - currentLoc.lng) / (totalSteps - step);
      const newLocation = { lat: newLat, lng: newLng };

      await updateAgentLocationInDynamo(agentId, newLocation);
      await channel.publish('location', newLocation);

      step++;
      if (step >= totalSteps) {
        await updateAgentLocationInDynamo(agentId, { lat: destinationLat, lng: destinationLng });
        await channel.publish('location', { lat: destinationLat, lng: destinationLng });
        console.log(`Agent ${agentId} has arrived and simulation ended.`);
        if (simulationInterval) clearInterval(simulationInterval);
      }
    } catch (err) {
      console.error('Error during agent simulation:', err);
      if (simulationInterval) clearInterval(simulationInterval);
    }
  }, 2000);
};

export async function getAgent(agentId: string): Promise<Agent | null> {
  try {
    return await getAgentFromDynamo(agentId);
  } catch (e) {
    console.error('Error fetching agent from DynamoDB:', e);
    return null;
  }
}

export async function getHostel(hostelId: string): Promise<Hostel | null> {
  try {
    const hostel = await getHostelFromDynamo(hostelId);
    if (hostel) {
      return hostel;
    }
  } catch (e) {
    console.error('Error fetching hostel from DynamoDB:', e);
  }

  console.log('Falling back to static hostel data for hostelId:', hostelId);
  const staticHostel = staticHostels.find((h) => h.id === hostelId);
  return staticHostel || null;
}

export async function getHostels(
  options: { featured?: boolean; search?: string; location?: string; agentId?: string } = {}
): Promise<Hostel[]> {
  try {
    const dynamoHostels = await listHostelsFromDynamo({
      featuredOnly: options.featured,
      search: options.search,
      location: options.location,
      agentId: options.agentId,
    });

    if (dynamoHostels.length > 0 || options.search || options.location) {
      return dynamoHostels;
    }
  } catch (e: any) {
    console.error('\n--- DYNAMODB FETCH FAILED (DEV) ---');
    console.error('Could not fetch hostels from DynamoDB:', e.message);
    console.error('Falling back to static data.');
    console.error('------------------------------------\n');
  }

  // Only fall back to static data if no search is active
  if (!options.search && !options.location) {
    console.log('Falling back to static hostel data.');
    return staticHostels;
  }

  return [];
}
