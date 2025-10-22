

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

export const staticHostels: Hostel[] = [
  {
    id: '1',
    name: 'Doku Hostel',
    location: 'AAMUSTED, Kumasi (~5 min walk)',
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
        { id: 'rt1', name: '4 in a room', price: 3700, availability: 'Available' },
        { id: 'rt2', name: '2 in a room', price: 4500, availability: 'Limited' },
    ],
    priceRange: { min: 3700, max: 4500 },
  },
];


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

            return convertTimestamps({ 
                id: hostelDoc.id, 
                ...data, 
                roomTypes, 
                priceRange, 
                lat: typeof data.lat === 'number' ? data.lat : staticHostels[0].lat, 
                lng: typeof data.lng === 'number' ? data.lng : staticHostels[0].lng, 
                reviews: reviewsWithUserData, 
                rating: averageRating,
                numberOfReviews: reviewsWithUserData.length // Add this line
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


export async function getHostels(options: { featured?: boolean, search?: string, location?: string } = {}): Promise<Hostel[]> {
     try {
        let hostelsQuery = query(collection(db, 'hostels'));

        const conditions = [];
        if (options.featured) {
            conditions.push(where("isFeatured", "==", true));
        }

        // Firestore does not support case-insensitive search natively.
        // A common workaround is to store a lowercased version of the fields you want to search.
        // For simplicity here, we will perform an exact match on the name, which means search is case-sensitive.
        // A more robust solution would involve a third-party search service like Algolia or Typesense.
        if (options.search) {
             // This performs a "starts-with" search, which is better than nothing.
            conditions.push(where("name", ">=", options.search));
            conditions.push(where("name", "<=", options.search + '\uf8ff'));
        }
        
        if (options.location) {
             conditions.push(where("location", ">=", options.location));
             conditions.push(where("location", "<=", options.location + '\uf8ff'));
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


            return convertTimestamps({ 
                id: doc.id, 
                ...data, 
                roomTypes, 
                availability, 
                priceRange,
                reviews: reviewsCount,
                rating: averageRating,
            }) as Hostel;
        }));
        
        if (firestoreHostels.length > 0 || options.search || options.location) {
            return firestoreHostels;
        }
    } catch (e: any) {
        console.error("\n--- FIRESTORE FETCH FAILED (DEV) ---");
        console.error("Could not fetch hostels from Firestore. This is likely due to missing or incorrect Firebase credentials in your local `.env` file.");
        console.error("Please ensure your `.env` file has the correct NEXT_PUBLIC_FIREBASE_... variables for your project.");
        console.error("Falling back to static data. Original error:", e.message);
        console.error("--------------------------------------\n");
    }
    
    // Only fall back to static data if no search is active
    if (!options.search && !options.location) {
        console.log("Falling back to static hostel data.");
        return staticHostels;
    }
    
    return [];
}
