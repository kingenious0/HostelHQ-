
import { db } from './firebase';
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

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
  lat?: number;
  lng?: number;
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
    roomId: string;
    visitDate: Date;
    status: 'pending' | 'accepted' | 'declined' | 'completed';
}

export const staticHostels: Hostel[] = [
  {
    id: '1',
    name: 'Doku Hostel',
    location: 'AAMUSTED, Kumasi',
    price: 3700,
    rating: 4.5,
    reviews: 12,
    amenities: ['Balconies', 'TV Room'],
    images: [
      'https://picsum.photos/seed/doku1/800/600',
      'https://picsum.photos/seed/doku2/800/600',
    ],
    description: 'Comfortable rooms with balconies and a common TV room, located just a 5-minute walk from AAMUSTED campus.',
    lat: 6.69,
    lng: -1.66
  },
  {
    id: '2',
    name: 'Kesewaa Hostel',
    location: 'IPT, Kumasi-Sunyani Highway',
    price: 2700,
    rating: 4.2,
    reviews: 21,
    amenities: ['Security', 'Water', 'Electricity'],
    images: [
      'https://picsum.photos/seed/kesewaa1/800/600',
      'https://picsum.photos/seed/kesewaa2/800/600',
    ],
    description: 'Roadside location with good security features. Near supermarkets and shops, with various shared/private room options.',
    lat: 6.70,
    lng: -1.65
  },
  {
    id: '3',
    name: 'White Hostel (Inside Campus)',
    location: 'On AAMUSTED campus',
    price: 3750,
    rating: 4.0,
    reviews: 18,
    amenities: ['WiFi', 'Wardrobes', 'Security'],
    images: [
      'https://picsum.photos/seed/white1/800/600',
      'https://picsum.photos/seed/white2/800/600',
    ],
    description: 'Clean, secure, and budget-friendly hostel located directly on campus. A great option if you prefer minimal walking.',
    lat: 6.69,
    lng: -1.66
  },
  {
    id: '4',
    name: 'Amansie Hostel',
    location: 'Tanoso, AAMUSTED',
    price: 1400,
    rating: 4.3,
    reviews: 35,
    amenities: ['Modern', 'Security', 'Water'],
    images: [
      'https://picsum.photos/seed/amansie1/800/600',
      'https://picsum.photos/seed/amansie2/800/600',
    ],
    description: 'A modern facility located behind the Total fuel station, just 5 minutes from campus. Close to other hostels and shops.',
    lat: 6.71,
    lng: -1.67
  },
    {
    id: '5',
    name: 'Agyeiwaa Hostel',
    location: 'Tanoso, AAMUSTED',
    price: 2800,
    rating: 4.1,
    reviews: 15,
    amenities: ['Private rooms', 'Shared rooms'],
    images: [
      'https://picsum.photos/seed/agyeiwaa1/800/600',
      'https://picsum.photos/seed/agyeiwaa2/800/600',
    ],
    description: 'Located adjacent to Amansie Hostel, offering both private and shared 2-in-1 rooms.',
    lat: 6.71,
    lng: -1.67
  },
  {
    id: '6',
    name: 'Degina Hostel',
    location: 'Tanoso, AAMUSTED',
    price: 2500,
    rating: 3.9,
    reviews: 9,
    amenities: ['Shared rooms', '2-in-1 rooms'],
    images: [
      'https://picsum.photos/seed/degina1/800/600',
      'https://picsum.photos/seed/degina2/800/600',
    ],
    description: 'Located behind the timber weighing center, about a 10-minute distance from campus. Offers 2-in-1 and shared rooms.',
    lat: 6.71,
    lng: -1.67
  },
];


export const adminStats = {
  revenue: 'GH₵ 12,500',
  occupancyRate: '85%',
  topAgents: [
    { name: 'Kofi Mensah', sales: 30 },
    { name: 'Ama Serwaa', sales: 25 },
    { name: 'Yaw Frimpong', sales: 22 },
  ]
};

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
    {
        id: 'agent-2',
        name: 'Esi Parker',
        rating: 4.9,
        vehicle: 'Honda Civic',
        status: 'online',
        location: { lat: 5.61, lng: -0.21 },
        imageUrl: 'https://picsum.photos/seed/agent2/200/200',
        phone: '233244123457'
    },
    {
        id: 'agent-3',
        name: 'Femi Adebayo',
        rating: 4.7,
        vehicle: 'Motorbike',
        status: 'offline',
        location: { lat: 5.62, lng: -0.20 },
        imageUrl: 'https://picsum.photos/seed/agent3/200/200',
        phone: '233244123458'
    }
];


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
        
        // Combine and remove duplicates, giving priority to firestore data
        const combined = [...firestoreHostels, ...staticHostels];
        const uniqueHostels = Array.from(new Map(combined.map(h => [h.id, h])).values());

        if (uniqueHostels.length > 0) {
            return uniqueHostels;
        }
    } catch (e) {
        console.error("Error fetching hostels from firestore: ", e);
    }
    
    // Fallback to static data if firestore fails or is empty
    console.log("Falling back to only static hostel data.");
    return staticHostels;
}
