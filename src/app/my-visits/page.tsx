
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Eye, Clock, Check, X, Navigation, User as UserIcon } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, isValid } from 'date-fns';

type Visit = {
    id: string;
    hostelId: string;
    agentId: string | null;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'scheduling';
    visitDate: string;
    visitTime: string;
    visitType: 'agent' | 'self';
    studentCompleted: boolean;
};

type EnrichedVisit = Visit & {
    hostelName: string;
    agentName: string | null;
};

export default function MyVisitsPage() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
            if (!user) {
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);

        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));
        const unsubscribeVisits = onSnapshot(visitsQuery, async (querySnapshot) => {
            const visitsData: Visit[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit));

            const enrichedVisits = await Promise.all(visitsData.map(async (visit) => {
                let hostelName = 'Unknown Hostel';
                let agentName: string | null = null;
                try {
                    let hostelRef = doc(db, 'hostels', visit.hostelId);
                    let hostelSnap = await getDoc(hostelRef);
                    if (!hostelSnap.exists()) {
                        hostelRef = doc(db, 'pendingHostels', visit.hostelId);
                        hostelSnap = await getDoc(hostelRef);
                    }
                    if (hostelSnap.exists()) hostelName = hostelSnap.data().name;

                } catch (e) { console.error("Error fetching hostel", e); }
                
                if (visit.agentId) {
                    try {
                        const agentRef = doc(db, 'users', visit.agentId);
                        const agentSnap = await getDoc(agentRef);
                        if (agentSnap.exists()) agentName = agentSnap.data().fullName;
                    } catch (e) { console.error("Error fetching agent", e); }
                }
                return { ...visit, hostelName, agentName };
            }));
            
            const sorted = enrichedVisits.sort((a,b) => {
                const dateA = new Date(a.visitDate);
                const dateB = new Date(b.visitDate);
                if (isValid(dateA) && isValid(dateB)) {
                    return dateB.getTime() - dateA.getTime();
                }
                return 0;
            });
            setMyVisits(sorted);
            setLoading(false);
        });

        return () => unsubscribeVisits();
    }, [currentUser, toast]);
    
    const getStatusInfo = (visit: EnrichedVisit): { variant: "default" | "secondary" | "outline" | "destructive", icon: React.ReactNode, text: string } => {
        if (visit.status === 'completed' || visit.studentCompleted) return { variant: 'default', icon: <Check className="h-3 w-3" />, text: 'Completed' };
        if (visit.status === 'cancelled') return { variant: 'destructive', icon: <X className="h-3 w-3" />, text: 'Cancelled' };
        if (visit.status === 'accepted') return { variant: 'secondary', icon: <Check className="h-3 w-3" />, text: 'Accepted' };
        if (visit.status === 'pending') return { variant: 'outline', icon: <Clock className="h-3 w-3" />, text: 'Pending Agent' };
        if (visit.status === 'scheduling') return { variant: 'outline', icon: <Clock className="h-3 w-3" />, text: 'Needs Scheduling' };
        return { variant: 'outline', icon: <Clock className="h-3 w-3" />, text: 'Unknown' };
    };

    const getActionForVisit = (visit: EnrichedVisit) => {
        const url = visit.status === 'scheduling' 
            ? `/hostels/book/schedule?visitId=${visit.id}`
            : `/hostels/${visit.hostelId}/book/tracking?visitId=${visit.id}`;
        
        const buttonText = visit.status === 'scheduling' ? 'Schedule Visit' : 'View Details';

        return (
             <Button variant="outline" size="sm" onClick={() => router.push(url)}>
                <Eye className="mr-2 h-4 w-4" />
                {buttonText}
            </Button>
        )
    }

    if (loadingAuth) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Student to view your visits.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
                <div className="container mx-auto space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline">My Hostel Visits</CardTitle>
                            <CardDescription>Track your upcoming and past hostel visit requests.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <p className="ml-4 text-muted-foreground">Loading your visits...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hostel</TableHead>
                                            <TableHead>Visit Type</TableHead>
                                            <TableHead>Date &amp; Time</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myVisits.length > 0 ? (
                                            myVisits.map(visit => {
                                                const statusInfo = getStatusInfo(visit);
                                                const visitDate = new Date(visit.visitDate);
                                                return (
                                                <TableRow key={visit.id}>
                                                    <TableCell className="font-medium">{visit.hostelName}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={visit.visitType === 'agent' ? 'outline' : 'secondary'} className="capitalize flex items-center gap-1.5">
                                                            {visit.visitType === 'agent' ? <UserIcon className="h-3 w-3" /> : <Navigation className="h-3 w-3" />}
                                                            {visit.visitType === 'agent' ? `Agent: ${visit.agentName || 'Pending'}` : 'Self Visit'}
                                                        </Badge>
                                                    </TableCell>
                                                     <TableCell>
                                                        {isValid(visitDate) ? `${format(visitDate, "PPP")} at ${visit.visitTime}` : 'Not Scheduled'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusInfo.variant} className="capitalize flex items-center gap-1.5">
                                                            {statusInfo.icon}
                                                            {statusInfo.text}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {getActionForVisit(visit)}
                                                    </TableCell>
                                                </TableRow>
                                                )
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    You haven't booked any visits yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
