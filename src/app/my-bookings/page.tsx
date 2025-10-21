"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Loader2, 
    AlertTriangle, 
    Building2, 
    Calendar, 
    User, 
    CreditCard,
    Users,
    Banknote,
    Settings,
    LogOut,
    Edit,
    CheckCircle,
    XCircle,
    Clock,
    Briefcase
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

type EnhancedBooking = {
    id: string;
    hostelId: string;
    hostelName: string;
    bookingDate: string;
    paymentReference: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    roomNumber?: string;
    roomType?: string;
    bookedBy: string;
    studentDetails: {
        fullName: string;
        email: string;
    };
}

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState<EnhancedBooking[]>([]);
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

        // Fetch bookings with enhanced data
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
                    date = new Date();
                }

                return {
                    id: d.id,
                    hostelId: data.hostelId,
                    hostelName: hostelSnap.exists() ? hostelSnap.data().name : 'Unknown Hostel',
                    bookingDate: date.toLocaleDateString(),
                    paymentReference: data.paymentReference,
                    status: data.status || 'confirmed',
                    roomNumber: data.roomNumber || 'Not Assigned',
                    roomType: data.roomType || 'Standard',
                    bookedBy: data.studentDetails?.fullName || currentUser.displayName || 'Unknown',
                    studentDetails: {
                        fullName: data.studentDetails?.fullName || currentUser.displayName || 'Unknown',
                        email: currentUser.email || 'Unknown'
                    }
                } as EnhancedBooking;
            }));
            
            setBookings(bookingsData);
            setLoading(false);
        });

        return () => unsubscribeBookings();
    }, [currentUser]);

    const filteredBookings = (status: string) => {
        return bookings.filter(booking => booking.status === status);
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
                            You must be logged in to view your bookings.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 flex">
                {/* Left Sidebar */}
                <div className="w-80 bg-white border-r border-gray-200 p-6">
                    {/* User Profile Card */}
                    <Card className="mb-6">
                        <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback>
                                        {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                        {currentUser.displayName || 'User'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {currentUser.email}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Navigation Menu */}
                    <nav className="space-y-2">
                        <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/profile')}>
                            <User className="mr-2 h-4 w-4" />
                            My Profile
                        </Button>
                        <Button variant="default" className="w-full justify-start bg-purple-600 hover:bg-purple-700" onClick={() => router.push('/my-bookings')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            My Bookings
                        </Button>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/payments')}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Payments
                        </Button>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/my-roommates')}>
                            <Users className="mr-2 h-4 w-4" />
                            My Roommates
                        </Button>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/bank-accounts')}>
                            <Banknote className="mr-2 h-4 w-4" />
                            Bank Accounts
                        </Button>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="w-full justify-start text-red-600 hover:text-red-700"
                            onClick={async () => {
                                try {
                                    await firebaseSignOut(auth);
                                    router.push('/login');
                                } catch (e) {
                                    toast({ title: 'Sign out failed', variant: 'destructive' });
                                }
                            }}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                    </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-8">
                    <div className="max-w-4xl">
                        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Bookings</h1>

                        {/* Status Tabs */}
                        <Tabs defaultValue="completed" className="mb-6">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="pending" className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    Pending Booking ({filteredBookings('pending').length})
                                </TabsTrigger>
                                <TabsTrigger value="cancelled" className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4" />
                                    Canceled Booking ({filteredBookings('cancelled').length})
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Completed Booking ({filteredBookings('confirmed').length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending">
                                <div className="space-y-4">
                                    <h2 className="text-xl font-semibold">Pending booking ({filteredBookings('pending').length})</h2>
                                    {loading ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    ) : filteredBookings('pending').length > 0 ? (
                                        filteredBookings('pending').map(booking => (
                                            <BookingCard key={booking.id} booking={booking} />
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-8 text-center text-gray-500">
                                                No pending bookings
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="cancelled">
                                <div className="space-y-4">
                                    <h2 className="text-xl font-semibold">Canceled booking ({filteredBookings('cancelled').length})</h2>
                                    {loading ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    ) : filteredBookings('cancelled').length > 0 ? (
                                        filteredBookings('cancelled').map(booking => (
                                            <BookingCard key={booking.id} booking={booking} />
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-8 text-center text-gray-500">
                                                No cancelled bookings
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="completed">
                                <div className="space-y-4">
                                    <h2 className="text-xl font-semibold">Confirmed booking ({filteredBookings('confirmed').length})</h2>
                                    {loading ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    ) : filteredBookings('confirmed').length > 0 ? (
                                        filteredBookings('confirmed').map(booking => (
                                            <BookingCard key={booking.id} booking={booking} />
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-8 text-center text-gray-500">
                                                No confirmed bookings
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Booking Card Component
function BookingCard({ booking }: { booking: EnhancedBooking }) {
    const router = useRouter();
    const statusInfo = getStatusInfo(booking.status);

    return (
        <Card className="bg-gray-800 text-white">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                        <Building2 className="h-5 w-5 text-gray-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-lg">{booking.hostelName}</h3>
                            <p className="text-sm text-gray-400">Booking ID: {booking.id.slice(-4)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <Button 
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => router.push(`/agreement/${booking.id}`)}
                        >
                            Manage Booking
                        </Button>
                        <div className="mt-2">
                            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                                {statusInfo.icon}
                                {statusInfo.text}
                            </Badge>
                        </div>
                    </div>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-gray-400">Room Number</p>
                        <p className="font-medium">{booking.roomNumber}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Room Type</p>
                        <p className="font-medium">{booking.roomType}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">Booked by</p>
                        <p className="font-medium">{booking.bookedBy}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function getStatusInfo(status: string) {
    switch (status) {
        case 'confirmed':
            return { variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Booking Confirmed' };
        case 'pending':
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Pending' };
        case 'cancelled':
            return { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" />, text: 'Cancelled' };
        default:
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Unknown' };
    }
}
