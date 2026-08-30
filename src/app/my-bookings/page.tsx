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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { submitComplaintAction } from '@/app/actions/db';
import type { ComplaintCategory } from '@/lib/data';
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
    Trash2,
    ShieldCheck,
    ShieldAlert,
    ArrowRight,
    Eye
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    managerName?: string;
    managerPhone?: string;
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

    // Complaint submission state
    const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
    const [complaintHostelName, setComplaintHostelName] = useState('');
    const [complaintHostelId, setComplaintHostelId] = useState('');
    const [complaintRoomNumber, setComplaintRoomNumber] = useState('');
    const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>('Sanitation & Water');
    const [complaintSubject, setComplaintSubject] = useState('');
    const [complaintDescription, setComplaintDescription] = useState('');
    const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);

    const handleOpenComplaint = (booking?: EnhancedBooking | null) => {
        if (booking) {
            setComplaintHostelName(booking.hostelName || '');
            setComplaintHostelId(booking.hostelId || '');
            setComplaintRoomNumber(booking.roomNumber || '');
        } else {
            setComplaintHostelName(bookings[0]?.hostelName || '');
            setComplaintHostelId(bookings[0]?.hostelId || '');
            setComplaintRoomNumber(bookings[0]?.roomNumber || '');
        }
        setComplaintSubject('');
        setComplaintDescription('');
        setComplaintCategory('Sanitation & Water');
        setComplaintDialogOpen(true);
    };

    const handleSubmitComplaint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!complaintHostelName.trim() || !complaintSubject.trim() || !complaintDescription.trim()) {
            toast({ title: 'Missing fields', description: 'Please complete all required fields.', variant: 'destructive' });
            return;
        }

        setIsSubmittingComplaint(true);
        try {
            const studentUid = appUser?.uid || currentUser?.uid || 'anonymous';
            const studentName = appUser?.fullName || currentUser?.displayName || 'Student';
            const studentEmail = appUser?.email || currentUser?.email || '';
            const studentPhone = appUser?.phone || '';

            const res = await submitComplaintAction({
                direction: 'student_to_hostel',
                status: 'Submitted',
                category: complaintCategory,
                subject: complaintSubject.trim(),
                description: complaintDescription.trim(),
                studentId: studentUid,
                studentName,
                studentEmail,
                studentPhone,
                hostelId: complaintHostelId || `hostel_${Date.now()}`,
                hostelName: complaintHostelName.trim(),
                roomNumber: complaintRoomNumber.trim() || undefined,
                createdAt: new Date().toISOString(),
            });

            if (res.success) {
                toast({
                    title: 'Complaint Submitted to Dean',
                    description: 'Your dispute has been routed directly to the Dean of Students office for review.',
                });
                setComplaintDialogOpen(false);
                setComplaintSubject('');
                setComplaintDescription('');
            } else {
                toast({
                    title: 'Submission Failed',
                    description: res.error || 'Failed to submit complaint. Please try again.',
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmittingComplaint(false);
        }
    };

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
                setAppUser(null);
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAppUser(null);
        });

        setLoading(true);

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
                    bookingDate: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
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

        const visitsQuery = query(collection(db, "visits"), where("studentId", "==", currentUser.uid));
        const unsubscribeVisits = onSnapshot(visitsQuery, async (snapshot) => {
            const visitsData = await Promise.all(snapshot.docs.map(async (d) => {
                const data = d.data();
                const hostelSnap = await getDoc(doc(db, 'hostels', data.hostelId));

                let managerName = 'Hostel Management';
                if (hostelSnap.exists()) {
                    const hData = hostelSnap.data();
                    managerName = hData.managerName || hData.contactPerson || 'Hostel Management';
                }

                let visitDate = 'N/A';
                if (data.visitDate) {
                    const d = typeof data.visitDate === 'string' ? new Date(data.visitDate) : new Date();
                    visitDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                }

                return {
                    id: d.id,
                    hostelId: data.hostelId,
                    hostelName: hostelSnap.exists() ? hostelSnap.data().name : 'Unknown Hostel',
                    visitDate: visitDate,
                    visitTime: data.visitTime || 'N/A',
                    status: data.status || 'pending',
                    managerName: managerName,
                    managerPhone: data.managerPhone,
                    paymentReference: data.paymentReference,
                } as EnhancedVisit;
            }));

            setVisits(visitsData);
            setLoading(false);
        });

        return () => {
            unsubscribeUserProfile();
            unsubscribeBookings();
            unsubscribeVisits();
        };
    }, [currentUser]);

    useEffect(() => {
        if (!loading && appUser && bookings.length === 0 && visits.length === 0) {
            const urlParams = new URLSearchParams(window.location.search);
            const isNewSignup = urlParams.get('welcome') === 'true';

            if (isNewSignup) {
                setShowWelcomeDialog(true);
                window.history.replaceState({}, '', '/my-bookings');
            }
        }
    }, [loading, appUser, bookings.length, visits.length]);

    const filteredBookings = (status: string) => bookings.filter(booking => booking.status === status);
    const filteredVisits = (status: string) => visits.filter(visit => visit.status === status);

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

    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/20">
                    <Alert variant="destructive" className="max-w-lg border-primary/20 bg-white">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-bold">Access Denied</AlertTitle>
                        <AlertDescription className="text-muted-foreground">
                            You must be logged in to view your bookings.
                            <Link href="/login" className="ml-1 text-primary font-semibold hover:underline">Click here to login</Link>
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        );
    }

    const navItems = [
        { label: 'My Bookings', href: '/my-bookings', icon: Calendar },
        { label: 'Payments', href: '/payments', icon: CreditCard },
        { label: 'My Roommates', href: '/my-roommates', icon: Users },
        { label: 'Bank Accounts', href: '/bank-accounts', icon: Banknote },
        { label: 'Settings', href: '/settings', icon: Settings },
    ];

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <Sidebar collapsible="icon" className="border-r border-border/50 bg-white/50 backdrop-blur-xl">
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
                                <span className="font-bold text-sm text-foreground truncate">{appUser?.fullName || 'User'}</span>
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
                                                try {
                                                    await firebaseSignOut(auth);
                                                    router.push('/login');
                                                } catch (e) {
                                                    toast({ title: 'Sign out failed', variant: 'destructive' });
                                                }
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
                    <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                            onClick={() => window.dispatchEvent(new CustomEvent('openProfileDialog'))}
                        >
                            <Edit className="h-3 w-3 mr-2" />
                            Edit Profile
                        </Button>
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="flex flex-col min-w-0">
                    <Header />
                    <main className="flex-1 overflow-x-hidden pt-4 pb-24 md:pb-8">
                        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
                            <div className="mb-10 text-center md:text-left">
                                <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground mb-2">My Bookings</h1>
                                <p className="text-muted-foreground text-sm max-w-lg">Manage your secured rooms, tenancy agreements, and visit history in one place.</p>
                            </div>

                            <div className="space-y-12">
                                {/* Secured Hostels History Section */}
                                <section>
                                    <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                                <ShieldCheck className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold font-headline">Secured Hostels</h2>
                                                <p className="text-xs text-muted-foreground">Your paid bookings with official tenancy agreements.</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 text-xs font-semibold"
                                            onClick={() => handleOpenComplaint(null)}
                                        >
                                            <ShieldAlert className="h-4 w-4 mr-1.5 text-amber-600" />
                                            File Complaint to Dean
                                        </Button>
                                    </div>

                                    <Tabs defaultValue="confirmed" className="w-full">
                                        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6 flex flex-wrap h-auto gap-1">
                                            {[
                                                { id: 'confirmed', label: 'Secured', count: filteredBookings('confirmed').length },
                                                { id: 'pending', label: 'Pending', count: filteredBookings('pending').length },
                                                { id: 'completed', label: 'Completed', count: filteredBookings('completed').length },
                                                { id: 'cancelled', label: 'Cancelled', count: filteredBookings('cancelled').length },
                                            ].map((tab) => (
                                                <TabsTrigger
                                                    key={tab.id}
                                                    value={tab.id}
                                                    className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md text-xs font-bold tracking-wide transition-all"
                                                >
                                                    {tab.label.toUpperCase()} ({tab.count})
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {['confirmed', 'pending', 'completed', 'cancelled'].map((status) => (
                                            <TabsContent key={status} value={status} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                {filteredBookings(status).length > 0 ? (
                                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                                                        {filteredBookings(status).map(booking => (
                                                            <BookingCard key={booking.id} booking={booking} onOpenComplaint={handleOpenComplaint} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2rem] border border-dashed border-border/60">
                                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                                            <Briefcase className="h-8 w-8 text-muted-foreground/40" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">No {status} bookings found</p>
                                                        {status === 'confirmed' && (
                                                            <Button asChild className="mt-4 rounded-xl" size="sm">
                                                                <Link href="/#all-hostels">Find a Hostel</Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                </section>

                                {/* Visit Booking History Section */}
                                <section id="visits-section">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent-foreground">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold font-headline">Visit History</h2>
                                            <p className="text-xs text-muted-foreground">Track all your scheduled hostel viewing requests.</p>
                                        </div>
                                    </div>

                                    <Tabs defaultValue="pending" className="w-full">
                                        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6 flex flex-wrap h-auto gap-1">
                                            {[
                                                { id: 'pending', label: 'Pending', count: filteredVisits('pending').length },
                                                { id: 'accepted', label: 'Confirmed', count: filteredVisits('accepted').length },
                                                { id: 'completed', label: 'Completed', count: filteredVisits('completed').length },
                                                { id: 'cancelled', label: 'Cancelled', count: filteredVisits('cancelled').length },
                                            ].map((tab) => (
                                                <TabsTrigger
                                                    key={tab.id}
                                                    value={tab.id}
                                                    className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md text-xs font-bold tracking-wide"
                                                >
                                                    {tab.label.toUpperCase()} ({tab.count})
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {['pending', 'accepted', 'completed', 'cancelled'].map((status) => (
                                            <TabsContent key={status} value={status} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                {filteredVisits(status).length > 0 ? (
                                                    <div className="grid gap-6 md:grid-cols-2">
                                                        {filteredVisits(status).map(visit => (
                                                            <VisitCard key={visit.id} visit={visit} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2rem] border border-dashed border-border/60">
                                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                                            <Calendar className="h-8 w-8 text-muted-foreground/40" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">No {status} visits found</p>
                                                    </div>
                                                )}
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                </section>
                            </div>
                        </div>

                        {/* Complaint Submission Dialog */}
                        <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
                            <DialogContent className="max-w-lg rounded-2xl">
                                <DialogHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                            <ShieldAlert className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-lg font-bold">File Complaint to Dean of Students</DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Dispute submission directly reviewed by the Dean of Students office.
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <form onSubmit={handleSubmitComplaint} className="space-y-4 pt-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="complaint-hostel" className="text-xs font-semibold">Hostel Name</Label>
                                        <Input
                                            id="complaint-hostel"
                                            placeholder="Enter hostel name"
                                            value={complaintHostelName}
                                            onChange={(e) => setComplaintHostelName(e.target.value)}
                                            required
                                            className="h-10 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="complaint-category" className="text-xs font-semibold">Category</Label>
                                            <Select
                                                value={complaintCategory}
                                                onValueChange={(val: any) => setComplaintCategory(val)}
                                            >
                                                <SelectTrigger id="complaint-category" className="h-10 rounded-xl">
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Sanitation & Water">Sanitation & Water</SelectItem>
                                                    <SelectItem value="Pricing & Overcharging">Pricing & Overcharging</SelectItem>
                                                    <SelectItem value="Security & Safety">Security & Safety</SelectItem>
                                                    <SelectItem value="Maintenance & Repairs">Maintenance & Repairs</SelectItem>
                                                    <SelectItem value="Noise & Disturbance">Noise & Disturbance</SelectItem>
                                                    <SelectItem value="Conduct & Policy">Conduct & Policy</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="complaint-room" className="text-xs font-semibold">Room Number (Optional)</Label>
                                            <Input
                                                id="complaint-room"
                                                placeholder="e.g. A12"
                                                value={complaintRoomNumber}
                                                onChange={(e) => setComplaintRoomNumber(e.target.value)}
                                                className="h-10 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="complaint-subject" className="text-xs font-semibold">Subject / Title</Label>
                                        <Input
                                            id="complaint-subject"
                                            placeholder="e.g. Water outage persistent for 3 days"
                                            value={complaintSubject}
                                            onChange={(e) => setComplaintSubject(e.target.value)}
                                            required
                                            className="h-10 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="complaint-desc" className="text-xs font-semibold">Detailed Description</Label>
                                        <Textarea
                                            id="complaint-desc"
                                            placeholder="Provide full details of the incident or unresolved issue..."
                                            value={complaintDescription}
                                            onChange={(e) => setComplaintDescription(e.target.value)}
                                            rows={4}
                                            required
                                            className="rounded-xl resize-none"
                                        />
                                    </div>

                                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>Submitting this complaint alerts the Dean of Students. False reports may be subject to disciplinary review.</span>
                                    </div>

                                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setComplaintDialogOpen(false)}
                                            disabled={isSubmittingComplaint}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                            disabled={isSubmittingComplaint}
                                        >
                                            {isSubmittingComplaint ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                "Submit Official Complaint"
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}

function BookingCard({ booking, onOpenComplaint }: { booking: EnhancedBooking; onOpenComplaint: (booking: EnhancedBooking) => void }) {
    const router = useRouter();
    const { toast } = useToast();
    const statusInfo = getStatusInfo(booking.status);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const isCompleted = booking.status === 'completed';

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete this booking for ${booking.hostelName}?`)) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'bookings', booking.id));
            toast({ title: "Booking Deleted" });
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleMarkCompleted = async () => {
        if (isCompleted || !window.confirm(`Mark stay at ${booking.hostelName} as finished?`)) return;
        setIsCompleting(true);
        try {
            await updateDoc(doc(db, 'bookings', booking.id), { status: 'completed' });
            toast({ title: 'Stay marked as finished' });
        } catch (error) {
            toast({ title: 'Update failed', variant: 'destructive' });
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <Card className="overflow-hidden border-border/40 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] glass-card dark:bg-card">
            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-lg text-foreground truncate max-w-[180px] sm:max-w-none">{booking.hostelName}</h3>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">ID: #{booking.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    <Badge variant={statusInfo.variant} className={cn("rounded-full px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase", statusInfo.className)}>
                        {statusInfo.icon}
                        {statusInfo.text}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-border/40">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Secured Date</p>
                        <p className="font-semibold text-sm flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-primary/60" />
                            {booking.bookingDate}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Room Type</p>
                        <p className="font-semibold text-sm flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                            {booking.roomType}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Room No.</p>
                        <p className="font-semibold text-sm flex items-center gap-2 text-primary">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {booking.roomNumber}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tenant</p>
                        <p className="font-semibold text-sm truncate flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-primary/60" />
                            {booking.bookedBy}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 rounded-xl font-bold h-10 hover:bg-muted"
                        onClick={() => router.push(`/invoice/${booking.id}`)}
                    >
                        <Receipt className="mr-2 h-4 w-4" />
                        Invoice
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 rounded-xl font-bold h-10 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                        onClick={() => router.push(`/agreement/${booking.id}`)}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        Agreement
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/40 text-[11px] h-9"
                        disabled={isCompleting || isCompleted}
                        onClick={handleMarkCompleted}
                    >
                        {isCompleting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle className="h-3 w-3 mr-2" />}
                        {isCompleted ? 'Completed' : 'Finish Stay'}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 text-[11px] h-9"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />}
                        Delete Record
                    </Button>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 rounded-xl text-amber-800 hover:text-amber-900 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 text-[11px] h-9 border-amber-200/60 font-semibold"
                    onClick={() => onOpenComplaint(booking)}
                >
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-amber-600 shrink-0" />
                    Report Issue / File Complaint to Dean
                </Button>
            </div>
        </Card>
    );
}

function VisitCard({ visit }: { visit: EnhancedVisit }) {
    const router = useRouter();
    const { toast } = useToast();
    const statusInfo = getVisitStatusInfo(visit.status);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm(`Delete visit booking for ${visit.hostelName}?`)) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'visits', visit.id));
            toast({ title: "Visit Deleted" });
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const isCompleted = visit.status === 'completed';

    return (
        <Card className="overflow-hidden border-border/40 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] bg-card/50 backdrop-blur-sm">
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-foreground truncate max-w-[150px]">{visit.hostelName}</h3>
                            <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">VISIT: #{visit.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    <Badge variant={statusInfo.variant} className={cn("rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide uppercase", statusInfo.className)}>
                        {statusInfo.text}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-5">
                    <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> Date
                        </span>
                        <span className="text-xs font-semibold">{visit.visitDate}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> Time
                        </span>
                        <span className="text-xs font-semibold">{visit.visitTime}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <User className="h-3 w-3" /> Host
                        </span>
                        <span className="text-xs font-semibold truncate max-w-[120px]">{visit.managerName || 'Management'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl h-9 text-xs border-primary/20 text-primary hover:bg-primary/5"
                        onClick={() => {
                            if (isCompleted) router.push(`/invoice/${visit.id}`);
                            else router.push(`/hostels/${visit.hostelId}`);
                        }}
                    >
                        {isCompleted ? <Receipt className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                        {isCompleted ? 'Receipt' : 'View Hostel'}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 rounded-xl p-0 text-red-500 hover:bg-red-50"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function getStatusInfo(status: string) {
    switch (status) {
        case 'confirmed':
            return { variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Secured', className: 'bg-green-500/10 text-green-700 border-green-200' };
        case 'pending':
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'P. Payment', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' };
        case 'cancelled':
            return { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" />, text: 'Cancelled', className: 'bg-red-500/10 text-red-700 border-red-200' };
        case 'completed':
            return { variant: 'secondary' as const, icon: <CheckCircle className="h-3 w-3" />, text: 'Completed', className: 'bg-slate-100 text-slate-600 border-slate-200' };
        default:
            return { variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, text: 'Unknown', className: '' };
    }
}

function getVisitStatusInfo(status: string) {
    switch (status) {
        case 'accepted':
            return { variant: 'default' as const, text: 'Confirmed', className: 'bg-blue-500/10 text-blue-700 border-blue-200' };
        case 'completed':
            return { variant: 'default' as const, text: 'Completed', className: 'bg-green-500/10 text-green-700 border-green-200' };
        case 'pending':
            return { variant: 'outline' as const, text: 'Pending', className: 'bg-muted text-muted-foreground' };
        case 'cancelled':
            return { variant: 'destructive' as const, text: 'Cancelled', className: 'bg-red-500/10 text-red-700 border-red-200' };
        default:
            return { variant: 'outline' as const, text: 'Unknown', className: '' };
    }
}
