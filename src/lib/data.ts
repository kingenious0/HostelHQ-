import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, Timestamp, writeBatch, deleteDoc, addDoc, orderBy, or } from "firebase/firestore";
import { ably } from './ably';
import { getHostelById, listHostels, getAgentById } from './dynamodb-service';

export type RoomType = {
  id?: string;
  name: string;
  price: number;
  availability: 'Available' | 'Limited' | 'Full';
  beds?: string;
  bathrooms?: string;
  // Room-level amenities (e.g. AC, Private Washroom, Balcony, etc.)
  roomAmenities?: string[];
  occupancy?: number; // current number of occupants
  capacity?: number; // total occupants allowed per room
  numberOfRooms?: number; // number of rooms of this type (optional)
  roomNumbers?: string[]; // explicit physical room numbers for this type (optional)
};

// A physical numbered room inside a hostel. Stored under hostels/{hostelId}/rooms/{roomId}.
export type Room = {
  id?: string;
  roomNumber: string; // e.g. "101", "B12"
  roomTypeId: string; // references a RoomType id in hostels/{hostelId}/roomTypes
  capacity: number; // total beds in this room
  currentOccupancy: number; // confirmed occupants
  status: 'active' | 'inactive';
};

export type Review = {
    id: string;
    studentId: string;
    studentName: string;
    rating: number;
    comment: string;
    createdAt: string; // ISO string
};

export type Hostel = {
  id: string;
  name: string;
  location: string;
  institution?: string;
  gender?: string;
  rating: number;
  numberOfReviews: number;
  amenities: string[];
  images: string[];
  description: string;
  agentId?: string;
  lat?: number;
  lng?: number;
  availability: 'Available' | 'Limited' | 'Full';
  roomTypes: RoomType[];
  roomTypeTags?: string[];
  priceRange: {
    min: number;
    max: number;
  };
  isFeatured?: boolean;
  distanceToUniversity?: string;
  billsIncluded?: string[];
  billsExcluded?: string[];
  securityAndSafety?: string[];
  reviews: Review[]; // Add this back for full hostel details page
  // Creator tracking fields
  createdBy?: {
    userId: string;
    fullName: string;
    email: string;
    role: 'agent' | 'manager' | 'admin';
    createdAt: string;
  };
  status?: 'pending' | 'approved' | 'rejected' | 'live';
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  [key: string]: any;
};

export type AppUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'agent' | 'admin';
  profileImage?: string;
};

export type Agent = AppUser & {
    role: 'agent';
    rating: number;
    vehicle: string;
    status: 'online' | 'offline';
    location: { lat: number; lng: number; };
    imageUrl: string;
    phone: string;
};

export type Visit = {
    id: string;
    studentId: string;
    agentId: string;
    visitDate: Date;
    status: 'pending' | 'accepted' | 'declined' | 'completed';
}

export type GetHostelsOptions = {
  featured?: boolean;
  institution?: string;
  roomType?: string;
  gender?: string;
  search?: string;
  location?: string;
};

