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
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

type RoommateContactMode = 'phone' | 'whatsapp' | 'basic';

interface Roommate {
    uid: string;
    fullName: string;
    profileImage?: string;
    email: string;
    phone?: string;
    program?: string;
    level?: string;
    contactMode: RoommateContactMode;
    whatsappNumber?: string;
}

interface Booking {
    id: string;
    hostelId: string;
    hostelName: string;
    roomNumber?: string;
    roomType?: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    studentId: string;
    studentDetails?: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      program?: string;
      level?: string;
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
  privacySettings?: { // Example structure for privacy settings
    showPicture: boolean;
    showProfile: boolean;
    showProgrammeOfStudy: boolean;
    showPhoneNumber: boolean;
    showEmailAddress: boolean;
    roommateContactMode?: RoommateContactMode;
    whatsappNumber?: string;
  };
}

export default function MyRoommatesPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [roommates, setRoommates] = useState<Roommate[]>([]);
    const [userBookings, setUserBookings] = useState<Booking[]>([]);
    const [hostelMates, setHostelMates] = useState<Record<string, { hostelName: string; mates: Roommate[] }>>({});
    const [contactMode, setContactMode] = useState<RoommateContactMode>('phone');
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
                if (userData.privacySettings?.roommateContactMode) {
                    setContactMode(userData.privacySettings.roommateContactMode);
                }
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
            const fetchedBookings = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Booking[];
            setUserBookings(fetchedBookings);

            const currentRoommates: Roommate[] = [];
            const hostelMateGroups: Record<string, { hostelName: string; mates: Roommate[] }> = {};

            for (const booking of fetchedBookings) {
                if (!booking.hostelId) continue;

                // 1) Roommates in the SAME ROOM
                if (booking.roomNumber) {
                    const roommatesInRoomQuery = query(
                        collection(db, "bookings"),
                        where("hostelId", "==", booking.hostelId),
                        where("roomNumber", "==", booking.roomNumber),
                        where("status", "==", "confirmed"),
                        where("studentId", "!=", currentUser.uid)
                    );
                    const roommateSnapshots = await getDocs(roommatesInRoomQuery);

                    for (const rDoc of roommateSnapshots.docs) {
                        const roommateBookingData = rDoc.data() as Booking;
                        const roommateUserDoc = await getDoc(doc(db, "users", roommateBookingData.studentId));
                        if (roommateUserDoc.exists()) {
                            const roommateData = roommateUserDoc.data() as AppUser;
                            const privacy = roommateData.privacySettings || {};
                            if (privacy.showProfile === false) continue; // Do not display if profile sharing is off

                            const roommateContactMode: RoommateContactMode =
                              privacy.roommateContactMode || 'phone';
                            const canShowPhone = privacy.showPhoneNumber !== false;
                            const canShowEmail = privacy.showEmailAddress !== false;
                            const canShowProgramme = privacy.showProgrammeOfStudy !== false;

                            currentRoommates.push({
                                uid: roommateUserDoc.id,
                                fullName: roommateData.fullName || 'Unknown Roommate',
                                email: canShowEmail ? (roommateData.email || roommateBookingData.studentDetails?.email || '') : '',
                                profileImage: privacy.showPicture === false ? '' : (roommateData.profileImage || ''),
                                phone:
                                  canShowPhone && roommateContactMode !== 'basic'
                                    ? (roommateData.phone || roommateBookingData.studentDetails?.phoneNumber || '')
                                    : undefined,
                                whatsappNumber: privacy.whatsappNumber,
                                program: canShowProgramme ? roommateBookingData.studentDetails?.program : undefined,
                                level: canShowProgramme ? roommateBookingData.studentDetails?.level : undefined,
                                contactMode: roommateContactMode,
                            });
                        }
                    }
                }

                // 2) Hostel mates in the SAME HOSTEL (any room)
                const hostelmatesQuery = query(
                    collection(db, "bookings"),
                    where("hostelId", "==", booking.hostelId),
                    where("status", "==", "confirmed"),
                    where("studentId", "!=", currentUser.uid)
                );
                const hostelmateSnapshots = await getDocs(hostelmatesQuery);

                for (const hDoc of hostelmateSnapshots.docs) {
                    const mateBooking = hDoc.data() as Booking;
                    const mateUserDoc = await getDoc(doc(db, "users", mateBooking.studentId));
                    if (!mateUserDoc.exists()) continue;
                    const mateUser = mateUserDoc.data() as AppUser;
                    const privacy = mateUser.privacySettings || {};
                    if (privacy.showProfile === false) continue;

                    const contactModeForMate: RoommateContactMode =
                        privacy.roommateContactMode || 'phone';

                    const hostelName = mateBooking.hostelName || booking.hostelName || 'Hostel';
                    const group = hostelMateGroups[booking.hostelId] || { hostelName, mates: [] };

                    // avoid duplicates by uid
                    if (!group.mates.some(m => m.uid === mateUserDoc.id)) {
                        const canShowPhone = privacy.showPhoneNumber !== false;
                        const canShowEmail = privacy.showEmailAddress !== false;
                        const canShowProgramme = privacy.showProgrammeOfStudy !== false;

                        group.mates.push({
                            uid: mateUserDoc.id,
                            fullName: mateUser.fullName || 'Hostel mate',
                            email: canShowEmail ? (mateUser.email || mateBooking.studentDetails?.email || '') : '',
                            profileImage: privacy.showPicture === false ? '' : (mateUser.profileImage || ''),
                            phone:
                              canShowPhone && contactModeForMate !== 'basic'
                                ? (mateUser.phone || mateBooking.studentDetails?.phoneNumber || '')
                                : undefined,
                            whatsappNumber: privacy.whatsappNumber,
                            program: canShowProgramme ? mateBooking.studentDetails?.program : undefined,
                            level: canShowProgramme ? mateBooking.studentDetails?.level : undefined,
                            contactMode: contactModeForMate,
                        });
                        hostelMateGroups[booking.hostelId] = group;
                    }
                }
            }

            setRoommates(currentRoommates);
            setHostelMates(hostelMateGroups);
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

    const handleContactModeChange = async (mode: RoommateContactMode) => {
        if (!currentUser) return;
        setContactMode(mode);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                'privacySettings.roommateContactMode': mode,
            });
            toast({ title: 'Privacy updated' });
        } catch (error) {
            console.error('Failed to update roommate privacy mode', error);
            toast({ title: 'Could not update privacy settings', variant: 'destructive' });
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
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 md:h-8 md:w-8 p-0"
                                    onClick={() => router.push('/profile')}
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
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="flex flex-col">
                    <Header />
                    <main className="flex-1 p-2 sm:p-4 md:p-8 bg-gray-50/50">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Roommates</h1>
                            </div>

                            <Card className="mb-6 border border-muted/40 bg-card/60">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base sm:text-lg">Safety &amp; privacy</CardTitle>
                                    <CardDescription>
                                        Choose how much contact information your roommates can see. This only affects how your details appear on their My Roommates page.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1 text-sm text-muted-foreground max-w-md">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Roommate contact visibility</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={contactMode === 'phone' ? 'default' : 'outline'}
                                            onClick={() => handleContactModeChange('phone')}
                                        >
                                            Show phone to roommates
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={contactMode === 'whatsapp' ? 'default' : 'outline'}
                                            onClick={() => handleContactModeChange('whatsapp')}
                                        >
                                            WhatsApp only
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={contactMode === 'basic' ? 'default' : 'outline'}
                                            onClick={() => handleContactModeChange('basic')}
                                        >
                                            Name &amp; programme only
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Tabs defaultValue="roommates" className="w-full">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="roommates">Roommates</TabsTrigger>
                                    <TabsTrigger value="hostelMates">Hostel Mates</TabsTrigger>
                                </TabsList>

                                <TabsContent value="roommates">
                                  {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : roommates.length > 0 ? (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                      {roommates.map(roommate => (
                                        <Card key={roommate.uid} className="bg-white shadow-md rounded-lg p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-4">
                                              <Avatar className="h-12 w-12">
                                                {roommate.profileImage ? (
                                                    <AvatarImage src={roommate.profileImage} alt={roommate.fullName} />
                                                ) : (
                                                    <AvatarFallback>{roommate.fullName.charAt(0)}</AvatarFallback>
                                                )}
                                              </Avatar>
                                              <div className="space-y-1">
                                                <h3 className="font-semibold text-base sm:text-lg">{roommate.fullName}</h3>
                                                {(roommate.program || roommate.level) && (
                                                  <p className="text-xs sm:text-sm text-muted-foreground">
                                                    {[roommate.program, roommate.level && `Level ${roommate.level}`].filter(Boolean).join(' • ')}
                                                  </p>
                                                )}
                                                {roommate.contactMode !== 'basic' && roommate.email && (
                                                  <p className="text-xs sm:text-sm text-muted-foreground break-words">{roommate.email}</p>
                                                )}
                                              </div>
                                            </div>
                                            {roommate.contactMode === 'phone' && roommate.phone && (
                                              <div className="mt-1 space-y-1 text-xs sm:text-sm text-muted-foreground">
                                                <p className="font-medium text-foreground">Phone: {roommate.phone}</p>
                                                <p className="text-[11px] text-muted-foreground">This roommate chose to share their phone number with you.</p>
                                              </div>
                                            )}
                                            {roommate.contactMode === 'whatsapp' && roommate.phone && (
                                              <div className="mt-1 space-y-1 text-xs sm:text-sm text-muted-foreground">
                                                <p className="font-medium text-foreground">WhatsApp available</p>
                                                {roommate.whatsappNumber && (
                                                  <a
                                                    href={`https://wa.me/${roommate.whatsappNumber.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent("Hi, I'm your roommate from HostelHQ.")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-green-600 hover:underline text-xs sm:text-sm"
                                                  >
                                                    Tap to chat on WhatsApp
                                                  </a>
                                                )}
                                                {!roommate.whatsappNumber && (
                                                  <p className="text-[11px] text-muted-foreground">This roommate prefers WhatsApp only.</p>
                                                )}
                                              </div>
                                            )}
                                            {roommate.contactMode === 'basic' && (
                                              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                                                This roommate prefers to only share their name and programme. You can connect with them on campus.
                                              </p>
                                            )}
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
                                </TabsContent>

                                <TabsContent value="hostelMates">
                                  {loading ? (
                                    <div className="flex justify-center py-12">
                                      <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : Object.keys(hostelMates).length > 0 ? (
                                    <div className="space-y-8">
                                      {Object.entries(hostelMates).map(([hostelId, data]) => (
                                        <div key={hostelId} className="space-y-3">
                                          <div className="flex items-baseline justify-between">
                                            <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                                              Hostel mates – {data.hostelName}
                                            </h2>
                                            <span className="text-xs text-muted-foreground">
                                              {data.mates.length} student{data.mates.length !== 1 ? 's' : ''}
                                            </span>
                                          </div>
                                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {data.mates.map(mate => (
                                              <Card key={mate.uid} className="bg-white shadow-md rounded-lg p-6 flex flex-col gap-4">
                                                <div className="flex items-center gap-4">
                                                  <Avatar className="h-12 w-12">
                                                    {mate.profileImage ? (
                                                      <AvatarImage src={mate.profileImage} alt={mate.fullName} />
                                                    ) : (
                                                      <AvatarFallback>{mate.fullName.charAt(0)}</AvatarFallback>
                                                    )}
                                                  </Avatar>
                                                  <div className="space-y-1">
                                                    <h3 className="font-semibold text-base sm:text-lg">{mate.fullName}</h3>
                                                    {(mate.program || mate.level) && (
                                                      <p className="text-xs sm:text-sm text-muted-foreground">
                                                        {[mate.program, mate.level && `Level ${mate.level}`].filter(Boolean).join(' • ')}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                                                  Lives in the same hostel as you. Exact contact details depend on their privacy settings.
                                                </p>
                                              </Card>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-16">
                                      <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                      <p className="text-lg text-muted-foreground">No other students secured in your hostel yet.</p>
                                      <p className="text-muted-foreground mt-2">As more students secure this hostel, they will appear here.</p>
                                    </div>
                                  )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}


