
// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { getAgent, Agent, Hostel } from '@/lib/data';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Loader2, Home, BedDouble, Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

type Visit = {
    id: string;
    studentId: string;
    agentId: string | null;
    hostelId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    createdAt: string;
};


export default function TrackingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { id: hostelId } = params;
    const visitId = searchParams.get('visitId');

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!visitId || !hostelId) return;

        const visitDocRef = doc(db, 'visits', visitId as string);
        const unsubVisit = onSnapshot(visitDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const visitData = { id: docSnap.id, ...docSnap.data() } as Visit;
                setVisit(visitData);
                
                // If an agent is assigned, fetch their data
                if (visitData.agentId && (!agent || agent.id !== visitData.agentId)) {
                    getAgent(visitData.agentId).then(setAgent);
                }
            } else {
                notFound();
            }
            setLoading(false);
        });
        
        const fetchHostel = async () => {
             const hostelDocRef = doc(db, 'hostels', hostelId as string);
             const hostelSnap = await getDoc(hostelDocRef);
             if(hostelSnap.exists()) {
                 setHostel({id: hostelSnap.id, ...hostelSnap.data()} as Hostel);
             }
        }
        fetchHostel();

        // Simulate agent assignment after 5 seconds
        const assignmentTimeout = setTimeout(() => {
            if (visit && visit.status === 'pending') {
                const assignedAgentId = 'agent-1'; // Hardcode for simulation
                updateDoc(visitDocRef, { 
                    agentId: assignedAgentId,
                    status: 'accepted'
                });
            }
        }, 5000);


        return () => {
            unsubVisit();
            clearTimeout(assignmentTimeout);
        };
    }, [visitId, hostelId, agent, visit]);
    
    if (loading || !visit || !hostel) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                     <p className="ml-4 text-muted-foreground">Loading your visit details...</p>
                </main>
            </div>
        )
    }

    const handleVisitComplete = async () => {
        if(visitId) {
            await updateDoc(doc(db, 'visits', visitId as string), { status: 'completed' });
            router.push(`/hostels/${hostelId}/book/rating`);
        }
    }
    
    const router = useRouter();
    const agentPhoneNumber = agent?.phone || '1234567890'; // Placeholder phone

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50/50">
                     <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                {visit.status === 'pending' && <><Loader2 className="h-6 w-6 animate-spin" /> Matching in Progress</>}
                                {visit.status === 'accepted' && <span className="text-green-600">✅ Visit Confirmed</span>}
                            </CardTitle>
                             <CardDescription>
                                {visit.status === 'pending' && "We're finding the best agent for your tour."}
                                {visit.status === 'accepted' && agent && `Your agent, ${agent.name}, is heading to the hostel.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {visit.status === 'pending' && (
                                <div className="flex flex-col items-center justify-center text-center py-8">
                                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                                    <p className="text-muted-foreground">Searching for available agents...</p>
                                </div>
                            )}
                            {visit.status === 'accepted' && agent && (
                                <div className="space-y-4">
                                    <div className="space-y-3 rounded-lg border bg-card text-card-foreground p-4">
                                        <div className="flex items-center gap-3">
                                            <Home className="h-5 w-5 text-muted-foreground"/>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Hostel</p>
                                                <p className="font-semibold">{hostel.name}</p>
                                            </div>
                                        </div>
                                         <div className="flex items-center gap-3">
                                            <BedDouble className="h-5 w-5 text-muted-foreground"/>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Room</p>
                                                <p className="font-semibold">{hostel.roomFeatures?.beds || 'N/A'} beds</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-muted-foreground"/>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Date</p>
                                                <p className="font-semibold">{new Date(visit.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                      <p className="text-sm text-muted-foreground">Agent ETA to hostel gate</p>
                                      <p className="text-3xl font-bold">5 mins</p>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="flex w-full gap-2">
                                        <a href={`tel:${agentPhoneNumber}`} className="flex-1">
                                            <Button className="w-full" variant="outline"><Phone className="mr-2 h-4 w-4" /> Call Agent</Button>
                                        </a>
                                        <a href={`https://wa.me/${agentPhoneNumber}`} className="flex-1">
                                            <Button className="w-full" variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
                                        </a>
                                    </div>
                                     <Button className="w-full" onClick={handleVisitComplete}>Agent has arrived</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="relative bg-muted h-96 md:h-full">
                    <Image src="https://picsum.photos/seed/map/1200/1200" alt="Map" fill style={{ objectFit: 'cover' }} className="opacity-50" data-ai-hint="street map" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-4 bg-background/80 rounded-lg shadow-lg">
                           <h2 className="text-lg font-semibold">Live Map</h2>
                           <p className="text-muted-foreground">🏠 Hostel Gate</p>
                           <p className="text-muted-foreground">● Agent (moving)</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
