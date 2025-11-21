// src/app/hostels/book/schedule/page.tsx
"use client";

import * as React from 'react';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Agent = {
    id: string;
    fullName: string;
    email: string;
    status: 'Online' | 'Offline';
    offlineSmsOptIn?: boolean;
};

type OnlineAgentData = {
    id: string;
    fullName: string;
    email: string;
}

// --- 1. Custom Hook to Get Agent Online Status (Real-Time) ---
function useAgentPresence(): { agents: Agent[], loading: boolean } {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const subscriptionRef = React.useRef<any>(null);

    useEffect(() => {
        const presenceChannel = ably.channels.get('agents:live');

        const updatePresence = async () => {
            const allAgentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'agent')));
            const allAgents = allAgentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as {id: string, fullName: string, email: string, offlineSmsOptIn?: boolean}));
            
            const presentMembers = await presenceChannel.presence.get();
            const presentAgentIds = new Set(presentMembers.map(m => (m.data as OnlineAgentData).id));

            const agentsWithStatus = allAgents
                .filter(agent => agent.email !== 'admin@hostelhq.com') // Exclude admin
                .map(agent => ({
                    ...agent,
                    status: presentAgentIds.has(agent.id) ? 'Online' : 'Offline',
                } as Agent));
            
            setAgents(agentsWithStatus.sort((a, b) => (a.status === 'Online' ? -1 : 1)));
            setLoading(false);
        };
        
        updatePresence(); // Initial fetch
        
        presenceChannel.presence.subscribe(['enter', 'leave'], updatePresence).then(sub => {
            subscriptionRef.current = sub;
        }).catch(err => {
            console.error("Error subscribing to presence:", err);
        });

        return () => {
            if (subscriptionRef.current) {
                try {
                    subscriptionRef.current.unsubscribe();
                } catch (err) {
                    console.error("Error unsubscribing:", err);
                }
            }
        };

    }, []);

    return { agents, loading };
}


