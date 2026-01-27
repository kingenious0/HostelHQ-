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
    Building2,
    ArrowRight,
    Wallet,
    TrendingUp
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Payment {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    type: string;
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
        if (!loadingAuth && !currentUser) {
            router.replace(`/login?redirect=${encodeURIComponent('/payments')}`);
        }
    }, [loadingAuth, currentUser, router]);

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
                });
            } else {
                setAppUser(null);
            }
        });

        const fetchPaymentsAndBookings = async () => {
            setLoading(true);
            const bookingsQuery = query(collection(db, "bookings"), where("studentId", "==", currentUser.uid));
            const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
                const fetchedBookings: Booking[] = [];
                const fetchedPayments: Payment[] = [];

                for (const d of snapshot.docs) {
                    const data = d.data();
                    const hostelSnap = await getDoc(doc(db, 'hostels', data.hostelId));

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
                }
                setBookings(fetchedBookings);
                setPayments(fetchedPayments);
                setLoading(false);
            }, (error) => {
                toast({ title: "Error fetching payments", variant: 'destructive' });
                setLoading(false);
            });

            return unsubscribeBookings;
        };

        const unsubscribePaymentsAndBookingsP = fetchPaymentsAndBookings();

        return () => {
            unsubscribeUserProfile();
            unsubscribePaymentsAndBookingsP.then(unsub => unsub());
        };
    }, [currentUser]);

    const navItems = [
        { label: 'My Bookings', href: '/my-bookings', icon: Calendar },
        { label: 'Payments', href: '/payments', icon: CreditCard },
        { label: 'My Roommates', href: '/my-roommates', icon: Users },
        { label: 'Bank Accounts', href: '/bank-accounts', icon: Banknote },
        { label: 'Settings', href: '/settings', icon: Settings },
    ];

    if (loadingAuth) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <Sidebar collapsible="icon" className="border-r border-border/50 bg-card/50 backdrop-blur-xl">
                    <SidebarHeader className="p-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-primary/10">
                                {appUser?.profileImage ? (
                                    <AvatarImage src={appUser.profileImage} />
                                ) : (
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                        {appUser?.fullName?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                )}
                            </Avatar>
                            <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                                <span className="font-bold text-sm truncate">{appUser?.fullName || 'User'}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{appUser?.email}</span>
                            </div>
                        </div>
                    </SidebarHeader>
                    <SidebarSeparator className="opacity-50" />
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2">Account</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navItems.map((item) => (
                                        <SidebarMenuItem key={item.label}>
                                            <SidebarMenuButton asChild isActive={pathname === item.href} className={cn(
                                                "transition-all duration-200",
                                                pathname === item.href ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-primary/5 hover:text-primary"
                                            )}>
                                                <Link href={item.href} className="flex items-center gap-3 py-6">
                                                    <item.icon className="h-4 w-4" />
                                                    <span className="font-medium">{item.label}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            onClick={async () => {
                                                await firebaseSignOut(auth);
                                                router.push('/login');
                                            }}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            <span className="font-medium">Sign Out</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-x-hidden pt-4 pb-24 md:pb-8">
                        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
                            <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground mb-2">Payments</h1>
                                    <p className="text-muted-foreground text-sm max-w-lg">View your transaction history, invoices, and stay payments.</p>
                                </div>
                                <div className="hidden md:block">
                                    <div className="px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                                        <Wallet className="h-5 w-5 text-primary" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Current Balance</span>
                                            <span className="text-sm font-bold text-primary">GH₵ 0.00</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <Card className="rounded-[2rem] border-border/40 shadow-sm glass-card overflow-hidden">
                                            <CardContent className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                        <Briefcase className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Bookings</p>
                                                        <p className="text-2xl font-black">{bookings.filter(b => b.status === 'confirmed').length}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="rounded-[2rem] border-border/40 shadow-sm glass-card overflow-hidden">
                                            <CardContent className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
                                                        <TrendingUp className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Invested</p>
                                                        <p className="text-2xl font-black text-green-600">
                                                            GH₵ {bookings
                                                                .filter(b => b.status === 'confirmed')
                                                                .reduce((sum, b) => sum + (b.amountPaid || 0), 0)
                                                                .toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="rounded-[2rem] border-border/40 shadow-sm glass-card overflow-hidden">
                                            <CardContent className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <CheckCircle className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Successful Payouts</p>
                                                        <p className="text-2xl font-black">{payments.filter(p => p.status === 'completed').length}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Brand strip */}
                                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-4 border-y border-border/40 opacity-60 grayscale hover:grayscale-0 transition-all">
                                        {['MTN MOMO', 'TELECEL CASH', 'AIRTeltigo', 'PAYSTACK', 'VISA'].map(brand => (
                                            <span key={brand} className="text-[10px] font-black tracking-[0.2em]">{brand}</span>
                                        ))}
                                    </div>

                                    {/* History */}
                                    <section>
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold font-headline">Recent Activity</h2>
                                            <Button variant="ghost" size="sm" className="text-primary font-bold text-xs uppercase tracking-widest">
                                                View All <ArrowRight className="ml-2 h-3 w-3" />
                                            </Button>
                                        </div>

                                        {payments.length > 0 ? (
                                            <div className="grid gap-4">
                                                {bookings
                                                    .filter(b => b.status === 'confirmed')
                                                    .map((booking) => (
                                                        <PaymentCard key={booking.id} booking={booking} />
                                                    ))}
                                            </div>
                                        ) : (
                                            <div className="py-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2rem] border border-dashed border-border/60">
                                                <CreditCard className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                                <p className="text-sm font-medium text-muted-foreground">No payments recorded yet</p>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}

function PaymentCard({ booking }: { booking: Booking }) {
    const router = useRouter();
    const date = booking.bookingDate
        ? (booking.bookingDate instanceof Timestamp ? booking.bookingDate.toDate() : new Date(booking.bookingDate))
        : new Date();

    return (
        <Card className="rounded-[2rem] border-border/40 shadow-sm glass-card hover:shadow-lg transition-all duration-300 overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">{booking.hostelName}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • {booking.paymentReference?.slice(-8).toUpperCase() || 'NO REF'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-row items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Paid</p>
                        <p className="text-lg font-black text-green-600">GH₵ {(booking.amountPaid || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => router.push(`/invoice/${booking.id}`)}>
                            <Receipt className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => router.push(`/agreement/${booking.id}`)}>
                            <FileText className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
