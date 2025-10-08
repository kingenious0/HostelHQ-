
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from "firebase/firestore";
import { ably } from './ably';

export type Hostel = {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  amenities: string[];
  images: string[];
  description: string;
  agentId?: string;
  lat?: number;
  lng?: number;
  availability: 'Available' | 'Limited' | 'Full';
  roomFeatures?: { beds: string; bathrooms: string };
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
    location: { lat: number; lng: number; };
    imageUrl: string;
    phone: string;
};

export type Visit = {
    id: string;
    studentId: string;
    agentId: string;
    hostelId: string;
    visitDate: Date;
    status: 'pending' | 'accepted' | 'declined' | 'completed';
}

// This is now just a fallback if firestore fails, not the primary source of truth.
export const staticHostels: Hostel[] = [
  {
    id: '1',
    name: 'Doku Hostel',
    location: 'AAMUSTED, Kumasi (~5 min walk)',
    price: 3700,
    rating: 4.5,
    reviews: 12,
    amenities: ['Balconies', 'TV Room', 'Comfortable'],
    images: [
      'https://picsum.photos/seed/hostel-building-1/800/600',
      'https://picsum.photos/seed/hostel-room-1/800/600',
    ],
    description: "Approx. walking time: ~5–10 minutes. Route: Leave AAMUSTED via the main exit and walk along Sunyani Road / Denkyembuoso Road. Price: GHC ~3,000–4,400. Amenities: Balconies, TV/common area, comfortable rooms. Click here for directions: https://www.google.com/maps/dir/?api=1&origin=AAMUSTED+Tanoso+Kumasi+Ghana&destination=Doku+Kaakyire+Hostel+Denkyembuoso+Road+Kumasi+Ghana&travelmode=walking",
    lat: 6.69,
    lng: -1.66,
    availability: 'Available',
  },
];


export const bookingsChartData = [
  { month: "Jan", bookings: 82 },
  { month: "Feb", bookings: 95 },
  { month: "Mar", bookings: 110 },
  { month: "Apr", bookings: 98 },
  { month: "May", bookings: 120 },
  { month: "Jun", bookings: 135 },
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


const seedInitialUsers = async () => {
    try {
        // This is a placeholder for your actual admin UID from Firebase Auth
        const adminUid = 'CgE1aY3sVwXp2bY4i7S9fRzWn8E3'; // REPLACE WITH YOUR ADMIN's UID
        const adminRef = doc(db, 'users', adminUid); 
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
            console.log("Seeding admin user data...");
            await setDoc(adminRef, {
                fullName: 'Admin User',
                email: 'admin@test.com', // The email used in Firebase Auth
                role: 'admin'
            });
        }
    } catch(e) {
        console.warn("Could not seed admin user data:", e);
    }
};
// Uncomment and run once locally after creating the admin user in Firebase Auth
// seedInitialUsers();

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


export async function getHostel(hostelId: string): Promise<Hostel | null> {
    try {
        const hostelDocRef = doc(db, 'hostels', hostelId);
        const hostelDoc = await getDoc(hostelDocRef);
        if (hostelDoc.exists()) {
            const data = hostelDoc.data();
            const lat = typeof data.lat === 'number' ? data.lat : staticHostels[0].lat;
            const lng = typeof data.lng === 'number' ? data.lng : staticHostels[0].lng;
            return { id: hostelDoc.id, ...data, lat, lng } as Hostel;
        }
    } catch(e) {
        console.error("Error fetching hostel from firestore: ", e);
    }

    console.log("Falling back to static hostel data for hostelId: ", hostelId);
    const staticHostel = staticHostels.find(h => h.id === hostelId);
    return staticHostel || null;
}

export async function getHostels(): Promise<Hostel[]> {
     try {
        const hostelsCollectionRef = collection(db, 'hostels');
        const querySnapshot = await getDocs(hostelsCollectionRef);
        const firestoreHostels = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hostel));
        
        if (firestoreHostels.length > 0) {
            return firestoreHostels;
        }
    } catch (e: any) {
        console.error("\n--- FIRESTORE FETCH FAILED (DEV) ---");
        console.error("Could not fetch hostels from Firestore. This is likely due to missing or incorrect Firebase credentials in your local `.env` file.");
        console.error("Please ensure your `.env` file has the correct NEXT_PUBLIC_FIREBASE_... variables for your project.");
        console.error("Falling back to static data. Original error:", e.message);
        console.error("--------------------------------------\n");
    }
    
    console.log("Falling back to static hostel data.");
    return staticHostels;
}
