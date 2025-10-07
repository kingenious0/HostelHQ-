
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

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

export type Agent = {
    id: string;
    name: string;
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
  // Other static hostels are removed for brevity in this example but would be here.
];


export const bookingsChartData = [
  { month: "Jan", bookings: 82 },
  { month: "Feb", bookings: 95 },
  { month: "Mar", bookings: 110 },
  { month: "Apr", bookings: 98 },
  { month: "May", bookings: 120 },
  { month: "Jun", bookings: 135 },
];


// Seed data for agents, will be moved to Firestore
export const agents: Agent[] = [
    {
        id: 'agent-1',
        name: 'Kofi Mensah',
        rating: 4.8,
        vehicle: 'Toyota Corolla',
        status: 'online',
        location: { lat: 5.63, lng: -0.19 },
        imageUrl: 'https://picsum.photos/seed/agent1/200/200',
        phone: '233244123456'
    },
];

// Seed agent data into Firestore if it doesn't exist.
const seedAgents = async () => {
    const agentRef = doc(db, 'agents', 'agent-1');
    const agentSnap = await getDoc(agentRef);
    if (!agentSnap.exists()) {
        console.log("Seeding agent data...");
        await setDoc(agentRef, agents[0]);
    }
};
seedAgents();


export async function getVisit(visitId: string): Promise<Visit | null> {
    const visitDocRef = doc(db, 'visits', visitId);
    const visitDoc = await getDoc(visitDocRef);
    if (!visitDoc.exists()) {
        return null;
    }
    const data = visitDoc.data();
    // Assuming the visitDate is stored as a Timestamp
    return {
        id: visitDoc.id,
        ...data,
        visitDate: (data.visitDate as any).toDate(),
    } as Visit;
}

export async function getAgent(agentId: string): Promise<Agent | null> {
    try {
        const agentDocRef = doc(db, 'agents', agentId);
        const agentDoc = await getDoc(agentDocRef);
        if (agentDoc.exists()) {
            return { id: agentDoc.id, ...agentDoc.data() } as Agent;
        }
    } catch (e) {
        console.error("Error fetching agent from firestore: ", e);
    }
    
    // Fallback to static data
    console.log("Falling back to static agent data for agentId: ", agentId);
    return agents.find(a => a.id === agentId) || null;
}

export async function getHostel(hostelId: string): Promise<Hostel | null> {
    try {
        const hostelDocRef = doc(db, 'hostels', hostelId);
        const hostelDoc = await getDoc(hostelDocRef);
        if (hostelDoc.exists()) {
            return { id: hostelDoc.id, ...hostelDoc.data() } as Hostel;
        }
    } catch(e) {
        console.error("Error fetching hostel from firestore: ", e);
    }

    // Fallback to static data if not in firestore for now
    console.log("Falling back to static hostel data for hostelId: ", hostelId);
    const staticHostel = staticHostels.find(h => h.id === hostelId);
    return staticHostel || null;
}

export async function getHostels(): Promise<Hostel[]> {
    try {
        const hostelsCollectionRef = collection(db, 'hostels');
        const querySnapshot = await getDocs(hostelsCollectionRef);
        const firestoreHostels = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hostel));
        
        // This now prioritizes Firestore data. Static data is only a fallback.
        if (firestoreHostels.length > 0) {
            return firestoreHostels;
        }
    } catch (e) {
        console.error("Error fetching hostels from firestore: ", e);
    }
    
    // Fallback to static data if firestore fails or is empty
    console.log("Falling back to only static hostel data.");
    return staticHostels;
}
