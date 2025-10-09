
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Eye, Clock, Check, X, BedDouble, CalendarCheck } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';

type Visit = {
    id: string;
    hostelId: string;
    agentId: string | null;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    visitDate: string;
    visitTime: string;
};

type EnrichedVisit = Visit & {
    hostelName: string;
    agentName: string | null;
};

type Booking = {
    id: string;
    hostelId: string;
    hostelName: string;
    bookingDate: string;
    paymentReference: string;
}

export default function MyVisitsPage() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [myBookings, setMyBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
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

        // Listener for Visits
        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));
        const unsubscribeVisits = onSnapshot(visitsQuery, async (querySnapshot) => {
            const visitsData: Visit[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit));

            const enrichedVisits = await Promise.all(visitsData.map(async (visit) => {
                let hostelName = 'Unknown Hostel';
                let agentName: string | null = null;
                try {
                    const hostelRef = doc(db, 'hostels', visit.hostelId);
                    const hostelSnap = await getDoc(hostelRef);
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
            setMyVisits(enrichedVisits);
            setLoading(false);
        });

        // Listener for Bookings (secured rooms)
        const bookingsQuery = query(collection(db, "bookings"), where("studentId", "==", currentUser.uid));
        const unsubscribeBookings = onSnapshot(bookingsQuery, async (querySnapshot) => {
            const bookingsData = await Promise.all(querySnapshot.docs.map(async (docData) => {
                const booking = docData.data();
                let hostelName = 'Unknown Hostel';
                try {
                    const hostelRef = doc(db, 'hostels', booking.hostelId);
                    const hostelSnap = await getDoc(hostelRef);
                    if (hostelSnap.exists()) hostelName = hostelSnap.data().name;
                } catch (e) { console.error("Error fetching hostel for booking", e); }
                return {
                    id: docData.id,
                    hostelName,
                    ...booking
                } as Booking;
            }));
            setMyBookings(bookingsData);
        });


        return () => {
            unsubscribeVisits();
            unsubscribeBookings();
        };

    }, [currentUser, toast]);
    
    const getStatusInfo = (status: Visit['status']): { variant: "default" | "secondary" | "outline" | "destructive", icon: React.ReactNode, text: string } => {
        switch (status) {
            case 'completed': return { variant: 'default', icon: <Check className="h-3 w-3" />, text: 'Completed' };
            case 'accepted': return { variant: 'secondary', icon: <Check className="h-3 w-3" />, text: 'Accepted' };
            case 'pending': return { variant: 'outline', icon: <Clock className="h-3 w-3" />, text: 'Pending' };
            case 'cancelled': return { variant: 'destructive', icon: <X className="h-3 w-3" />, text: 'Cancelled' };
            default: return { variant: 'outline', icon: <Clock className="h-3 w-3" />, text: 'Pending' };
        }
    };

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
                            <CardTitle className="text-2xl font-headline">My Visits</CardTitle>
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
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Date &amp; Time</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myVisits.length &gt; 0 ? (
                                            myVisits.map(visit => {
                                                const statusInfo = getStatusInfo(visit.status);
                                                return (
                                                <TableRow key={visit.id}>
                                                    <TableCell className="font-medium">{visit.hostelName}</TableCell>
                                                    <TableCell>{visit.agentName || 'Awaiting agent...'}</TableCell>
                                                     <TableCell>
                                                        {format(new Date(visit.visitDate), "PPP")} at {visit.visitTime}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusInfo.variant} className="capitalize flex items-center gap-1.5">
                                                            {statusInfo.icon}
                                                            {statusInfo.text}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/hostels/${visit.hostelId}/book/tracking?visitId=${visit.id}`}>
                                                            <Button variant="outline" size="sm">
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View
                                                            </Button>
                                                        </Link>
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

                     <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline flex items-center gap-2"><BedDouble className="text-primary"/>My Secured Bookings</CardTitle>
                            <CardDescription>A record of the hostel rooms you have successfully booked and paid for.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hostel</TableHead>
                                        <TableHead>Booking Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myBookings.length &gt; 0 ? (
                                        myBookings.map(booking => (
                                            <TableRow key={booking.id}>
                                                <TableCell className="font-medium">{booking.hostelName}</TableCell>
                                                <TableCell>{format(new Date(booking.bookingDate), "PPP")}</TableCell>
                                                <TableCell>
                                                    <Badge className="capitalize flex items-center gap-1.5">
                                                        <CalendarCheck className="h-3 w-3" />
                                                        Room Secured
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">
                                                You have no secured bookings.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

    