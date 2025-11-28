import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, Timestamp, writeBatch, deleteDoc, addDoc, orderBy, or } from "firebase/firestore";
import { ably } from './ably';

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
          name: 'Four In A Room', 
          price: 3700, 
          availability: 'Available', 
          capacity: 4, 
          occupancy: 1,
          roomAmenities: ['Balconies', 'Shared Bathroom', 'Electricity', 'Water', 'Fan', 'Study Room', 'Security', 'Furnished']
        },
        { 
          id: 'rt2', 
          name: 'Two In A Room', 
          price: 4500, 
          availability: 'Limited', 
          capacity: 2, 
          occupancy: 1,
          roomAmenities: ['Private Balcony', 'Private Bathroom', 'Electricity', 'Water', 'AC', 'TV', 'Security', 'Furnished', 'Hot Water']
        },
    ],
    roomTypeTags: ['Four In A Room', 'Two In A Room'],
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


const normalizeText = (value?: string) => (value ?? '').toString().trim().toLowerCase();
const normalizeRoomTypeTag = (value?: string) => normalizeText(value).replace(/\s+/g, ' ');

const hostelMatchesOptions = (hostel: Hostel, options: GetHostelsOptions) => {
  const normalizedInstitution = normalizeText(options.institution);
  const normalizedGender = normalizeText(options.gender);
  const normalizedRoomType = normalizeRoomTypeTag(options.roomType);
  const normalizedSearch = normalizeText(options.search);
  const normalizedLocation = normalizeText(options.location);

  const hostelInstitution = normalizeText(hostel.institution);
  const hostelGender = normalizeText(hostel.gender);
  const hostelRoomTypeTags =
    (hostel.roomTypeTags ?? []).map((tag) => normalizeRoomTypeTag(tag)).filter(Boolean);
  const derivedRoomTypeTags =
    (hostel.roomTypes ?? []).map((rt) => normalizeRoomTypeTag(rt.name)).filter(Boolean);
  const allRoomTypeTags = hostelRoomTypeTags.length ? hostelRoomTypeTags : derivedRoomTypeTags;

  const matchesInstitution = !options.institution || hostelInstitution === normalizedInstitution;
  // Use substring match for gender to be more forgiving (e.g., 'mixed hostel' should match 'Mixed' filter)
  const matchesGender = !options.gender || hostelGender.includes(normalizedGender);
  const matchesRoomType =
    !options.roomType ||
    allRoomTypeTags.includes(normalizedRoomType);
  const matchesSearch =
    !options.search || normalizeText(hostel.name).includes(normalizedSearch);
  const matchesLocation =
    !options.location || normalizeText(hostel.location).includes(normalizedLocation);

  return matchesInstitution && matchesGender && matchesRoomType && matchesSearch && matchesLocation;
};


let simulationInterval: NodeJS.Timeout | null = null;

const simulateAgentMovementWithAbly = (agentId: string, destinationLat: number, destinationLng: number) => {
    // Clear any existing simulation
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
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
        return null;
    } catch (e) {
        console.error("Error fetching agent from firestore: ", e);
        return null;
    }
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
            const roomTypes = roomTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType));

            // Fetch physical numbered rooms from subcollection (if any)
            const roomsCollectionRef = collection(db, 'hostels', hostelId, 'rooms');
            const roomsSnapshot = await getDocs(roomsCollectionRef);
            const rooms = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
            
             // Fetch all reviews for the hostel (no status filter)
            const reviewsQuery = query(
                collection(db, 'reviews'), 
                where('hostelId', '==', hostelId),
                orderBy('createdAt', 'desc') // Order by most recent
            );
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviewsDataPromises = reviewsSnapshot.docs.map(async docSnapshot => {
                const reviewData = convertTimestamps({ id: docSnapshot.id, ...docSnapshot.data() }) as Review;
                // Fetch reviewer's profile image and name
                const userDoc = await getDoc(doc(db, "users", reviewData.studentId));
                const userProfileImage = userDoc.exists() ? (userDoc.data() as AppUser).profileImage : '';
                const userName = userDoc.exists() ? (userDoc.data() as AppUser).fullName : reviewData.studentName; // Fallback to submitted name
                return { ...reviewData, studentName: userName, userProfileImage };
            });
            let reviewsWithUserData = await Promise.all(reviewsDataPromises);

            // Calculate price range
            const prices = roomTypes.map(rt => rt.price);
            const priceRange = {
                min: prices.length > 0 ? Math.min(...prices) : 0,
                max: prices.length > 0 ? Math.max(...prices) : 0,
            };

            // Calculate average rating and number of reviews
            const totalRating = reviewsWithUserData.reduce((acc, review) => acc + review.rating, 0);
            const averageRating = reviewsWithUserData.length > 0 ? totalRating / reviewsWithUserData.length : 0;

            // Get lat/lng from either top-level fields or nested coordinates object
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

    console.log("Falling back to static hostel data for hostelId: ", hostelId);
    const staticHostel = staticHostels.find(h => h.id === hostelId);
    // Add numberOfReviews and empty reviews array for static data fallback
    if (staticHostel) {
        return { ...staticHostel, numberOfReviews: 0, reviews: [] };
    }
    return null;
}


