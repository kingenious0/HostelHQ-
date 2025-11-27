// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/header';
import { Agent, Hostel, getAgent, AppUser, getHostel } from '@/lib/data';
import { notFound, useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, User, CheckCheck, Loader2, Calendar, Phone, MessageCircle, Navigation, Route, Home } from "lucide-react";
import { combinedRoutingService, RouteResult } from "@/components/mapbox-location-picker";
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { MapboxMap } from '@/components/map';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

type Visit = {
    id: string;
    studentId: string;
    agentId: string | null;
    hostelId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'scheduling';
    studentCompleted: boolean;
    agentCompleted?: boolean;
    createdAt: string;
    visitDate: string;
    visitTime: string;
    visitType?: 'agent' | 'self';
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
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCompleting, setIsCompleting] = useState(false);
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    const previousAgentCompletedRef = useRef<boolean | null>(null);

    // Directions state
    const [route, setRoute] = useState<RouteResult | null>(null);
    const [loadingDirections, setLoadingDirections] = useState(false);
    const [showDirections, setShowDirections] = useState(false);
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const isSelfVisit = visit?.visitType === 'self';

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!hostelId || !visitId) {
            notFound();
            return;
        }

        const unsubscribes: (() => void)[] = [];

        const fetchHostelData = async () => {
            const hostelData = await getHostel(hostelId as string);
            if (hostelData) {
                setHostel(hostelData);
            } else {
                notFound();
            }
        };
        fetchHostelData();
        
        const visitDocRef = doc(db, 'visits', visitId as string);

        const setupAgentDetails = (agentId: string) => {
            getAgent(agentId).then(agentDetails => {
                if (agentDetails) {
                    setAgent(agentDetails);
                }
            });
        };
        
        const unsubVisit = onSnapshot(visitDocRef, (docSnap) => {
            if (!docSnap.exists()) {
                toast({ title: "Visit Not Found", description: "The visit you are looking for does not exist.", variant: "destructive" });
                router.push('/');
                return;
            }

            const visitData = { id: docSnap.id, ...docSnap.data() } as Visit;

            const previousAgentCompleted = previousAgentCompletedRef.current ?? false;
            const currentAgentCompleted = !!visitData.agentCompleted;

            const storageKey = `visit_agentCompleted_notified_${visitData.id}`;
            const alreadyNotified = typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === '1';

            const justCompletedByAgent = !alreadyNotified && !previousAgentCompleted && currentAgentCompleted && !visitData.studentCompleted;

            if (justCompletedByAgent) {
                if (notificationAudioRef.current) {
                    console.log('Playing visit notification sound (student tracking)');
                    notificationAudioRef.current.play().catch((err) => {
                        console.error('Audio play failed:', err);
                    });
                }
                toast({
                    title: 'Agent marked your visit as complete',
                    description: 'Please confirm if you actually completed this tour.',
                });

                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(storageKey, '1');
                }
            }

            previousAgentCompletedRef.current = currentAgentCompleted;

            setVisit(visitData);
            setLoading(false);

            if (visitData.agentId && (!agent || agent.id !== visitData.agentId)) {
                setupAgentDetails(visitData.agentId);
            }
        });

        unsubscribes.push(unsubVisit);

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [visitId, hostelId, router, toast, agent]);
    

    const handleStudentComplete = async () => {
        if (!visitId) return;
        setIsCompleting(true);
        try {
            if (isSelfVisit) {
                await updateDoc(doc(db, 'visits', visitId as string), {
                    studentCompleted: true,
                    status: 'completed',
                });
                toast({
                    title: 'Visit Complete!',
                    description: 'Thank you for using HostelHQ. Please rate your experience.',
                });
                router.push(`/hostels/${hostelId}/book/rating?visitId=${visitId}`);
            } else {
                const currentAgentCompleted = visit?.agentCompleted;
                const updatePayload: Record<string, any> = { studentCompleted: true };
                if (currentAgentCompleted) {
                    updatePayload.status = 'completed';
                }
                await updateDoc(doc(db, 'visits', visitId as string), updatePayload);

                if (currentAgentCompleted) {
                    toast({
                        title: 'Visit Complete!',
                        description: 'Thank you for confirming. Please rate your experience.',
                    });
                    router.push(`/hostels/${hostelId}/book/rating?visitId=${visitId}`);
                } else {
                    toast({
                        title: 'Waiting for agent confirmation',
                        description: 'Your agent has been notified to confirm that this visit was truly completed.',
                    });
                }
            }
        } catch (error) {
            console.error('Failed to mark visit as complete:', error);
            toast({
                title: 'Update Failed',
                description: 'Could not mark visit as complete.',
                variant: 'destructive',
            });
        } finally {
            setIsCompleting(false);
        }
    }

    // Get directions to hostel
    const getDirections = async () => {
        if (!hostel?.lat || !hostel?.lng) {
            toast({
                title: 'Location Error',
                description: 'Hostel location not available.',
                variant: 'destructive',
            });
            return;
        }

        setLoadingDirections(true);
        
        try {
            // Get user's current location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    try {
                        const userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };

                        const hostelLocation = {
                            lat: hostel.lat,
                            lng: hostel.lng
                        };

                        console.log('🎯 Getting directions from', userLocation, 'to', hostelLocation);
                        
                        const routeResult = await combinedRoutingService.getDirections(
                            userLocation,
                            hostelLocation,
                            'walking' // Default to walking for students
                        );

                        setRoute(routeResult);
                        setShowDirections(true);
                        
                        toast({
                            title: `Directions via ${routeResult.provider}`,
                            description: `${combinedRoutingService.formatDistance(routeResult.distance)} • ${combinedRoutingService.formatDuration(routeResult.duration)}`,
                        });
                    } catch (error) {
                        console.error('Failed to get directions:', error);
                        toast({
                            title: 'Directions Failed',
                            description: 'Could not calculate route. Please try again.',
                            variant: 'destructive',
                        });
                    } finally {
                        setLoadingDirections(false);
                    }
                }, (error) => {
                    setLoadingDirections(false);
                    toast({
                        title: 'Location Access Denied',
                        description: 'Please enable location access to get directions.',
                        variant: 'destructive',
                    });
                });
            } else {
                setLoadingDirections(false);
                toast({
                    title: 'Location Not Supported',
                    description: 'Your browser does not support location services.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            setLoadingDirections(false);
            console.error('Directions error:', error);
        }
    };

    if (loading || !hostel || !visit) {
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
    
    const renderSelfVisitContent = () => {
        if (!hostel?.lat || !hostel?.lng) {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Loading hostel location...</p>
                </div>
            )
        }
        if (visit?.studentCompleted) {
            return (
                <div className="text-center py-8">
                    <CheckCheck className="h-10 w-10 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Your visit is complete. We hope you liked it!</p>
                    <Button onClick={() => router.push(`/hostels/${hostelId}/book/rating?visitId=${visit.id}`)}>Rate Your Visit</Button>
                </div>
            );
        }

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
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Location</p>
                            <p className="font-semibold">{hostel.location}</p>
                        </div>
                    </div>
                </div>
                <Button className="w-full" onClick={getDirections} disabled={loadingDirections}>
                    {loadingDirections ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting Directions...
                        </>
                    ) : (
                        <>
                            <Navigation className="mr-2 h-4 w-4" />
                            Get Live Directions
                        </>
                    )}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                    {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCheck className="mr-2 h-4 w-4" /> }
                    Mark Visit as Complete
                </Button>
                
                {/* Live Directions Display */}
                {showDirections && route && (
                    <Card className="mt-4">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Route className="h-5 w-5 text-green-600" />
                                Live Directions
                                <Badge variant="secondary" className="ml-auto">
                                    {route.provider}
                                </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {combinedRoutingService.formatDuration(route.duration)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {combinedRoutingService.formatDistance(route.distance)}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {route.instructions.map((instruction, index) => (
                                    <div key={index} className="flex gap-3 p-2 rounded-lg bg-muted/50">
                                        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm">{instruction}</span>
                                    </div>
                                ))}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full mt-3"
                                onClick={() => setShowDirections(false)}
                            >
                                Hide Directions
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        )
    }


    const renderAgentVisitContent = () => {
        if (!visit) return null;

        if (visit.status === 'scheduling') {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Your visit is being scheduled.</p>
                    <p className="text-sm text-muted-foreground mt-1">Please select an agent and time on the scheduling page.</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push(`/hostels/book/schedule?visitId=${visitId}`)}>
                        Go to Scheduling
                    </Button>
                </div>
            )
        }

        if (visit.status === 'pending' && agent) {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Waiting for {agent.fullName || 'Agent'} to accept...</p>
                    <p className="text-sm text-muted-foreground mt-1">You will be notified once they confirm your visit request.</p>
                </div>
            );
        }

        if (visit.status === 'accepted' && agent) {
            if (visit.studentCompleted && !visit.agentCompleted) {
                return (
                    <div className="text-center py-8">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                        <p className="font-semibold">Waiting for agent to confirm completion...</p>
                        <p className="text-sm text-muted-foreground mt-1">Your visit will be fully completed once your agent confirms.</p>
                    </div>
                );
            }

            if (visit.agentCompleted && !visit.studentCompleted) {
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

                        <p className="text-sm text-muted-foreground text-center">
                            Your agent has confirmed that the visit is complete. Please confirm your side to fully complete this visit.
                        </p>

                        <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCheck className="mr-2 h-4 w-4" />}
                            Mark Visit as Complete
                        </Button>
                    </div>
                );
            }

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
                    
                    
                    <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCheck className="mr-2 h-4 w-4" />}
                        Mark Visit as Complete
                    </Button>
                </div>
            );
        }

        if (visit.status === 'completed') {
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
                    <p className="text-muted-foreground mb-4">This request was cancelled or timed out.</p>
                    <Button variant="outline" onClick={() => router.push('/')}>Find Another Hostel</Button>
                </div>
            );
        }

        return <div className="text-center py-8"><p>Loading...</p></div>;
    }

    const getCardTitle = () => {
        if (isSelfVisit) return "Self-Guided Visit";
        if (!visit) return "Loading Visit...";
        if (visit.status === 'scheduling') return "Schedule Your Visit";
        if (visit.status === 'pending' && agent) return "Visit Request Pending";
        if (visit.status === 'accepted') return <span className="text-green-600">Visit Confirmed!</span>;
        if (visit.status === 'completed') return <span className="text-blue-600">Visit Complete</span>;
        if (visit.status === 'cancelled') return <span className="text-red-500">Visit Cancelled</span>;
        return "Visit Details";
    }
    
    const getCardDescription = () => {
        if (isSelfVisit) return "You've opted to visit the hostel by yourself. Use the map for navigation.";
        if (!visit) return "";
        if (visit.status === 'scheduling') return "Please select an agent and time to finalize your tour.";
        if (visit.status === 'pending' && agent) return `Waiting for ${agent.fullName} to accept your request.`;
        if (visit.status === 'accepted' && agent) return `Your tour with agent ${agent.fullName} is confirmed. Track their location here.`;
        if (visit.status === 'completed') return "Thank you for using HostelHQ!";
        if (visit.status === 'cancelled') return `This visit request was cancelled.`;
        return "";
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <audio ref={notificationAudioRef} src="/sounds/visit-notification.mp3" preload="auto" />
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
                            {isSelfVisit ? renderSelfVisitContent() : renderAgentVisitContent()}
                        </CardContent>
                    </Card>
                </div>
                <div className="relative bg-muted h-96 md:h-full">
                   <MapboxMap agentId={visit?.agentId} hostelLocation={hostel} />
                </div>
            </main>
        </div>
    );
}
