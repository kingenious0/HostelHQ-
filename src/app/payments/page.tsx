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
    CreditCard,
    Users,
    Banknote,
    Settings,
    LogOut,
    Edit,
    Calendar,
    User,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    FileText,
    Menu,
    Receipt,
    Building2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface Payment {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    type: string; // e.g., 'Full Payment', 'Deposit'
    status: 'pending' | 'completed' | 'failed';
    deadline: Timestamp | null;
    damageMoney?: number;
    paymentDate?: Timestamp | null;
    reference?: string;
}

interface Booking {
    id: string;
    hostelId: string;
    hostelName: string;
    roomNumber?: string;
    roomType?: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    amountPaid?: number;
    paymentReference?: string;
    bookingDate?: Timestamp | string;
    roomTypeId?: string;
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

export default function PaymentsPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
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
                setAppUser(null);
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAppUser(null);
        });

        setLoading(true);

        const fetchPaymentsAndBookings = async () => {
            try {
                const bookingsQuery = query(collection(db, "bookings"), where("studentId", "==", currentUser.uid));
                const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
                    const fetchedBookings: Booking[] = [];
                    const fetchedPayments: Payment[] = [];

                    for (const d of snapshot.docs) {
                        const data = d.data();
                        const hostelSnap = await getDoc(doc(db, 'hostels', data.hostelId));
                        
                        // Get room type name if available
                        let roomTypeName = data.roomType || 'Standard';
                        if (data.roomTypeId && hostelSnap.exists()) {
                            const hostelData = hostelSnap.data();
                            const roomTypes = hostelData.roomTypes || [];
                            const roomType = roomTypes.find((rt: any) => rt.id === data.roomTypeId);
                            if (roomType) {
                                roomTypeName = roomType.name || roomTypeName;
                            }
                        }
                        
                        const booking: Booking = {
                            id: d.id,
                            hostelId: data.hostelId,
                            hostelName: hostelSnap.exists() ? hostelSnap.data().name : 'Unknown Hostel',
                            roomNumber: data.roomNumber,
                            roomType: roomTypeName,
                            status: data.status || 'pending',
                            amountPaid: data.amountPaid || 0,
                            paymentReference: data.paymentReference,
                            bookingDate: data.bookingDate,
                            roomTypeId: data.roomTypeId,
                        };
                        fetchedBookings.push(booking);

                        // Create payment entry from booking if confirmed
                        if (data.status === 'confirmed' && data.amountPaid) {
                            fetchedPayments.push({
                                id: d.id,
                                bookingId: d.id,
                                amount: data.amountPaid,
                                currency: 'GHS',
                                type: 'Room Rent',
                                status: 'completed',
                                deadline: null,
                                damageMoney: 0,
                                paymentDate: data.bookingDate || null,
                                reference: data.paymentReference || null,
                            });
                        }

                        // Also check for separate payment documents
                        if (data.paymentAmount) {
                            fetchedPayments.push({
                                id: d.id + '_payment',
                                bookingId: d.id,
                                amount: data.paymentAmount,
                                currency: data.paymentCurrency || 'GHS',
                                type: data.paymentType || 'Full Payment',
                                status: data.paymentStatus || 'pending',
                                deadline: data.paymentDeadline || null,
                                damageMoney: data.damageMoney || 0,
                                paymentDate: data.paymentDate || null,
                                reference: data.paymentReference || null,
                            });
                        }
                    }
                    setBookings(fetchedBookings);
                    setPayments(fetchedPayments);
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching bookings for payments:", error);
                    toast({ title: "Error fetching payments", variant: 'destructive' });
                    setLoading(false);
                });

                return unsubscribeBookings;
            } catch (error) {
                console.error("Error in fetchPaymentsAndBookings:", error);
                toast({ title: "Error fetching payments", variant: 'destructive' });
                setLoading(false);
                return () => {}; // Return empty unsubscribe
            }
        };

        const unsubscribePaymentsAndBookings = fetchPaymentsAndBookings();

        return () => {
            unsubscribeUserProfile();
            unsubscribePaymentsAndBookings.then(unsub => unsub()); // Ensure unsubscribe is called
        };
    }, [currentUser]);

    const pendingPayment = payments.find(p => p.status === 'pending');
    const associatedBooking = pendingPayment ? bookings.find(b => b.id === pendingPayment.bookingId) : null;

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
                            You must be logged in to view your payments.
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
                                        <SidebarMenuButton asChild isActive={false}>
                                            <Link href="/my-bookings">
                                                <Calendar />
                                                <span>My Bookings</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive>
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
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Payments</h1>
                                <div className="flex items-center gap-2">
                                    <SidebarTrigger className="md:hidden" />
                                    <Button variant="outline" size="sm" className="hidden md:flex">
                                        <Menu className="h-4 w-4 mr-2" />
                                        Toggle Sidebar
                                    </Button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                                </div>
                            ) : bookings.length > 0 ? (
                                <div className="space-y-6">
                                    {/* Payment Summary */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <DollarSign className="h-5 w-5" />
                                                Payment Summary
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-blue-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Total Bookings</p>
                                                    <p className="text-2xl font-bold text-blue-900">{bookings.filter(b => b.status === 'confirmed').length}</p>
                                                </div>
                                                <div className="p-4 bg-green-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Total Paid</p>
                                                    <p className="text-2xl font-bold text-green-900">
                                                        GH₵ {bookings
                                                            .filter(b => b.status === 'confirmed')
                                                            .reduce((sum, b) => sum + (b.amountPaid || 0), 0)
                                                            .toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-purple-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Completed Payments</p>
                                                    <p className="text-2xl font-bold text-purple-900">{payments.filter(p => p.status === 'completed').length}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Payment History */}
                                    <div>
                                        <h2 className="text-xl font-bold mb-4">Payment History</h2>
                                        <div className="space-y-4">
                                            {bookings
                                                .filter(b => b.status === 'confirmed')
                                                .map((booking) => {
                                                    const bookingPayments = payments.filter(p => p.bookingId === booking.id && p.status === 'completed');
                                                    const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0) || booking.amountPaid || 0;
                                                    
                                                    return (
                                                        <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                                                            <CardContent className="p-6">
                                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <Building2 className="h-5 w-5 text-primary" />
                                                                            <h3 className="text-lg font-semibold">{booking.hostelName}</h3>
                                                                            <Badge variant="default" className="bg-green-600">
                                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                                Paid
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                                                                            <div>
                                                                                <p className="text-gray-600">Room Type</p>
                                                                                <p className="font-medium">{booking.roomType || 'N/A'}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-gray-600">Amount Paid</p>
                                                                                <p className="font-medium text-green-600">GH₵ {totalPaid.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-gray-600">Payment Date</p>
                                                                                <p className="font-medium">
                                                                                    {booking.bookingDate 
                                                                                        ? (booking.bookingDate instanceof Timestamp 
                                                                                            ? booking.bookingDate.toDate().toLocaleDateString()
                                                                                            : new Date(booking.bookingDate).toLocaleDateString())
                                                                                        : 'N/A'}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-gray-600">Reference</p>
                                                                                <p className="font-medium font-mono text-xs">{booking.paymentReference || 'N/A'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-2">
                                                                        <Button 
                                                                            onClick={() => router.push(`/invoice/${booking.id}`)}
                                                                            variant="outline"
                                                                            className="w-full md:w-auto"
                                                                        >
                                                                            <Receipt className="mr-2 h-4 w-4" />
                                                                            View Invoice
                                                                        </Button>
                                                                        <Button 
                                                                            onClick={() => router.push(`/agreement/${booking.id}`)}
                                                                            variant="outline"
                                                                            className="w-full md:w-auto"
                                                                        >
                                                                            <FileText className="mr-2 h-4 w-4" />
                                                                            View Agreement
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            
                                            {bookings.filter(b => b.status === 'confirmed').length === 0 && (
                                                <Card>
                                                    <CardContent className="p-8 text-center">
                                                        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                                        <p className="text-muted-foreground">No completed payments found.</p>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pending Payments */}
                                    {pendingPayment && associatedBooking && (
                                        <Card className="border-yellow-200 bg-yellow-50">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-yellow-900">
                                                    <AlertTriangle className="h-5 w-5" />
                                                    Payment Due
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                                                    <AlertTitle className="font-semibold">Payment Deadline Approaching!</AlertTitle>
                                                    <AlertDescription>
                                                        Please complete your payment of <span className="font-bold">{pendingPayment.currency} {pendingPayment.amount.toLocaleString()}</span> by <span className="font-bold">{pendingPayment.deadline?.toDate().toLocaleDateString()}</span> to confirm your booking for {associatedBooking.hostelName} ({associatedBooking.roomType} {associatedBooking.roomNumber}).
                                                    </AlertDescription>
                                                </Alert>
                                                <Button size="lg" className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white">
                                                    <CreditCard className="h-5 w-5 mr-2" /> Pay MOMO / Debit Card
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            ) : (pendingPayment && associatedBooking) ? (
                                <Card className="bg-white shadow-lg rounded-lg">
                                    <CardHeader className="border-b pb-4">
                                        <CardTitle className="text-2xl font-semibold">Payment Due</CardTitle>
                                        <CardDescription>Your room booking payment is pending.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                                <AlertTriangle className="h-4 w-4 text-blue-600" />
                                                <AlertTitle className="font-semibold">Payment Deadline Approaching!</AlertTitle>
                                                <AlertDescription>
                                                    Please complete your payment of <span className="font-bold">{pendingPayment.currency} {pendingPayment.amount.toLocaleString()}</span> by <span className="font-bold">{pendingPayment.deadline?.toDate().toLocaleDateString()}</span> to confirm your booking for {associatedBooking.hostelName} ({associatedBooking.roomType} {associatedBooking.roomNumber}).
                                                    You have a grace period of 0 to 4 hours for mobile money/debit card payments. Remember to print your receipt.
                                                </AlertDescription>
                                            </Alert>

                                            <h3 className="text-lg font-semibold text-gray-800">Payment Details</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm text-gray-600">Payment Type</p>
                                                    <p className="font-medium text-gray-900">{pendingPayment.type}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm text-gray-600">Amount Due</p>
                                                    <p className="font-medium text-gray-900">{pendingPayment.currency} {pendingPayment.amount.toLocaleString()}</p>
                                                </div>
                                                {pendingPayment.damageMoney && pendingPayment.damageMoney > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-gray-600">Damage Money</p>
                                                        <p className="font-medium text-gray-900">{pendingPayment.currency} {pendingPayment.damageMoney.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <p className="text-sm text-gray-600">Deadline</p>
                                                    <p className="font-medium text-gray-900">{pendingPayment.deadline?.toDate().toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white">
                                                <CreditCard className="h-5 w-5 mr-2" /> Pay MOMO / Debit Card
                                            </Button>
                                        </div>

                                        <Tabs defaultValue="payments" className="mt-8">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="payments">Payments</TabsTrigger>
                                                <TabsTrigger value="damageMoney">Damage Money</TabsTrigger>
                                                <TabsTrigger value="roomConfirmation">Room Confirmation</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="payments" className="pt-4">
                                                <p className="text-gray-700">Payment history will be displayed here.</p>
                                                {payments.filter(p => p.status === 'completed').length > 0 ? (
                                                    <div className="space-y-4 mt-4">
                                                        {payments.filter(p => p.status === 'completed').map(p => (
                                                            <Card key={p.id} className="p-4">
                                                                <p>Amount: {p.currency} {p.amount.toLocaleString()}</p>
                                                                <p>Date: {p.paymentDate?.toDate().toLocaleDateString()}</p>
                                                                <p>Reference: {p.reference}</p>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground">No completed payments found.</p>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="damageMoney" className="pt-4">
                                                {payments.filter(p => (p.damageMoney && p.damageMoney > 0)).length > 0 ? (
                                                     <p className="text-gray-700">Damage money details will be displayed here.</p>
                                                ) : (
                                                    <p className="text-muted-foreground">No damage money payments found.</p>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="roomConfirmation" className="pt-4">
                                                <Alert variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Room Not Confirmed</AlertTitle>
                                                    <AlertDescription>
                                                        Your room is not yet confirmed due to an outstanding payment of <span className="font-bold">GHS {pendingPayment.amount.toLocaleString()}</span>.
                                                    </AlertDescription>
                                                </Alert>
                                            </TabsContent>
                                        </Tabs>

                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="text-center py-16">
                                    <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-lg text-muted-foreground">No pending payments or bookings found.</p>
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}


