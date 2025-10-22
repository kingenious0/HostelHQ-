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
    User as UserIcon,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    FileText,
    Menu
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface Roommate {
    uid: string;
    fullName: string;
    profileImage?: string;
    email: string;
    phone?: string;
    // Add privacy settings if needed
}

interface Booking {
    id: string;
    hostelId: string;
    hostelName: string;
    roomNumber?: string;
    roomType?: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    studentId: string;
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
  privacySettings?: { // Example structure for privacy settings
    showPicture: boolean;
    showProfile: boolean;
    showProgrammeOfStudy: boolean;
    showPhoneNumber: boolean;
    showEmailAddress: boolean;
  };
}

export default function MyRoommatesPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [roommates, setRoommates] = useState<Roommate[]>([]);
    const [userBookings, setUserBookings] = useState<Booking[]>([]);
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

        // Listen for real-time updates to the current user's profile
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
                    privacySettings: userData.privacySettings, // Fetch privacy settings
                });
            } else {
                setAppUser(null);
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAppUser(null);
        });

        // Fetch user's confirmed bookings to find their room
        const bookingsQuery = query(
            collection(db, "bookings"),
            where("studentId", "==", currentUser.uid),
            where("status", "==", "confirmed")
        );
        const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
            const fetchedBookings = snapshot.docs.map(d => d.data() as Booking);
            setUserBookings(fetchedBookings);

            // Find roommates based on confirmed bookings
            const currentRoommates: Roommate[] = [];
            for (const booking of fetchedBookings) {
                if (booking.hostelId && booking.roomNumber) {
                    const roommatesInRoomQuery = query(
                        collection(db, "bookings"),
                        where("hostelId", "==", booking.hostelId),
                        where("roomNumber", "==", booking.roomNumber),
                        where("status", "==", "confirmed"),
                        where("studentId", "!=", currentUser.uid) // Exclude current user
                    );
                    const roommateSnapshots = await getDocs(roommatesInRoomQuery); // Use getDocs for a one-time fetch

                    for (const rDoc of roommateSnapshots.docs) {
                        const roommateBookingData = rDoc.data() as Booking;
                        const roommateUserDoc = await getDoc(doc(db, "users", roommateBookingData.studentId));
                        if (roommateUserDoc.exists()) {
                            const roommateData = roommateUserDoc.data() as AppUser;
                            // Apply privacy settings: for now, assume all visible if no setting specified
                            currentRoommates.push({
                                uid: roommateUserDoc.id,
                                fullName: roommateData.fullName || 'Unknown Roommate',
                                email: roommateData.email || '',
                                profileImage: roommateData.profileImage || '',
                                phone: roommateData.phone || '',
                            });
                        }
                    }
                }
            }
            setRoommates(currentRoommates);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bookings for roommates:", error);
            toast({ title: "Error fetching roommates", variant: 'destructive' });
            setLoading(false);
        });

        return () => { 
            unsubscribeUserProfile();
            unsubscribeBookings();
        };
    }, [currentUser]);

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
                            You must be logged in to view your roommates.
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
                                                <UserIcon />
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
                                        <SidebarMenuButton asChild isActive={false}>
                                            <Link href="/payments">
                                                <CreditCard />
                                                <span>Payments</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive>
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
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Roommates</h1>
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
                            ) : roommates.length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {roommates.map(roommate => (
                                        <Card key={roommate.uid} className="bg-white shadow-md rounded-lg p-6 flex items-center space-x-4">
                                            <Avatar className="h-16 w-16">
                                                {roommate.profileImage ? (
                                                    <AvatarImage src={roommate.profileImage} alt={roommate.fullName} />
                                                ) : (
                                                    <AvatarFallback>{roommate.fullName.charAt(0)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div>
                                                <h3 className="font-semibold text-lg">{roommate.fullName}</h3>
                                                <p className="text-sm text-muted-foreground">{roommate.email}</p>
                                                {roommate.phone && <p className="text-sm text-muted-foreground">{roommate.phone}</p>}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-lg text-muted-foreground">No Room Bundles in this room yet!</p>
                                    <p className="text-muted-foreground mt-2">Details of your other roommates will not be displayed if their profile sharing is off.</p>
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}