// --- 2. Main Scheduling Component ---
function SchedulingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const visitId = searchParams.get('visitId');
    const { toast } = useToast();

    const { agents, loading } = useAgentPresence();

    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (!visitId) {
            toast({ title: "Error", description: "Visit ID is missing from URL.", variant: "destructive" });
            router.push('/');
        }
    }, [visitId, router, toast]);


    const handleScheduleSubmit = async () => {
        if (!selectedAgent || !visitId) {
            toast({ title: "Missing Information", description: "Please select an available agent.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        toast({title: "Scheduling Visit..."});

        try {
            const visitRef = doc(db, 'visits', visitId);
            const visitSnap = await getDoc(visitRef);
            const visitData = visitSnap.data();
            const hostelId = visitData?.hostelId;
            const studentId = visitData?.studentId;

            // Update visit with agent assignment only; keep original date/time
            await updateDoc(visitRef, {
                agentId: selectedAgent.id,
                status: 'pending' // Move to pending for agent to accept
            });

            // Get student and hostel info for SMS
            let studentName = 'A student';
            let hostelName = 'a hostel';

            try {
                if (studentId) {
                    const studentDoc = await getDoc(doc(db, 'users', studentId));
                    if (studentDoc.exists()) {
                        studentName = studentDoc.data().fullName || studentName;
                    }
                }
                if (hostelId) {
                    const hostelDoc = await getDoc(doc(db, 'hostels', hostelId));
                    if (hostelDoc.exists()) {
                        hostelName = hostelDoc.data().name || hostelName;
                    }
                }
            } catch (error) {
                console.error('Error fetching student/hostel info:', error);
            }

            // Send SMS notification to agent
            try {
                // Get agent's phone number
                const agentDoc = await getDoc(doc(db, 'users', selectedAgent.id));
                if (agentDoc.exists()) {
                    const agentData = agentDoc.data();
                    const agentPhone = agentData.phoneNumber;

                    if (agentPhone) {
                        let visitDateFormatted = 'a scheduled date';
                        const visitDateIso = visitData?.visitDate as string | undefined;
                        const existingVisitTime = (visitData?.visitTime as string | undefined) || '';
                        if (visitDateIso) {
                            visitDateFormatted = new Date(visitDateIso).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            });
                        }

                        // Get base URL - use current origin since this is client-side code
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        const dashboardUrl = `${baseUrl}/agent/dashboard`;

                        const message = `🔔 NEW VISIT REQUEST!\n\n${studentName} wants to visit ${hostelName} on ${visitDateFormatted}${existingVisitTime ? ` at ${existingVisitTime}` : ''}.\n\n👉 Open your dashboard: ${dashboardUrl}\n\nLog in to accept or decline this request.`;

                        const smsResponse = await fetch('/api/sms/send-notification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                phoneNumber: agentPhone,
                                message: message,
                            }),
                        });

                        if (!smsResponse.ok) {
                            console.error('Failed to send SMS notification');
                            // Don't block the booking if SMS fails
                        }
                    }
                }
            } catch (smsError) {
                console.error('Error sending SMS notification:', smsError);
                // Don't block the booking if SMS fails
            }

            toast({title: "Request Sent!", description: `Your visit request has been sent to ${selectedAgent.fullName}.`});
            router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitId}`);

        } catch (error) {
             console.error("Scheduling error:", error);
             toast({ title: "Scheduling Failed", description: "Could not save your schedule. Please try again.", variant: "destructive"});
             setIsSubmitting(false);
        }
    };
    
    if (!visitId) {
        return <LoaderState message="Invalid visit ID..." />;
    }

    return (
        <Card className="w-full max-w-4xl shadow-xl">
            <CardHeader>
                <CardTitle className="text-3xl font-bold font-headline">Select an Agent & Schedule Your Visit</CardTitle>
                <CardDescription>Your payment is confirmed. Now choose an agent to finalize your viewing date and time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h3 className="font-semibold mb-4">1. Choose an available agent</h3>
                     {loading ? <Loader2 className="animate-spin" /> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {agents.map(agent => (
                                <button key={agent.id}
                                    onClick={() => setSelectedAgent(agent)}
                                    disabled={agent.status === 'Offline' && !agent.offlineSmsOptIn}
                                    className={cn(
                                        "p-4 border rounded-lg flex items-center gap-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                        selectedAgent?.id === agent.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent/50"
                                    )}
                                >
                                     <Avatar>
                                        <AvatarFallback>{agent.fullName.charAt(0)}</AvatarFallback>
                                     </Avatar>
                                     <div className="flex-1">
                                        <p className="font-medium">{agent.fullName}</p>
                                        <p className={`text-sm font-semibold ${agent.status === 'Online' ? 'text-green-600' : 'text-red-500'}`}>
                                            {agent.status}
                                            {agent.status === 'Offline' && agent.offlineSmsOptIn && ' ||    This agent accepts offline requests.'}
                                        </p>
                                    </div>
                                </button>
                             ))}
                         </div>
                     )}
                </div>

                {selectedAgent && (
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <h2 className="font-semibold mb-1 align-center">Please Note</h2>
                        {selectedAgent.status === 'Online' ? (
                            <p>Your selected agent is currently online and will receive this request immediately.</p>
                        ) : selectedAgent.offlineSmsOptIn ? (
                            <p>Your selected agent is currently offline but allows offline requests. An SMS will be sent so they can log in and accept or decline your visit.</p>
                        ) : (
                            <p>This agent is currently unavailable.</p>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button className="w-full" onClick={handleScheduleSubmit} disabled={!selectedAgent || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Send Visit Request
                 </Button>
            </CardFooter>
        </Card>
    );
}

// --- 3. Page Wrapper Component ---
export default function AgentSchedulingPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Suspense fallback={<LoaderState message="Loading Agent Data..." />}>
                    <SchedulingContent />
                </Suspense>
            </main>
        </div>
    );
}

// Helper Loader Component
function LoaderState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">{message}</h1>
        </div>
    );
}
