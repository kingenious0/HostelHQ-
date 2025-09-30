// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { hostels, agents } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Star, Loader2, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function TrackingPage({ params }: { params: { id: string } }) {
    const [status, setStatus] = useState('matching'); // matching, accepted
    const [matchedAgent, setMatchedAgent] = useState<typeof agents[0] | null>(null);
    const { id } = params;

    const hostel = hostels.find((h) => h.id === id);

    useEffect(() => {
        if (status === 'matching') {
            const matchingTimeout = setTimeout(() => {
                // Simulate finding and matching the first online agent
                const onlineAgent = agents.find(a => a.status === 'online');
                if (onlineAgent) {
                    setMatchedAgent(onlineAgent);
                    setStatus('accepted');
                }
            }, 5000); // 5-second delay to simulate matching

            return () => clearTimeout(matchingTimeout);
        }
    }, [status]);
    
    if (!hostel) {
        notFound();
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50">
                     <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">
                                {status === 'matching' && "Matching in Progress"}
                                {status === 'accepted' && "Agent on the way!"}
                            </CardTitle>
                             <CardDescription>
                                {status === 'matching' && "We're finding the best agent for your tour."}
                                {status === 'accepted' && `Your agent, ${matchedAgent?.name}, is heading to ${hostel.name}.`}
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
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage src={matchedAgent.imageUrl} alt={matchedAgent.name} />
                                            <AvatarFallback>{matchedAgent.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="text-lg font-bold">{matchedAgent.name}</h3>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Star className="h-4 w-4 mr-1 text-yellow-400 fill-yellow-400" />
                                                <span>{matchedAgent.rating.toFixed(1)} Rating</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <p><strong>ETA:</strong> 5 mins</p>
                                      <p><strong>Vehicle:</strong> {matchedAgent.vehicle}</p>
                                    </div>
                                    <Separator />
                                    <p className="text-sm text-muted-foreground">{`Agent ${matchedAgent.name} will call you via WhatsApp to confirm the exact meeting point.`}</p>
                                    <div className="flex w-full gap-2">
                                        <Button className="flex-1" variant="outline"><Phone className="mr-2 h-4 w-4" /> Call Agent</Button>
                                        <Button className="flex-1" variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> Message</Button>
                                    </div>
                                     <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                                        <UserCheck className="mr-2 h-4 w-4"/> Mark as Visited
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="relative bg-muted">
                    <Image src="https://picsum.photos/seed/map/1200/1200" alt="Map" fill style={{ objectFit: 'cover' }} className="opacity-50" data-ai-hint="street map" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-4 bg-background/80 rounded-lg shadow-lg">
                           <h2 className="text-lg font-semibold">Live Map</h2>
                           <p className="text-muted-foreground">Agent location will be displayed here.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
