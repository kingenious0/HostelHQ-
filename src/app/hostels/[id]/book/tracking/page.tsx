// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/header';
import { hostels, agents, Agent } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Star, Loader2, UserCheck, Home, BedDouble, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function TrackingPage({ params }: { params: { id: string } }) {
    const { id } = use(params);
    const [status, setStatus] = useState('matching'); // matching, accepted
    const [matchedAgent, setMatchedAgent] = useState<Agent | null>(null);

    const hostel = hostels.find((h) => h.id === id);

    useEffect(() => {
        if (status === 'matching') {
            const matchingTimeout = setTimeout(async () => {
                // In a real app, you would fetch this from your backend/firestore
                const onlineAgents: Agent[] = agents.filter(a => a.status === 'online');
                if (onlineAgents.length > 0) {
                    // Simulate matching with the first online agent
                    setMatchedAgent(onlineAgents[0]);
                    setStatus('accepted');
                }
            }, 5000); // 5-second delay to simulate matching

            return () => clearTimeout(matchingTimeout);
        }
    }, [status]);
    
    if (!hostel) {
        notFound();
    }

    const agentPhoneNumber = matchedAgent?.phone || '1234567890'; // Placeholder phone

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50/50">
                     <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                {status === 'matching' && <><Loader2 className="h-6 w-6 animate-spin" /> Matching in Progress</>}
                                {status === 'accepted' && <span className="text-green-600">✅ Visit Confirmed</span>}
                            </CardTitle>
                             <CardDescription>
                                {status === 'matching' && "We're finding the best agent for your tour."}
                                {status === 'accepted' && matchedAgent && `Your agent, ${matchedAgent.name}, is heading to the hostel.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {status === 'matching' && (
                                <div className="flex flex-col items-center justify-center text-center py-8">
                                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                                    <p className="text-muted-foreground">Searching for available agents...</p>
                                </div>
                            )}
                            {status === 'accepted' && matchedAgent && (
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
                                                <p className="font-semibold">Room 12A (4-in-a-room)</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-muted-foreground"/>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Date</p>
                                                <p className="font-semibold">15 Sept 2025 – 14:00</p>
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
                                     <Button className="w-full" disabled>
                                        Agent has arrived
                                    </Button>
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