// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { getAgent, Agent, Hostel, assignAgentAndSimulate } from '@/lib/data';
import { notFound, useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Loader2, Home, BedDouble, Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { Map } from '@/components/map';

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
    const router = useRouter();
    const { id: hostelId } = params;
    const visitId = searchParams.get('visitId');

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!visitId || !hostelId) {
            notFound();
            return;
        };

        const unsubscribes: (() => void)[] = [];

        // Fetch hostel data once
        const fetchHostel = async () => {
             const hostelDocRef = doc(db, 'hostels', hostelId as string);
             const hostelSnap = await getDoc(hostelDocRef);
             if(hostelSnap.exists()) {
                 const hostelData = {id: hostelSnap.id, ...hostelSnap.data()} as Hostel
                 setHostel(hostelData);
                 
                 // Start agent assignment simulation after we have hostel data
                 if(visit?.status === 'pending' && !visit.agentId) {
                    const assignmentTimeout = setTimeout(() => {
                        assignAgentAndSimulate(visitId, hostelData);
                    }, 5000);
                    unsubscribes.push(() => clearTimeout(assignmentTimeout));
                 }
             } else {
                 notFound();
             }
        }
        fetchHostel();

        // Listen to visit document
        const visitDocRef = doc(db, 'visits', visitId as string);
        const unsubVisit = onSnapshot(visitDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const visitData = { id: docSnap.id, ...docSnap.data() } as Visit;
                setVisit(visitData);

                // If an agent is assigned, start listening to their document
                if (visitData.agentId && (!agent || agent.id !== visitData.agentId)) {
                    const agentDocRef = doc(db, 'agents', visitData.agentId);
                    const unsubAgent = onSnapshot(agentDocRef, (agentSnap) => {
                        if (agentSnap.exists()) {
                            setAgent({ id: agentSnap.id, ...agentSnap.data() } as Agent);
                        }
                    });
                    unsubscribes.push(unsubAgent);
                }
            } else {
                notFound();
            }
            setLoading(false);
        });
        unsubscribes.push(unsubVisit);


        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [visitId, hostelId, agent, visit?.status]);
    
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
                                 {visit.status === 'completed' && <span className="text-blue-600">🎉 Visit Complete</span>}
                            </CardTitle>
                             <CardDescription>
                                {visit.status === 'pending' && "We're finding the best agent for your tour."}
                                {visit.status === 'accepted' && agent && `Your agent, ${agent.name}, is heading to the hostel.`}
                                {visit.status === 'completed' && "Thank you for using HostelHQ!"}
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
                             {visit.status === 'completed' && (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground mb-4">Your visit is complete. We hope you liked it!</p>
                                    <Button onClick={() => router.push(`/hostels/${hostelId}/book/rating`)}>Rate Your Visit</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="relative bg-muted h-96 md:h-full">
                   <Map agentLocation={agent?.location} hostelLocation={hostel} />
                </div>
            </main>
        </div>
    );
}
