import type { LucideIcon } from "lucide-react";
import { db } from './firebase';

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
  lat: number;
  lng: number;
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

export const hostels: Hostel[] = [
  {
    id: '1',
    name: 'Pioneer Hall',
    location: 'Accra, Ghana',
    price: 500,
    rating: 4.5,
    reviews: 120,
    amenities: ['wifi', 'kitchen', 'laundry', 'ac'],
    images: [
      'https://picsum.photos/seed/pioneer1/800/600',
      'https://picsum.photos/seed/pioneer2/800/600',
      'https://picsum.photos/seed/pioneer3/800/600',
    ],
    description: 'A modern and spacious hostel located in the heart of Accra. Perfect for students looking for comfort and convenience. Close to major universities and public transport.',
    lat: 5.6037,
    lng: -0.1870
  },
  {
    id: '2',
    name: 'Campus Cribs',
    location: 'Kumasi, Ghana',
    price: 450,
    rating: 4.2,
    reviews: 95,
    amenities: ['wifi', 'kitchen', 'parking'],
    images: [
      'https://picsum.photos/seed/cribs1/800/600',
      'https://picsum.photos/seed/cribs2/800/600',
      'https://picsum.photos/seed/cribs3/800/600',
    ],
    description: 'Affordable and cozy, Campus Cribs offers a great community feel. Located near KNUST, it is an ideal choice for students of the university.',
    lat: 6.6745,
    lng: -1.5716
  },
  {
    id: '3',
    name: 'Student Hub',
    location: 'Cape Coast, Ghana',
    price: 400,
    rating: 4.0,
    reviews: 80,
    amenities: ['wifi', 'laundry', 'study-area'],
    images: [
      'https://picsum.photos/seed/hub1/800/600',
      'https://picsum.photos/seed/hub2/800/600',
      'https://picsum.photos/seed/hub3/800/600',
    ],
    description: 'A quiet and conducive environment for studying. Student Hub is just a walking distance from the University of Cape Coast, offering all essential amenities.',
    lat: 5.1053,
    lng: -1.2466
  },
  {
    id: '4',
    name: 'The Nest',
    location: 'Accra, Ghana',
    price: 600,
    rating: 4.8,
    reviews: 150,
    amenities: ['wifi', 'kitchen', 'laundry', 'ac', 'gym'],
    images: [
      'https://picsum.photos/seed/nest1/800/600',
      'https://picsum.photos/seed/nest2/800/600',
      'https://picsum.photos/seed/nest3/800/600',
    ],
    description: 'Luxury student living with top-notch facilities. The Nest provides a premium experience with a gym, AC rooms, and 24/7 security.',
    lat: 5.6148,
    lng: -0.2058
  },
    {
    id: '5',
    name: 'Scholars Abode',
    location: 'Accra, Ghana',
    price: 520,
    rating: 4.6,
    reviews: 110,
    amenities: ['wifi', 'kitchen', 'study-area', 'ac'],
    images: [
      'https://picsum.photos/seed/abode1/800/600',
      'https://picsum.photos/seed/abode2/800/600',
      'https://picsum.photos/seed/abode3/800/600',
    ],
    description: 'A serene and studious environment, perfect for scholars. Located near the University of Ghana with easy access to libraries and academic resources.',
    lat: 5.6506,
    lng: -0.187
  },
  {
    id: '6',
    name: 'Ghartey Hall',
    location: 'Winneba, Ghana',
    price: 350,
    rating: 3.9,
    reviews: 75,
    amenities: ['wifi', 'laundry'],
    images: [
      'https://picsum.photos/seed/ghartey1/800/600',
      'https://picsum.photos/seed/ghartey2/800/600',
      'https://picsum.photos/seed/ghartey3/800/600',
    ],
    description: 'An economical option for students at the University of Education, Winneba. Offers basic amenities and a strong student community.',
    lat: 5.3534,
    lng: -0.6231
  },
];

export const pendingHostels = [
  {
    id: '7',
    name: 'Scholars Den',
    location: 'Kumasi, Ghana',
    agent: 'John Doe',
    dateSubmitted: '2023-10-26',
  },
  {
    id: '8',
    name: 'Uni Residences',
    location: 'Accra, Ghana',
    agent: 'Jane Smith',
    dateSubmitted: '2023-10-25',
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
    const visitDoc = await db.collection('visits').doc(visitId).get();
    if (!visitDoc.exists) {
        return null;
    }
    const data = visitDoc.data() as Omit<Visit, 'id' | 'visitDate'> & { visitDate: import('firebase-admin/firestore').Timestamp };
    return {
        id: visitDoc.id,
        ...data,
        visitDate: data.visitDate.toDate(),
    };
}

export async function getAgent(agentId: string): Promise<Agent | null> {
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
        return null;
    }
    return { id: agentDoc.id, ...agentDoc.data() } as Agent;
}