export const staticHostels: Hostel[] = [
  {
    id: '1',
    name: 'Doku Hostel',
    location: 'AAMUSTED, Kumasi (~5 min walk)',
    institution: 'A A M U S T E D',
    gender: 'Male',
    rating: 4.5,
    numberOfReviews: 0,
    amenities: ['Balconies', 'TV Room', 'Comfortable'],
    images: [
      'https://picsum.photos/seed/hostel-building-1/800/600',
      'https://picsum.photos/seed/hostel-room-1/800/600',
    ],
    description: "Approx. walking time: ~5–10 minutes. Route: Leave AAMUSTED via the main exit and walk along Sunyani Road / Denkyembuoso Road. Price: GHC ~3,000–4,400. Amenities: Balconies, TV/common area, comfortable rooms. Click here for directions: https://www.google.com/maps/dir/?api=1&origin=AAMUSTED+Tanoso+Kumasi+Ghana&destination=Doku+Kaakyire+Hostel+Denkyembuoso+Road+Kumasi+Ghana&travelmode=walking",
    lat: 6.69,
    lng: -1.66,
    availability: 'Available',
    roomTypes: [
        { 
          id: 'rt1', 
          name: '4 IN A ROOM', 
          price: 3700, 
          availability: 'Available', 
          capacity: 4, 
          occupancy: 1,
          roomAmenities: ['Balconies', 'Shared Bathroom', 'Electricity', 'Water', 'Fan', 'Study Room', 'Security', 'Furnished']
        },
        { 
          id: 'rt2', 
          name: '2 IN A ROOM', 
          price: 4500, 
          availability: 'Limited', 
          capacity: 2, 
          occupancy: 1,
          roomAmenities: ['Private Balcony', 'Private Bathroom', 'Electricity', 'Water', 'AC', 'TV', 'Security', 'Furnished', 'Hot Water']
        },
    ],
    roomTypeTags: ['4 IN A ROOM', '2 IN A ROOM'],
    priceRange: { min: 3700, max: 4500 },
    reviews: [],
    // Add individual physical rooms for demonstration
    rooms: [
      {
        id: 'room-1',
        roomNumber: '1',
        roomTypeId: 'rt1',
        capacity: 4,
        currentOccupancy: 0,
        status: 'active',
        roomType: 'Four In A Room',
        price: 3700,
        gender: 'Male',
        image: 'https://picsum.photos/seed/hostel-room-1/800/600'
      },
      {
        id: 'room-2',
        roomNumber: '2',
        roomTypeId: 'rt1',
        capacity: 4,
        currentOccupancy: 0,
        status: 'active',
        roomType: 'Four In A Room',
        price: 3700,
        gender: 'Male',
        image: 'https://picsum.photos/seed/hostel-room-2/800/600'
      },
      {
        id: 'room-3',
        roomNumber: '3',
        roomTypeId: 'rt1',
        capacity: 4,
        currentOccupancy: 0,
        status: 'active',
        roomType: 'Four In A Room',
        price: 3700,
        gender: 'Male',
        image: 'https://picsum.photos/seed/hostel-room-3/800/600'
      },
      {
        id: 'room-4',
        roomNumber: '4',
        roomTypeId: 'rt1',
        capacity: 4,
        currentOccupancy: 0,
        status: 'active',
        roomType: 'Four In A Room',
        price: 3700,
        gender: 'Male',
        image: 'https://picsum.photos/seed/hostel-room-4/800/600'
      },
      {
        id: 'room-15',
        roomNumber: '15',
        roomTypeId: 'rt2',
        capacity: 2,
        currentOccupancy: 0,
        status: 'active',
        roomType: 'Two In A Room',
        price: 4500,
        gender: 'Male',
        image: 'https://picsum.photos/seed/hostel-room-15/800/600'
      }
    ]
  },
];


const normalizeText = (value?: string) => (value ?? '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeRoomTypeTag = (value?: string) => (value ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const hostelMatchesOptions = (hostel: Hostel, options: GetHostelsOptions) => {
  const normalizedInstitution = normalizeText(options.institution);
  const normalizedGender = (options.gender ?? '').toString().trim().toLowerCase();
  const normalizedRoomType = normalizeRoomTypeTag(options.roomType);
  const normalizedSearch = (options.search ?? '').toString().trim().toLowerCase();
  const normalizedLocation = (options.location ?? '').toString().trim().toLowerCase();

  const hostelInstitution = normalizeText(hostel.institution);
  const hostelGender = (hostel.gender ?? '').toString().trim().toLowerCase();
  const hostelRoomTypeTags =
    (hostel.roomTypeTags ?? []).map((tag) => normalizeRoomTypeTag(tag)).filter(Boolean);
  const derivedRoomTypeTags =
    (hostel.roomTypes ?? []).map((rt) => normalizeRoomTypeTag(rt.name)).filter(Boolean);
  const allRoomTypeTags = hostelRoomTypeTags.length ? hostelRoomTypeTags : derivedRoomTypeTags;

  const matchesInstitution =
    !options.institution ||
    !hostelInstitution ||
    hostelInstitution === normalizedInstitution ||
    hostelInstitution.includes(normalizedInstitution) ||
    normalizedInstitution.includes(hostelInstitution);

  const matchesGender =
    !options.gender ||
    hostelGender.includes(normalizedGender) ||
    hostelGender === 'mixed' ||
    normalizedGender === 'mixed';

  const matchesRoomType =
    !options.roomType ||
    allRoomTypeTags.includes(normalizedRoomType);

  const matchesSearch =
    !options.search ||
    (hostel.name ?? '').toLowerCase().includes(normalizedSearch) ||
    (hostel.location ?? '').toLowerCase().includes(normalizedSearch);

  const matchesLocation =
    !options.location ||
    (hostel.location ?? '').toLowerCase().includes(normalizedLocation) ||
    (hostel.nearbyLandmarks ?? '').toLowerCase().includes(normalizedLocation);

  return matchesInstitution && matchesGender && matchesRoomType && matchesSearch && matchesLocation;
};


let simulationInterval: NodeJS.Timeout | null = null;

