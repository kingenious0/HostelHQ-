
"use client";

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, DollarSign, Home, BarChart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { Hostel, RoomType } from '@/lib/data';
import { BookingsChart } from '@/components/bookings-chart';
import { format } from 'date-fns';

type ManagerHostel = Pick<Hostel, 'id' | 'name' | 'availability'> & {
    roomTypes: Pick<RoomType, 'price'>[];
};

type Booking = {
    hostelId: string;
    roomTypeId?: string; // This might not exist on old bookings
    bookingDate: Timestamp;
};


export default function ManagerDashboard() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [hostels, setHostels] = useState<ManagerHostel[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [chartData, setChartData] = useState<{ month: string; bookings: number }[]>([]);
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) {
            if (!loadingAuth) setLoadingData(false);
            return;
        }

        setLoadingData(true);
        const hostelsQuery = query(collection(db, 'hostels'), where('agentId', '==', currentUser.uid));
        
        const unsubscribeHostels = onSnapshot(hostelsQuery, async (snapshot) => {
            const fetchedHostels = await Promise.all(snapshot.docs.map(async (doc) => {
                const roomTypesSnap = await getDocs(collection(doc.ref, 'roomTypes'));
                const roomTypes = roomTypesSnap.docs.map(rtDoc => rtDoc.data() as RoomType);
                return { id: doc.id, ...doc.data(), roomTypes } as ManagerHostel;
            }));
            
            setHostels(fetchedHostels);

            if (fetchedHostels.length > 0) {
                const hostelIds = fetchedHostels.map(h => h.id);
                const bookingsQuery = query(collection(db, 'bookings'), where('hostelId', 'in', hostelIds));
                
                const unsubscribeBookings = onSnapshot(bookingsQuery, (bookingSnapshot) => {
                    const fetchedBookings = bookingSnapshot.docs.map(bDoc => bDoc.data() as Booking);
                    setBookings(fetchedBookings);
                    
                    // Process data for the chart
                    const monthlyBookings = new Array(12).fill(0);
                    fetchedBookings.forEach(booking => {
                        if (booking.bookingDate) {
                            const month = booking.bookingDate.toDate().getMonth();
                            monthlyBookings[month]++;
                        }
                    });

                    const currentYearMonths = Array.from({length: 12}, (_, i) => format(new Date(0, i), 'MMM'));

                    setChartData(currentYearMonths.map((month, index) => ({
                        month,
                        bookings: monthlyBookings[index]
                    })));

                    setLoadingData(false);
                });
                 return () => unsubscribeBookings();
            } else {
                 setLoadingData(false);
            }
        });

        return () => unsubscribeHostels();

    }, [currentUser, loadingAuth]);


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
    
    if (!currentUser || !currentUser.email?.endsWith('@manager.hostelhq.com')) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                     <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Hostel Manager to view this page.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((acc, booking) => {
        const hostel = hostels.find(h => h.id === booking.hostelId);
        // This is a simplification. A real app would store the price in the booking document.
        // We'll just take the price of the first room type as a fallback.
        const price = hostel?.roomTypes[0]?.price || 0;
        return acc + price;
    }, 0);
    
    const availabilityVariant: Record<Hostel['availability'], "default" | "secondary" | "destructive"> = {
        'Available': 'default',
        'Limited': 'secondary',
        'Full': 'destructive'
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
                <div className="container mx-auto">
                    <h1 className="text-3xl font-bold font-headline mb-6">Manager Dashboard</h1>

                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">GH₵{totalRevenue.toLocaleString()}</div>
                                        <p className="text-xs text-muted-foreground">From {totalBookings} bookings</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                                <Home className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                               {loadingData ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                                    <>
                                        <div className="text-2xl font-bold">{totalBookings}</div>
                                        <p className="text-xs text-muted-foreground">Across {hostels.length} hostels</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7 mb-8">
                         <Card className="lg:col-span-4">
                            <CardHeader>
                                <CardTitle>My Hostels</CardTitle>
                                <CardDescription>A list of hostels you currently manage.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[350px] overflow-y-auto">
                               {loadingData ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                               ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hostel Name</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {hostels.length > 0 ? hostels.map(hostel => (
                                            <TableRow key={hostel.id}>
                                                <TableCell className="font-medium">{hostel.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={availabilityVariant[hostel.availability || 'Full']}>
                                                        {hostel.availability || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="h-24 text-center">
                                                    You are not managing any hostels yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                               )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>Monthly Bookings</CardTitle>
                                <CardDescription>A chart showing booking trends for the current year.</CardDescription>
                            </CardHeader>
                             <CardContent>
                                {loadingData ? (
                                     <div className="flex items-center justify-center h-[300px]">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                     </div>
                                ) : totalBookings > 0 ? (
                                    <BookingsChart data={chartData} />
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-center text-muted-foreground">
                                        No booking data available to display.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </main>
        </div>
    );
}
