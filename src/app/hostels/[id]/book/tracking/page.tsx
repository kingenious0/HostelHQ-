
// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/header';
import { Agent, Hostel, getAgent, AppUser } from '@/lib/data';
import { notFound, useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Loader2, Home, UserCheck, Calendar, Clock, MapPin, CheckCheck, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { MapboxMap } from '@/components/map';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Visit = {
    id: string;
    studentId: string;
    agentId: string | null;
    hostelId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    studentCompleted: boolean;
    createdAt: string;
    visitDate: string;
    visitTime: string;
};

type OnlineAgent = {
    clientId: string;
    data: {
        id: string;
        fullName: string;
        email: string;
    }
}

async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
    if (!accessToken) return "Location details unavailable";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=address&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            return data.features[0].place_name;
        }
        return "Tracking agent...";
    } catch (error) {
        console.error("Error fetching address:", error);
        return "Could not fetch address";
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
    const [agentLiveAddress, setAgentLiveAddress] = useState<string | null>(null);
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

        const setupAgentGpsSubscription = (agentId: string) => {
            if (agentGpsChannelRef.current && agentGpsChannelRef.current.name.includes(agentId)) {
                return; // Already subscribed to this agent
            }
            if (agentGpsChannelRef.current) {
                agentGpsChannelRef.current.unsubscribe(); // Unsubscribe from old agent
            }
            
            getAgent(agentId).then(agentDetails => {
                if (agentDetails) {
                    setAgent(agentDetails);
                    if(agentDetails.location) {
                        setAgentLiveLocation(agentDetails.location);
                         getAddressFromCoordinates(agentDetails.location.lat, agentDetails.location.lng).then(setAgentLiveAddress);
                    }
                }
            });
            
            const channel = ably.channels.get(`agent:${agentId}:gps`);
            agentGpsChannelRef.current = channel;

            const subscribeCallback = (message: Types.Message) => {
                setAgentLiveLocation(message.data);
                getAddressFromCoordinates(message.data.lat, message.data.lng).then(setAgentLiveAddress);
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
                setupAgentGpsSubscription(visitData.agentId);
            } else if (!visitData.agentId) {
                // No agent assigned yet, listen for online agents
                const presenceChannel = ably.channels.get('agents:live');
                const updateOnlineAgents = (agents: Types.PresenceMessage[]) => {
                     const filteredAgents = agents
                        .map(a => ({ clientId: a.clientId, data: a.data as any }))
                        .filter(a => a.data && a.data.email !== 'admin@hostelhq.com'); // Exclude admin
                     setOnlineAgents(filteredAgents);
                };

                const setupPresenceListener = async () => {
                    await presenceChannel.presence.subscribe(['enter', 'present', 'leave'], () => {
                         presenceChannel.presence.get().then(updateOnlineAgents);
                    });
                    const initialAgents = await presenceChannel.presence.get();
                    updateOnlineAgents(initialAgents);
                };

                setupPresenceListener();

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
    }, [visitId, hostelId]);
    
    const handleSelectAgent = async (selectedAgent: OnlineAgent) => {
        if (!visitId) return;
        setAssigningAgent(selectedAgent.clientId);
        toast({ title: 'Assigning Agent...', description: `Your request has been sent to ${selectedAgent.data.fullName}. Please wait for them to accept.` });

        try {
            const visitDocRef = doc(db, 'visits', visitId as string);
            await updateDoc(visitDocRef, {
                agentId: selectedAgent.data.id
            });
        } catch (error) {
            console.error("Failed to assign agent:", error);
            toast({ title: 'Assignment Failed', description: 'Could not assign agent. Please try again.', variant: 'destructive'});
            setAssigningAgent(null);
        }
    }


    const handleVisitComplete = async () => {
        if(visitId) {
            await updateDoc(doc(db, 'visits', visitId as string), { studentCompleted: true });
            toast({ title: "Visit Complete!", description: "Thank you for using HostelHQ. Please rate your experience."});
            router.push(`/hostels/${hostelId}/book/rating?visitId=${visitId}`);
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

    const renderContent = () => {
        if (!visit.agentId) { // Step 1: No agent assigned, student needs to pick one
            return (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">AVAILABLE AGENTS</h3>
                    {onlineAgents.length > 0 ? (
                        onlineAgents.map(onlineAgent => (
                            <div key={onlineAgent.clientId} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarFallback>{onlineAgent.data.fullName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{onlineAgent.data.fullName}</p>
                                        <p className="text-xs text-green-600">Online</p>
                                    </div>
                                </div>
                                <Button 
                                    size="sm" 
                                    onClick={() => handleSelectAgent(onlineAgent)}
                                    disabled={assigningAgent === onlineAgent.clientId}
                                >
                                    {assigningAgent === onlineAgent.clientId ? <Loader2 className="h-4 w-4 animate-spin"/> : "Select Agent"}
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No agents are available right now. Please check back shortly.</p>
                        </div>
                    )}
                </div>
            );
        }

        if (visit.status === 'pending' && agent) { // Step 2: Agent assigned, waiting for their acceptance
            return (
                <div className="text-center py-8">
                     <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Waiting for {agent.fullName || 'Agent'} to accept...</p>
                    <p className="text-sm text-muted-foreground mt-1">You will be notified once they confirm your visit request.</p>
                </div>
            );
        }

        if (visit.status === 'accepted' && agent) { // Step 3: Agent accepted, show tracking and details
            return (
                 <div className="space-y-4">
                    <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4">
                        <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 text-muted-foreground mt-1"/>
                            <div>
                                <p className="text-sm text-muted-foreground">Hostel</p>
                                <p className="font-semibold">{hostel.name}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <UserCheck className="h-5 w-5 text-muted-foreground mt-1"/>
                            <div>
                                <p className="text-sm text-muted-foreground">Your Agent</p>
                                <p className="font-semibold">{agent.fullName}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-1"/>
                            <div>
                                <p className="text-sm text-muted-foreground">Agent's Location</p>
                                <p className="font-semibold">{agentLiveAddress || "Tracking agent..."}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground mt-1"/>
                                <div>
                                    <p className="text-sm text-muted-foreground">Date</p>
                                    <p className="font-semibold">{format(new Date(visit.visitDate), "PPP")}</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-muted-foreground mt-1"/>
                                <div>
                                    <p className="text-sm text-muted-foreground">Time</p>
                                    <p className="font-semibold">{visit.visitTime}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex w-full gap-2">
                        <a href={`tel:${agentPhoneNumber}`} className="flex-1">
                            <Button className="w-full" variant="outline"><Phone className="mr-2 h-4 w-4" /> Call Agent</Button>
                        </a>
                        <a href={`https://wa.me/${agentPhoneNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button className="w-full" variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
                        </a>
                    </div>
                     <Button variant="destructive" className="w-full" onClick={handleVisitComplete} disabled={visit.studentCompleted}>
                        {visit.studentCompleted ? "Waiting for Agent to Confirm" : "Mark Visit as Complete"}
                     </Button>
                </div>
            );
        }

        if (visit.status === 'completed') { // Step 4: Visit is done
             return (
                <div className="text-center py-8">
                    <CheckCheck className="h-10 w-10 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Your visit is complete. We hope you liked it!</p>
                    <Button onClick={() => router.push(`/hostels/${hostelId}/book/rating?visitId=${visit.id}`)}>Rate Your Visit</Button>
                </div>
            );
        }
        
        if (visit.status === 'cancelled') {
             return (
                <div className="text-center py-8">
                    <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
                    <p className="font-semibold">Visit Cancelled</p>
                    <p className="text-muted-foreground mb-4">This visit request was cancelled.</p>
                    <Button variant="outline" onClick={() => router.push('/')}>Find Another Hostel</Button>
                </div>
            );
        }

        return <div className="text-center py-8"><p>Loading...</p></div>;
    }

    const getCardTitle = () => {
        if (!visit.agentId) return "Select an Agent";
        if (visit.status === 'pending' && agent) return `Request Sent to ${agent.fullName}`;
        if (visit.status === 'accepted') return <span className="text-green-600">Your visit with {agent?.fullName} is confirmed!</span>;
        if (visit.status === 'completed') return <span className="text-blue-600">🎉 Visit Complete</span>;
        if (visit.status === 'cancelled') return <span className="text-red-500">Visit Cancelled</span>;
        return "Visit Details";
    }
    
    const getCardDescription = () => {
        if (!visit.agentId) return "Please select an available agent to begin your tour.";
        if (visit.status === 'pending' && agent) return `Waiting for ${agent.fullName} to accept your request.`;
        if (visit.status === 'accepted' && agent) return `Your tour with agent ${agent.fullName} is confirmed.`;
        if (visit.status === 'completed') return "Thank you for using HostelHQ!";
        if (visit.status === 'cancelled') return `The request was cancelled by the agent or timed out.`;
        return "";
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50/50">
                     <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                {getCardTitle()}
                            </CardTitle>
                             <CardDescription>
                                {getCardDescription()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderContent()}
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