const simulateAgentMovementWithAbly = (agentId: string, destinationLat: number, destinationLng: number) => {
    // Clear any existing simulation
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    if (!ably) return;
    const channel = ably.channels.get(`agent:${agentId}:gps`);

    const agentRef = doc(db, 'users', agentId);
    let step = 0;
    const totalSteps = 20;

    simulationInterval = setInterval(async () => {
        const agentSnap = await getDoc(agentRef);
        if (!agentSnap.exists()) {
            clearInterval(simulationInterval!);
            return;
        }

        const currentLoc = agentSnap.data().location;
        const newLat = currentLoc.lat + (destinationLat - currentLoc.lat) / (totalSteps - step);
        const newLng = currentLoc.lng + (destinationLng - currentLoc.lng) / (totalSteps - step);
        const newLocation = { lat: newLat, lng: newLng };

        await updateDoc(agentRef, { location: newLocation });
        await channel.publish('location', newLocation);

        step++;
        if (step >= totalSteps) {
            await updateDoc(agentRef, { location: { lat: destinationLat, lng: destinationLng } });
            await channel.publish('location', { lat: destinationLat, lng: destinationLng });
            console.log(`Agent ${agentId} has arrived and simulation ended.`);
            clearInterval(simulationInterval!);
        }
    }, 2000); 
};


export async function getAgent(agentId: string): Promise<Agent | null> {
    try {
        const agentDocRef = doc(db, 'users', agentId);
        const agentDoc = await getDoc(agentDocRef);
        if (agentDoc.exists() && agentDoc.data().role === 'agent') {
            return { id: agentDoc.id, ...agentDoc.data() } as Agent;
        }
    } catch (e) {
        console.error("Error fetching agent: ", e);
    }

    try {
        const dynamoAgent = await getAgentById(agentId);
        if (dynamoAgent) return dynamoAgent;
    } catch (e) {}

    return null;
}

// Function to convert Firestore Timestamps to strings
const convertTimestamps = (data: any) => {
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      if (value instanceof Timestamp) {
        newData[key] = value.toDate().toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        newData[key] = convertTimestamps(value);
      } else {
        newData[key] = value;
      }
    }
  }
  return newData;
};


export async function getHostel(hostelId: string): Promise<Hostel | null> {
    try {
        const hostelDocRef = doc(db, 'hostels', hostelId);
        const hostelDoc = await getDoc(hostelDocRef);

        if (hostelDoc.exists()) {
            const data = hostelDoc.data();
            
            // Fetch room types from subcollection
            const roomTypesCollectionRef = collection(db, 'hostels', hostelId, 'roomTypes');
            const roomTypesSnapshot = await getDocs(roomTypesCollectionRef);
            let roomTypes = roomTypesSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as RoomType));

            if (roomTypes.length === 0 && Array.isArray(data.roomTypes)) {
                roomTypes = data.roomTypes;
            }

            // Fetch physical numbered rooms from subcollection (if any)
            const roomsCollectionRef = collection(db, 'hostels', hostelId, 'rooms');
            const roomsSnapshot = await getDocs(roomsCollectionRef);
            const rooms = roomsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Room));
            
            // Fetch all reviews for the hostel
            let reviewsWithUserData: any[] = [];
            try {
                const reviewsQuery = query(
                    collection(db, 'reviews'), 
                    where('hostelId', '==', hostelId),
                    orderBy('createdAt', 'desc')
                );
                const reviewsSnapshot = await getDocs(reviewsQuery);
                const reviewsDataPromises = reviewsSnapshot.docs.map(async (docSnapshot: any) => {
                    const reviewData = convertTimestamps({ id: docSnapshot.id, ...docSnapshot.data() }) as Review;
                    const userDoc = await getDoc(doc(db, "users", reviewData.studentId));
                    const userProfileImage = userDoc.exists() ? (userDoc.data() as AppUser).profileImage : '';
                    const userName = userDoc.exists() ? (userDoc.data() as AppUser).fullName : reviewData.studentName;
                    return { ...reviewData, studentName: userName, userProfileImage };
                });
                reviewsWithUserData = await Promise.all(reviewsDataPromises);
            } catch (err) {
                console.warn("Reviews fetch fallback:", err);
            }

            const prices = roomTypes.map((rt: any) => rt.price).filter((p: any) => typeof p === 'number' && !isNaN(p));
            const priceRange = {
                min: prices.length > 0 ? Math.min(...prices) : (data.priceRange?.min || 0),
                max: prices.length > 0 ? Math.max(...prices) : (data.priceRange?.max || 0),
            };

            const totalRating = reviewsWithUserData.reduce((acc, review) => acc + (review.rating || 0), 0);
            const averageRating = reviewsWithUserData.length > 0 ? totalRating / reviewsWithUserData.length : (data.rating || 0);

            const hostelLat = typeof data.lat === 'number' 
                ? data.lat 
                : (typeof data.coordinates?.lat === 'number' ? data.coordinates.lat : null);
            const hostelLng = typeof data.lng === 'number' 
                ? data.lng 
                : (typeof data.coordinates?.lng === 'number' ? data.coordinates.lng : null);
            
            return convertTimestamps({ 
                id: hostelDoc.id, 
                ...data, 
                roomTypes,
                rooms,
                priceRange, 
                lat: hostelLat ?? staticHostels[0].lat, 
                lng: hostelLng ?? staticHostels[0].lng, 
                reviews: reviewsWithUserData, 
                rating: averageRating,
                numberOfReviews: reviewsWithUserData.length
            }) as Hostel;
        }
    } catch(e) {
        console.error("Error fetching hostel from firestore: ", e);
    }

    try {
        const dynamoHostel = await getHostelById(hostelId);
        if (dynamoHostel) return dynamoHostel;
    } catch (e) {}

    console.log("Falling back to static hostel data for hostelId: ", hostelId);
    const staticHostel = staticHostels.find(h => h.id === hostelId);
    if (staticHostel) {
        return { ...staticHostel, numberOfReviews: 0, reviews: [] };
    }
    return null;
}