export async function getHostels(options: GetHostelsOptions = {}): Promise<Hostel[]> {
     try {
        let hostelsQuery = query(collection(db, 'hostels'));

        const conditions = [];
        if (options.featured) {
            conditions.push(where("isFeatured", "==", true));
        }
        if (options.institution) {
            conditions.push(where("institution", "==", options.institution));
        }
        if (options.gender) {
            conditions.push(where("gender", "==", options.gender));
        }
        if (options.roomType) {
            conditions.push(where("roomTypeTags", "array-contains", options.roomType));
        }

        if (conditions.length > 0) {
            hostelsQuery = query(collection(db, 'hostels'), ...conditions);
        }

        const querySnapshot = await getDocs(hostelsQuery);

        const firestoreHostels = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            const roomTypesCollectionRef = collection(db, 'hostels', doc.id, 'roomTypes');
            const roomTypesSnapshot = await getDocs(roomTypesCollectionRef);
            const roomTypes = roomTypesSnapshot.docs.map(roomDoc => ({ id: roomDoc.id, ...roomDoc.data() } as RoomType));
            
            let availability = data.availability as Hostel['availability'] || 'Full';

            const prices = roomTypes.map(rt => rt.price);
            const priceRange = {
                min: prices.length > 0 ? Math.min(...prices) : 0,
                max: prices.length > 0 ? Math.max(...prices) : 0,
            };

            const reviewsQuery = query(collection(db, 'reviews'), where('hostelId', '==', doc.id), where('status', '==', 'approved'));
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviewsCount = reviewsSnapshot.size;
            const totalRating = reviewsSnapshot.docs.reduce((acc, doc) => acc + doc.data().rating, 0);
            const averageRating = reviewsCount > 0 ? totalRating / reviewsCount : 0;

            const roomTypeTags = data.roomTypeTags ?? roomTypes.map(rt => rt.name);

            return convertTimestamps({ 
                id: doc.id, 
                ...data, 
                roomTypes, 
                roomTypeTags,
                availability, 
                priceRange,
                reviews: reviewsCount,
                rating: averageRating,
            }) as Hostel;
        }));

        const filteredHostels = firestoreHostels.filter((hostel) => hostelMatchesOptions(hostel, options));

        if (filteredHostels.length > 0 || Object.values(options).some(Boolean)) {
            return filteredHostels;
        }
    } catch (e: any) {
        console.error("\n--- FIRESTORE FETCH FAILED (DEV) ---");
        console.error("Could not fetch hostels from Firestore. This is likely due to missing or incorrect Firebase credentials in your local `.env` file.");
        console.error("Please ensure your `.env` file has the correct NEXT_PUBLIC_FIREBASE_... variables for your project.");
        console.error("Falling back to static data. Original error:", e.message);
        console.error("--------------------------------------\n");
    }
    
    const fallbackHostels = staticHostels.filter((hostel) => hostelMatchesOptions(hostel, options));
    return fallbackHostels;
}
