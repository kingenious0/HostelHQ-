
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Eye, Clock, Check, X, Navigation, User as UserIcon, FileText } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, isValid } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

type Booking = {
    id: string;
    hostelId: string;
    hostelName?: string;
    bookingDate: string;
    paymentReference: string;
}

export default function MyBookingsAndVisitsPage() {
    const [myVisits, setMyVisits] = useState<EnrichedVisit[]>([]);
    const [myBookings, setMyBookings] = useState<Booking[]>([]);
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

        // --- Fetch Visits ---
        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));
        const unsubscribeVisits = onSnapshot(visitsQuery, async (querySnapshot) => {
            const visitsData: Visit[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit));

            const enrichedVisits = await Promise.all(visitsData.map(async (visit) => {
                let hostelName = 'Unknown Hostel';
                let agentName: string | null = null;
                try {
                    const hostelSnap = await getDoc(doc(db, 'hostels', visit.hostelId));
                    if (hostelSnap.exists()) hostelName = hostelSnap.data().name;
                } catch (e) { console.error("Error fetching hostel", e); }
                
                if (visit.agentId) {
                    try {
                        const agentSnap = await getDoc(doc(db, 'users', visit.agentId));
                        if (agentSnap.exists()) agentName = agentSnap.data().fullName;
                    } catch (e) { console.error("Error fetching agent", e); }
                }
                return { ...visit, hostelName, agentName };
            }));
            
            const sortedVisits = enrichedVisits.sort((a,b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
            setMyVisits(sortedVisits);
        });

        // --- Fetch Bookings ---
        const bookingsQuery = query(collection(db, "bookings"), where("studentId", "==", currentUser.uid));
        const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
            const bookingsData = await Promise.all(snapshot.docs.map(async (d) => {
                const data = d.data();
                const hostelSnap = await getDoc(doc(db, 'hostels', data.hostelId));
                
                let date;
                if (data.bookingDate instanceof Timestamp) {
                    date = data.bookingDate.toDate();
                } else if (typeof data.bookingDate === 'string') {
                    date = new Date(data.bookingDate);
                } else {
                    date = new Date(); // fallback
                }

                return {
                    id: d.id,
                    hostelId: data.hostelId,
                    hostelName: hostelSnap.exists() ? hostelSnap.data().name : 'Unknown Hostel',
                    bookingDate: date.toLocaleDateString(),
                    paymentReference: data.paymentReference
                } as Booking;
            }));
            setMyBookings(bookingsData);
        });


        Promise.all([visitsQuery, bookingsQuery]).then(() => setLoading(false));


        return () => {
            unsubscribeVisits();
            unsubscribeBookings();
        };
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
                            You must be logged in as a Student to view your bookings and visits.
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
                            <CardTitle className="text-2xl font-headline">My Bookings & Visits</CardTitle>
                            <CardDescription>Track your confirmed room bookings and hostel visit requests.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Tabs defaultValue="bookings">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="bookings">Confirmed Bookings ({myBookings.length})</TabsTrigger>
                                    <TabsTrigger value="visits">Visit Requests ({myVisits.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="bookings">
                                    {loading ? <Loader2 className="mt-8 mx-auto h-8 w-8 animate-spin text-muted-foreground"/> : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Hostel</TableHead>
                                                    <TableHead>Booking Date</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {myBookings.length > 0 ? (
                                                    myBookings.map(booking => (
                                                        <TableRow key={booking.id}>
                                                            <TableCell className="font-medium">{booking.hostelName}</TableCell>
                                                            <TableCell>{booking.bookingDate}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="outline" size="sm" onClick={() => router.push(`/agreement/${booking.id}`)}>
                                                                    <FileText className="mr-2 h-4 w-4" />
                                                                    View Agreement
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center h-24">
                                                            You have no confirmed hostel bookings.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    )}
                                </TabsContent>
                                <TabsContent value="visits">
                                    {loading ? <Loader2 className="mt-8 mx-auto h-8 w-8 animate-spin text-muted-foreground"/> : (
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
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
