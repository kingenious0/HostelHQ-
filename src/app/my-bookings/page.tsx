"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    Receipt,
    Trash2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

type EnhancedBooking = {
    id: string;
    hostelId: string;
    hostelName: string;
    bookingDate: string;
    paymentReference: string;
    status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
    roomNumber?: string;
    roomType?: string;
    bookedBy: string;
    studentDetails: {
        fullName: string;
        email: string;
    };
}

type EnhancedVisit = {
    id: string;
    hostelId: string;
    hostelName: string;
    visitDate: string;
    visitTime: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    agentId?: string;
    agentName?: string;
    paymentReference?: string;
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
    const [visits, setVisits] = useState<EnhancedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const pathname = usePathname();

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
                    email: userData.email || currentUser.email!,
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

        // Fetch secured bookings (from bookings collection)
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
        });

        // Fetch visit bookings (from visits collection)
        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));
        const unsubscribeVisits = onSnapshot(visitsQuery, async (snapshot) => {
            const visitsData = await Promise.all(snapshot.docs.map(async (d) => {
                const data = d.data();
                const hostelSnap = await getDoc(doc(db, 'hostels', data.hostelId));
                
                let agentName = 'Not Assigned';
                if (data.agentId) {
                    try {
                        const agentSnap = await getDoc(doc(db, 'users', data.agentId));
                        if (agentSnap.exists()) {
                            agentName = agentSnap.data().fullName || agentName;
                        }
                    } catch (error) {
                        console.error('Error fetching agent:', error);
                    }
                }

                let visitDate = 'N/A';
                if (data.visitDate) {
                    if (typeof data.visitDate === 'string') {
                        visitDate = new Date(data.visitDate).toLocaleDateString();
                    } else {
                        visitDate = new Date().toLocaleDateString();
                    }
                }

                return {
                    id: d.id,
                    hostelId: data.hostelId,
                    hostelName: hostelSnap.exists() ? hostelSnap.data().name : 'Unknown Hostel',
                    visitDate: visitDate,
                    visitTime: data.visitTime || 'N/A',
                    status: data.status || 'pending',
                    agentId: data.agentId,
                    agentName: agentName,
                    paymentReference: data.paymentReference,
                } as EnhancedVisit;
            }));
            
            setVisits(visitsData);
            setLoading(false);
        });

        return () => {
            unsubscribeBookings();
            unsubscribeVisits();
        };
    }, [currentUser]);

    // Show welcome dialog for new students with no bookings
    useEffect(() => {
        if (!loading && appUser && bookings.length === 0 && visits.length === 0) {
            // Check if this is a fresh signup (user was just created)
            const urlParams = new URLSearchParams(window.location.search);
            const isNewSignup = urlParams.get('welcome') === 'true';
            
            if (isNewSignup) {
                setShowWelcomeDialog(true);
                // Clean up URL
                window.history.replaceState({}, '', '/my-bookings');
            }
        }
    }, [loading, appUser, bookings.length, visits.length]);

    const filteredBookings = (status: string) => {
        return bookings.filter(booking => booking.status === status);
    };

    const filteredVisits = (status: string) => {
        return visits.filter(visit => visit.status === status);
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
        <>
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
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 md:h-8 md:w-8 p-0"
                                        onClick={() => {
                                            // Dispatch a custom event to trigger profile dialog
                                            window.dispatchEvent(new CustomEvent('openProfileDialog'));
                                        }}
                                >
                                    <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                                <SidebarTrigger className="h-8 w-8" />
                            </div>
                        </div>
                    </SidebarHeader>
                    <SidebarSeparator />
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>Menu</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
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
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="flex flex-col">
                    <Header />
                    <main className="flex-1 p-2 sm:p-4 md:p-8 bg-gray-50/50">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
                            </div>

                            {/* Visit Booking History Section */}
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-xl font-headline">🚶‍♂️ Visit Booking History</CardTitle>
                                    <CardDescription>Track all your hostel visit requests. These do not generate tenancy agreements.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="pending" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                                            <TabsTrigger value="pending" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Pending</span>
                                                <span className="sm:hidden">Pend</span> ({filteredVisits('pending').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="accepted" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Confirmed</span>
                                                <span className="sm:hidden">Conf</span> ({filteredVisits('accepted').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="completed" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Completed</span>
                                                <span className="sm:hidden">Comp</span> ({filteredVisits('completed').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="cancelled" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Cancelled</span>
                                                <span className="sm:hidden">Canc</span> ({filteredVisits('cancelled').length})
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="pending" className="mt-4">
                                            {loading ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                </div>
                                            ) : filteredVisits('pending').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredVisits('pending').map(visit => (
                                                        <VisitCard key={visit.id} visit={visit} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No pending visits
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="accepted" className="mt-4">
                                            {filteredVisits('accepted').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredVisits('accepted').map(visit => (
                                                        <VisitCard key={visit.id} visit={visit} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No confirmed visits
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="completed" className="mt-4">
                                            {filteredVisits('completed').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredVisits('completed').map(visit => (
                                                        <VisitCard key={visit.id} visit={visit} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No completed visits
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="cancelled" className="mt-4">
                                            {filteredVisits('cancelled').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredVisits('cancelled').map(visit => (
                                                        <VisitCard key={visit.id} visit={visit} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No cancelled visits
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>

                            {/* Secured Hostels History Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-xl font-headline">🏠 Secured Hostels</CardTitle>
                                    <CardDescription>Your paid bookings with official tenancy agreements and invoices.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="confirmed" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                                            <TabsTrigger value="pending" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Pending</span>
                                                <span className="sm:hidden">Pend</span> ({filteredBookings('pending').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="confirmed" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Secured</span>
                                                <span className="sm:hidden">Sec</span> ({filteredBookings('confirmed').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="cancelled" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Cancelled</span>
                                                <span className="sm:hidden">Canc</span> ({filteredBookings('cancelled').length})
                                            </TabsTrigger>
                                            <TabsTrigger value="completed" className="text-xs sm:text-xs px-2 py-2">
                                                <span className="hidden sm:inline">Completed</span>
                                                <span className="sm:hidden">Comp</span> ({filteredBookings('completed').length})
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="pending" className="mt-4">
                                            {loading ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                </div>
                                            ) : filteredBookings('pending').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredBookings('pending').map(booking => (
                                                        <BookingCard key={booking.id} booking={booking} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No pending bookings
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="confirmed" className="mt-4">
                                            {filteredBookings('confirmed').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredBookings('confirmed').map(booking => (
                                                        <BookingCard key={booking.id} booking={booking} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No secured bookings
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="cancelled" className="mt-4">
                                            {filteredBookings('cancelled').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredBookings('cancelled').map(booking => (
                                                        <BookingCard key={booking.id} booking={booking} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No cancelled bookings
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="completed" className="mt-4">
                                            {filteredBookings('completed').length > 0 ? (
                                                <div className="grid gap-4">
                                                    {filteredBookings('completed').map(booking => (
                                                        <BookingCard key={booking.id} booking={booking} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-8 text-center text-gray-500">
                                                        No completed stays
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>

            {/* Welcome Dialog for New Students */}
            <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center">🎉 Welcome to HostelHQ!</DialogTitle>
                        <DialogDescription className="text-center">
                            Hello {appUser?.fullName || 'there'}! 👋
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-center space-y-4 py-4">
                        <p className="text-muted-foreground">
                            You don't have any bookings yet. Start by exploring our available hostels and secure your perfect accommodation!
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                💡 <strong>Pro tip:</strong> Browse hostels, schedule visits, and book your ideal room all in one place.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setShowWelcomeDialog(false)}>
                            Maybe Later
                        </Button>
                        <Button asChild onClick={() => setShowWelcomeDialog(false)}>
                            <Link href="/#all-hostels">
                                Browse Hostels 🏠
                            </Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Visit Card Component (for visit bookings - NO Agreement button)
function VisitCard({ visit }: { visit: EnhancedVisit }) {
    const router = useRouter();
    const { toast } = useToast();
    const statusInfo = getVisitStatusInfo(visit.status);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm(
            `Are you sure you want to delete this visit booking for ${visit.hostelName}?\n\n` +
            `This action cannot be undone.`
        )) {
            return;
        }

        setIsDeleting(true);
        try {
            const visitRef = doc(db, 'visits', visit.id);
            await deleteDoc(visitRef);
            
            toast({
                title: "Visit Deleted",
                description: `Visit booking for ${visit.hostelName} has been deleted.`
            });
        } catch (error) {
            console.error("Error deleting visit:", error);
            toast({
                title: "Deletion Failed",
                description: "Could not delete the visit. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const isCompleted = visit.status === 'completed';
    const isPending = visit.status === 'pending';

    return (
        <Card className="bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors">
            <CardContent className="p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm sm:text-base md:text-lg text-gray-900 truncate">{visit.hostelName}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">Visit ID: {visit.id.slice(-4)}</p>
                        </div>
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 text-xs">
                            {statusInfo.icon}
                            <span className="hidden sm:inline">{statusInfo.text}</span>
                            <span className="sm:hidden">{statusInfo.text.split(' ')[0]}</span>
                        </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                            <p className="text-gray-600 text-xs">Visit Date</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm">{visit.visitDate}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 text-xs">Visit Time</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm">{visit.visitTime}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 text-xs">Agent</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{visit.agentName || 'Not Assigned'}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs sm:text-sm border-blue-300 text-blue-700 hover:bg-blue-200"
                            onClick={() => {
                                if (isCompleted) {
                                    router.push(`/invoice/${visit.id}`);
                                } else {
                                    router.push(`/hostels/${visit.hostelId}/book/tracking?visitId=${visit.id}`);
                                }
                            }}
                        >
                            {isCompleted ? (
                                <>
                                    <Receipt className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                    Invoice
                                </>
                            ) : (
                                <>
                                    <FileText className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                    Track Visit Status
                                </>
                            )}
                        </Button>
                        <Button 
                            size="sm"
                            variant="destructive"
                            className="text-xs sm:text-sm"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4 animate-spin"/>
                            ) : (
                                <Trash2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            )}
                            Delete
                        </Button>
                        <div className="text-xs text-gray-500 italic px-2 py-1 flex items-center">
                            {isPending
                                ? '* Invoice will be available after your visit is completed'
                                : '* No tenancy agreement for visits'}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Booking Card Component (for secured hostels - WITH Agreement button)
function BookingCard({ booking }: { booking: EnhancedBooking }) {
    const router = useRouter();
    const { toast } = useToast();
    const statusInfo = getStatusInfo(booking.status);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const isCompleted = booking.status === 'completed';

    const handleDelete = async () => {
        if (!window.confirm(
            `Are you sure you want to delete this booking for ${booking.hostelName}?\n\n` +
            `This will permanently remove the booking and associated data. This action cannot be undone.`
        )) {
            return;
        }

        setIsDeleting(true);
        try {
            const bookingRef = doc(db, 'bookings', booking.id);
            await deleteDoc(bookingRef);
            
            toast({
                title: "Booking Deleted",
                description: `Booking for ${booking.hostelName} has been deleted.`
            });
        } catch (error) {
            console.error("Error deleting booking:", error);
            toast({
                title: "Deletion Failed",
                description: "Could not delete the booking. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleMarkCompleted = async () => {
        if (isCompleted) return;
        if (!window.confirm(`Mark your stay at ${booking.hostelName} as finished?`)) {
            return;
        }
        setIsCompleting(true);
        try {
            const bookingRef = doc(db, 'bookings', booking.id);
            await updateDoc(bookingRef, { status: 'completed' });
            toast({ title: 'Stay marked as finished' });
        } catch (error) {
            console.error('Error marking stay as finished:', error);
            toast({ title: 'Update failed', description: 'Could not mark this stay as finished.', variant: 'destructive' });
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <Card className="bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                        <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm sm:text-base md:text-lg text-gray-900 truncate">{booking.hostelName}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">Booking ID: {booking.id.slice(-4)}</p>
                        </div>
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 text-xs">
                            {statusInfo.icon}
                            <span className="hidden sm:inline">{statusInfo.text}</span>
                            <span className="sm:hidden">{statusInfo.text.split(' ')[0]}</span>
                        </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                            <p className="text-gray-600 text-xs">Room Number</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm">{booking.roomNumber}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 text-xs">Room Type</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm">{booking.roomType}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 text-xs">Booked by</p>
                            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{booking.bookedBy}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs sm:text-sm border-blue-300 text-blue-700 hover:bg-blue-200"
                            onClick={() => router.push(`/invoice/${booking.id}`)}
                            disabled={isCompleted}
                        >
                            <Receipt className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            Invoice
                        </Button>
                        <Button 
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 flex-1 text-xs sm:text-sm"
                            onClick={() => router.push(`/agreement/${booking.id}`)}
                            disabled={isCompleted}
                        >
                            <FileText className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            Agreement
                        </Button>
                        <Button 
                            size="sm"
                            variant="outline"
                            className="text-xs sm:text-sm border-green-300 text-green-700 hover:bg-green-200"
                            onClick={handleMarkCompleted}
                            disabled={isCompleting || isCompleted}
                        >
                            {isCompleting ? (
                                <Loader2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4 animate-spin"/>
                            ) : (
                                <CheckCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4"/>
                            )}
                            {isCompleted ? 'Stay finished' : 'Mark stay as finished'}
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
            return { variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Secured' };
        case 'pending':
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Pending Payment' };
        case 'cancelled':
            return { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" />, text: 'Cancelled' };
        default:
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Unknown' };
    }
}

function getVisitStatusInfo(status: string) {
    switch (status) {
        case 'accepted':
            return { variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Confirmed Visit' };
        case 'completed':
            return { variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Completed Visit' };
        case 'pending':
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Pending Visit' };
        case 'cancelled':
            return { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" />, text: 'Cancelled Visit' };
        default:
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Unknown' };
    }
}