export async function getHostels(options: GetHostelsOptions = {}): Promise<Hostel[]> {
    // 1. PRIMARY: Fetch from Firestore (live database with all uploaded hostels)
    try {
        const querySnapshot = await getDocs(collection(db, 'hostels'));

        if (!querySnapshot.empty) {
            const firestoreHostels = await Promise.all(querySnapshot.docs.map(async (docSnap: any) => {
                const data = docSnap.data();
                let roomTypes: RoomType[] = [];
                try {
                    const roomTypesCollectionRef = collection(db, 'hostels', docSnap.id, 'roomTypes');
                    const roomTypesSnapshot = await getDocs(roomTypesCollectionRef);
                    roomTypes = roomTypesSnapshot.docs.map((roomDoc: any) => ({ id: roomDoc.id, ...roomDoc.data() } as RoomType));
                } catch (err) {
                    console.warn(`Could not load roomTypes for hostel ${docSnap.id}:`, err);
                }

                // If roomTypes were saved directly on the doc as array:
                if (roomTypes.length === 0 && Array.isArray(data.roomTypes)) {
                    roomTypes = data.roomTypes;
                }
                
                let availability = (data.availability as Hostel['availability']) || (roomTypes.some(r => r.availability === 'Available' || r.availability === 'Limited') ? 'Available' : 'Available');

                const prices = roomTypes.map((rt: any) => rt.price).filter((p: any) => typeof p === 'number' && !isNaN(p));
                const priceRange = {
                    min: prices.length > 0 ? Math.min(...prices) : (data.priceRange?.min || 0),
                    max: prices.length > 0 ? Math.max(...prices) : (data.priceRange?.max || 0),
                };

                let reviewsCount = data.reviews ?? 0;
                let averageRating = data.rating ?? 0;

                try {
                    const reviewsQuery = query(collection(db, 'reviews'), where('hostelId', '==', docSnap.id), where('status', '==', 'approved'));
                    const reviewsSnapshot = await getDocs(reviewsQuery);
                    if (!reviewsSnapshot.empty) {
                        reviewsCount = reviewsSnapshot.size;
                        const totalRating = reviewsSnapshot.docs.reduce((acc: number, d: any) => acc + (d.data().rating || 0), 0);
                        averageRating = reviewsCount > 0 ? totalRating / reviewsCount : 0;
                    }
                } catch (_) {}

                const roomTypeTags = data.roomTypeTags ?? roomTypes.map((rt: any) => rt.name);

                const hostelLat = typeof data.lat === 'number' 
                    ? data.lat 
                    : (typeof data.coordinates?.lat === 'number' ? data.coordinates.lat : null);
                const hostelLng = typeof data.lng === 'number' 
                    ? data.lng 
                    : (typeof data.coordinates?.lng === 'number' ? data.coordinates.lng : null);

                return convertTimestamps({ 
                    id: docSnap.id, 
                    ...data, 
                    lat: hostelLat ?? staticHostels[0].lat,
                    lng: hostelLng ?? staticHostels[0].lng,
                    roomTypes, 
                    roomTypeTags,
                    availability, 
                    priceRange,
                    reviews: reviewsCount,
                    rating: averageRating,
                }) as Hostel;
            }));

            const filteredFirestore = firestoreHostels.filter((hostel) => hostelMatchesOptions(hostel, options));
            if (filteredFirestore.length > 0) {
                return filteredFirestore;
            }
        }
    } catch (e: any) {
        console.error("Error fetching hostels from Firestore: ", e);
    }

    // 2. SECONDARY: DynamoDB fallback
    try {
        const dynamoHostels = await listHostels({
            featuredOnly: options.featured,
            search: options.search,
            location: options.location,
        });
        if (dynamoHostels && dynamoHostels.length > 0) {
            const filtered = dynamoHostels.filter((hostel) => hostelMatchesOptions(hostel, options));
            if (filtered.length > 0) return filtered;
        }
    } catch (e) {}

    // 3. TERTIARY: Static fallback
    const fallbackHostels = staticHostels.filter((hostel) => hostelMatchesOptions(hostel, options));
    return fallbackHostels;
}

