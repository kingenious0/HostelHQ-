"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
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
    Briefcase,
    Menu,
    FileText,
    Receipt
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: string;
  profileImage?: string;
  phone?: string;
  address?: string;
  bio?: string;
  nationality?: string;
  gender?: string;
}

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState<EnhancedBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
            if (!user) {
                setLoading(false);
                setAppUser(null);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        // Listen for real-time updates to the user's profile
        const userDocRef = doc(db, "users", currentUser.uid);
        const unsubscribeUserProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as AppUser;
                setAppUser({
                    uid: currentUser.uid,
                    email: currentUser.email!,
                    fullName: userData.fullName || currentUser.displayName || '',
                    role: userData.role || 'student',
                    profileImage: userData.profileImage || currentUser.photoURL || '',
                    phone: userData.phone || '',
                    address: userData.address || '',
                    bio: userData.bio || '',
                    nationality: userData.nationality || '',
                    gender: userData.gender || '',
                });
            } else {
                // If user document doesn't exist, clear appUser
                setAppUser(null);
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAppUser(null);
        });

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
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <Sidebar collapsible="icon" className="bg-white border-r border-gray-200">
                    <SidebarHeader className="p-3 md:p-4">
                        <div className="flex items-center space-x-2 md:space-x-3">
                            <Avatar className="h-8 w-8 md:h-10 md:w-10">
                                {appUser?.profileImage ? (
                                  <AvatarImage src={appUser.profileImage} alt="Profile" />
                                ) : (
                                  <AvatarFallback className="text-xs md:text-sm">
                                      {appUser?.fullName?.charAt(0) || appUser?.email?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                )}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm md:text-base">{appUser?.fullName || 'User'}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{appUser?.email}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 md:h-8 md:w-8 p-0">
                                <Edit className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                        </div>
                    </SidebarHeader>
                    <SidebarSeparator />
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>Menu</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive={false}>
                                            <Link href="/profile">
                                                <User />
                                                <span>My Profile</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive>
                                            <Link href="/my-bookings">
                                                <Calendar />
                                                <span>My Bookings</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/payments">
                                                <CreditCard />
                                                <span>Payments</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/my-roommates">
                                                <Users />
                                                <span>My Roommates</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/bank-accounts">
                                                <Banknote />
                                                <span>Bank Accounts</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild>
                                            <Link href="/settings">
                                                <Settings />
                                                <span>Settings</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton 
                                            onClick={async () => {
                                                try {
                                                    await firebaseSignOut(auth);
                                                    router.push('/login');
                                                } catch (e) {
                                                    toast({ title: 'Sign out failed', variant: 'destructive' });
                                                }
                                            }}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <LogOut />
                                            <span>Sign Out</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter />
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="flex flex-col">
                    <Header />
                    <main className="flex-1 p-2 sm:p-4 md:p-8 bg-gray-50/50">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
                                <div className="flex items-center gap-2">
                                    <SidebarTrigger className="md:hidden" />
                                    <Button variant="outline" size="sm" className="hidden md:flex">
                                        <Menu className="h-4 w-4 mr-2" />
                                        Toggle Sidebar
                                    </Button>
                                </div>
                            </div>

                            {/* Status Tabs */}
                            <Tabs defaultValue="completed" className="mb-4 md:mb-6">
                                <TabsList className="grid w-full grid-cols-3 gap-1 sm:gap-2 h-auto">
                                    <TabsTrigger value="pending" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-1">
                                        <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline">Pending Booking</span>
                                        <span className="sm:hidden">Pending</span>
                                        <span className="text-xs">({filteredBookings('pending').length})</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="cancelled" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-1">
                                        <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline">Canceled Booking</span>
                                        <span className="sm:hidden">Canceled</span>
                                        <span className="text-xs">({filteredBookings('cancelled').length})</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="completed" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-1">
                                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline">Completed Booking</span>
                                        <span className="sm:hidden">Completed</span>
                                        <span className="text-xs">({filteredBookings('confirmed').length})</span>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="pending">
                                    <div className="space-y-3 md:space-y-4">
                                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Pending booking ({filteredBookings('pending').length})</h2>
                                        {loading ? (
                                            <div className="flex justify-center py-6 md:py-8">
                                                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : filteredBookings('pending').length > 0 ? (
                                            <div className="grid gap-3 md:gap-4">
                                                {filteredBookings('pending').map(booking => (
                                                    <BookingCard key={booking.id} booking={booking} />
                                                ))}
                                            </div>
                                        ) : (
                                            <Card>
                                                <CardContent className="p-6 md:p-8 text-center text-gray-500 dark:text-gray-400">
                                                    No pending bookings
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="cancelled">
                                    <div className="space-y-3 md:space-y-4">
                                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Canceled booking ({filteredBookings('cancelled').length})</h2>
                                        {loading ? (
                                            <div className="flex justify-center py-6 md:py-8">
                                                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : filteredBookings('cancelled').length > 0 ? (
                                            <div className="grid gap-3 md:gap-4">
                                                {filteredBookings('cancelled').map(booking => (
                                                    <BookingCard key={booking.id} booking={booking} />
                                                ))}
                                            </div>
                                        ) : (
                                            <Card>
                                                <CardContent className="p-6 md:p-8 text-center text-gray-500 dark:text-gray-400">
                                                    No cancelled bookings
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="completed">
                                    <div className="space-y-3 md:space-y-4">
                                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Confirmed booking ({filteredBookings('confirmed').length})</h2>
                                        {loading ? (
                                            <div className="flex justify-center py-6 md:py-8">
                                                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : filteredBookings('confirmed').length > 0 ? (
                                            <div className="grid gap-3 md:gap-4">
                                                {filteredBookings('confirmed').map(booking => (
                                                    <BookingCard key={booking.id} booking={booking} />
                                                ))}
                                            </div>
                                        ) : (
                                            <Card>
                                                <CardContent className="p-6 md:p-8 text-center text-gray-500 dark:text-gray-400">
                                                    No confirmed bookings
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}

// Booking Card Component
function BookingCard({ booking }: { booking: EnhancedBooking }) {
    const router = useRouter();
    const statusInfo = getStatusInfo(booking.status);

    return (
        <Card className="bg-gray-800 text-white hover:bg-gray-700 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                        <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300 mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm sm:text-base md:text-lg text-white truncate">{booking.hostelName}</h3>
                            <p className="text-xs sm:text-sm text-gray-300">Booking ID: {booking.id.slice(-4)}</p>
                        </div>
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 text-xs">
                            {statusInfo.icon}
                            <span className="hidden sm:inline">{statusInfo.text}</span>
                            <span className="sm:hidden">{statusInfo.text.split(' ')[0]}</span>
                        </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                            <p className="text-gray-300 text-xs">Room Number</p>
                            <p className="font-medium text-white text-xs sm:text-sm">{booking.roomNumber}</p>
                        </div>
                        <div>
                            <p className="text-gray-300 text-xs">Room Type</p>
                            <p className="font-medium text-white text-xs sm:text-sm">{booking.roomType}</p>
                        </div>
                        <div>
                            <p className="text-gray-300 text-xs">Booked by</p>
                            <p className="font-medium text-white text-xs sm:text-sm truncate">{booking.bookedBy}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs sm:text-sm border-gray-600 text-gray-200 hover:bg-gray-700"
                            onClick={() => router.push(`/invoice/${booking.id}`)}
                        >
                            <Receipt className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            Invoice
                        </Button>
                        <Button 
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 flex-1 text-xs sm:text-sm"
                            onClick={() => router.push(`/agreement/${booking.id}`)}
                        >
                            <FileText className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            Agreement
                        </Button>
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
