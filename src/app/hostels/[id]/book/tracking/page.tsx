
// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/header';
import { Agent, Hostel, getAgent, AppUser } from '@/lib/data';
import { notFound, useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Loader2, Home, BedDouble, Calendar, UserCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { MapboxMap } from '@/components/map';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

type Visit = {
    id: string;
    studentId: string;
    agentId: string | null;
    hostelId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    createdAt: string;
};

type OnlineAgent = {
    clientId: string;
    data: {
        id: string;
        fullName: string;
        email: string;
    }
}

export default function TrackingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { id: hostelId } = params;
    const visitId = searchParams.get('visitId');

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
    const [agentLiveLocation, setAgentLiveLocation] = useState<{ lat: number, lng: number} | undefined>(undefined);
    const agentGpsChannelRef = useRef<Types.RealtimeChannelPromise | null>(null);
    const [assigningAgent, setAssigningAgent] = useState<string | null>(null);

    useEffect(() => {
        if (!visitId || !hostelId) {
            notFound();
            return;
        }

        const unsubscribes: (() => void)[] = [];

        const fetchHostel = async () => {
            const hostelDocRef = doc(db, 'hostels', hostelId as string);
            const hostelSnap = await getDoc(hostelDocRef);
            if (hostelSnap.exists()) {
                const hostelData = {id: hostelSnap.id, ...hostelSnap.data()} as Hostel;
                setHostel(hostelData);
            } else {
                notFound();
            }
        };
        fetchHostel();

        const visitDocRef = doc(db, 'visits', visitId as string);

        const setupAgentGpsSubscription = async (agentId: string) => {
            if (agentGpsChannelRef.current) {
                agentGpsChannelRef.current.unsubscribe();
            }
            
            const agentDetails = await getAgent(agentId);
            setAgent(agentDetails);
            if(agentDetails?.location) {
                setAgentLiveLocation(agentDetails.location);
            }
            
            const channel = ably.channels.get(`agent:${agentId}:gps`);
            agentGpsChannelRef.current = channel;

            const subscribeCallback = (message: Types.Message) => {
                setAgentLiveLocation(message.data);
            };
            channel.subscribe('location', subscribeCallback);
            unsubscribes.push(() => channel.unsubscribe(subscribeCallback));
        };
        
        const unsubVisit = onSnapshot(visitDocRef, (docSnap) => {
            if (!docSnap.exists()) {
                notFound();
                return;
            }

            const visitData = { id: docSnap.id, ...docSnap.data() } as Visit;
            setVisit(visitData);
            setLoading(false);

            if (visitData.agentId) {
                // Agent is assigned, start tracking them
                if (!agent || agent.id !== visitData.agentId) {
                    setupAgentGpsSubscription(visitData.agentId);
                }
            } else {
                // No agent assigned, listen for online agents
                const presenceChannel = ably.channels.get('agents:live');
                const updateOnlineAgents = (agents: Types.PresenceMessage[]) => {
                     setOnlineAgents(agents.map(a => ({ clientId: a.clientId, data: a.data as any })));
                };

                // Get current agents and subscribe to future updates
                presenceChannel.presence.get().then(updateOnlineAgents);
                presenceChannel.presence.subscribe(['enter', 'leave'], () => {
                    presenceChannel.presence.get().then(updateOnlineAgents);
                });

                unsubscribes.push(() => presenceChannel.presence.unsubscribe());
            }
        });

        unsubscribes.push(unsubVisit);

        return () => {
            unsubscribes.forEach(unsub => unsub());
            if (agentGpsChannelRef.current) {
                agentGpsChannelRef.current.detach();
            }
        };
    }, [visitId, hostelId, agent]);
    
    const handleSelectAgent = async (selectedAgent: OnlineAgent) => {
        if (!visitId) return;
        setAssigningAgent(selectedAgent.clientId);
        toast({ title: 'Assigning Agent...', description: `Confirming your visit with ${selectedAgent.data.fullName}.` });

        try {
            const visitDocRef = doc(db, 'visits', visitId as string);
            await updateDoc(visitDocRef, {
                agentId: selectedAgent.clientId,
                status: 'accepted'
            });
            // The onSnapshot listener will then take over to display the tracking UI.
        } catch (error) {
            console.error("Failed to assign agent:", error);
            toast({ title: 'Assignment Failed', description: 'Could not assign agent. Please try again.', variant: 'destructive'});
            setAssigningAgent(null);
        }
    }


    const handleVisitComplete = async () => {
        if(visitId) {
            await updateDoc(doc(db, 'visits', visitId as string), { status: 'completed' });
            router.push(`/hostels/${hostelId}/book/rating`);
        }
    }
    
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
    
    const agentPhoneNumber = agent?.phone || '1234567890'; // Placeholder phone

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50/50">
                     <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                {visit.status === 'pending' && <><Loader2 className="h-6 w-6 animate-spin" /> Matching You With an Agent</>}
                                {visit.status === 'accepted' && <span className="text-green-600">✅ Visit Confirmed</span>}
                                {visit.status === 'completed' && <span className="text-blue-600">🎉 Visit Complete</span>}
                            </CardTitle>
                             <CardDescription>
                                {visit.status === 'pending' && "Please select an available agent to begin your tour."}
                                {visit.status === 'accepted' && agent && `Your agent, ${agent.name}, is on the way.`}
                                {visit.status === 'completed' && "Thank you for using HostelHQ!"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {visit.status === 'pending' && (
                                <div className="space-y-3">
                                    {onlineAgents.length > 0 ? (
                                        onlineAgents.map(agent => (
                                            <div key={agent.clientId} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarFallback>{agent.data.fullName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold">{agent.data.fullName}</p>
                                                        <p className="text-xs text-muted-foreground">Online</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => handleSelectAgent(agent)}
                                                    disabled={assigningAgent === agent.clientId}
                                                >
                                                    {assigningAgent === agent.clientId ? <Loader2 className="h-4 w-4 animate-spin"/> : "Choose"}
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground">No agents are available right now. Please check back shortly.</p>
                                        </div>
                                    )}
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
                                            <UserCheck className="h-5 w-5 text-muted-foreground"/>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Your Agent</p>
                                                <p className="font-semibold">{agent.name}</p>
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
                                    
                                    <Separator />
                                    
                                    <div className="flex w-full gap-2">
                                        <a href={`tel:${agentPhoneNumber}`} className="flex-1">
                                            <Button className="w-full" variant="outline"><Phone className="mr-2 h-4 w-4" /> Call Agent</Button>
                                        </a>
                                        <a href={`https://wa.me/${agentPhoneNumber}`} className="flex-1">
                                            <Button className="w-full" variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
                                        </a>
                                    </div>
                                     <Button className="w-full" onClick={handleVisitComplete}>Mark Visit as Complete</Button>
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
                   <MapboxMap agentLocation={agentLiveLocation} hostelLocation={hostel} />
                </div>
            </main>
        </div>
    );
}

