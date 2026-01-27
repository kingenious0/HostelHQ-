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
    User as UserIcon,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    FileText,
    Menu,
    MessageSquare,
    Phone,
    Lock,
    ShieldCheck,
    Building2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    privacySettings?: {
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
                    privacySettings: userData.privacySettings,
                });
                if (userData.privacySettings?.roommateContactMode) {
                    setContactMode(userData.privacySettings.roommateContactMode);
                }
            } else {
                setAppUser(null);
            }
        });

        const fetchRoommatesData = async () => {
            setLoading(true);
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
                                if (privacy.showProfile === false) continue;

                                const rContactMode: RoommateContactMode = privacy.roommateContactMode || 'phone';
                                currentRoommates.push({
                                    uid: roommateUserDoc.id,
                                    fullName: roommateData.fullName || 'Unknown Roommate',
                                    email: privacy.showEmailAddress !== false ? (roommateData.email || roommateBookingData.studentDetails?.email || '') : '',
                                    profileImage: privacy.showPicture === false ? '' : (roommateData.profileImage || ''),
                                    phone: privacy.showPhoneNumber !== false && rContactMode !== 'basic' ? (roommateData.phone || roommateBookingData.studentDetails?.phoneNumber || '') : undefined,
                                    whatsappNumber: privacy.whatsappNumber,
                                    program: privacy.showProgrammeOfStudy !== false ? roommateBookingData.studentDetails?.program : undefined,
                                    level: privacy.showProgrammeOfStudy !== false ? roommateBookingData.studentDetails?.level : undefined,
                                    contactMode: rContactMode,
                                });
                            }
                        }
                    }

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

                        const hostelName = mateBooking.hostelName || booking.hostelName || 'Hostel';
                        const group = hostelMateGroups[booking.hostelId] || { hostelName, mates: [] };

                        if (!group.mates.some(m => m.uid === mateUserDoc.id)) {
                            const rContactMode: RoommateContactMode = privacy.roommateContactMode || 'phone';
                            group.mates.push({
                                uid: mateUserDoc.id,
                                fullName: mateUser.fullName || 'Hostel mate',
                                email: privacy.showEmailAddress !== false ? (mateUser.email || mateBooking.studentDetails?.email || '') : '',
                                profileImage: privacy.showPicture === false ? '' : (mateUser.profileImage || ''),
                                phone: privacy.showPhoneNumber !== false && rContactMode !== 'basic' ? (mateUser.phone || mateBooking.studentDetails?.phoneNumber || '') : undefined,
                                whatsappNumber: privacy.whatsappNumber,
                                program: privacy.showProgrammeOfStudy !== false ? mateBooking.studentDetails?.program : undefined,
                                level: privacy.showProgrammeOfStudy !== false ? mateBooking.studentDetails?.level : undefined,
                                contactMode: rContactMode,
                            });
                            hostelMateGroups[booking.hostelId] = group;
                        }
                    }
                }

                setRoommates(currentRoommates);
                setHostelMates(hostelMateGroups);
                setLoading(false);
            });

            return unsubscribeBookings;
        };

        const unsubscribeRoommatesDataP = fetchRoommatesData();

        return () => {
            unsubscribeUserProfile();
            unsubscribeRoommatesDataP.then(unsub => unsub());
        };
    }, [currentUser]);

    const handleContactModeChange = async (mode: RoommateContactMode) => {
        if (!currentUser) return;
        setContactMode(mode);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                'privacySettings.roommateContactMode': mode,
            });
            toast({ title: 'Privacy Updated', description: `Your contact mode is now: ${mode}` });
        } catch (error) {
            toast({ title: 'Update Failed', variant: 'destructive' });
        }
    };

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

    if (!currentUser) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/20">
                    <Alert variant="destructive" className="max-w-lg border-primary/20 bg-white shadow-xl rounded-[2rem]">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                        <AlertTitle className="text-primary font-black uppercase tracking-tight">Access Denied</AlertTitle>
                        <AlertDescription className="text-muted-foreground mt-2">
                            Please login to see your room community.
                            <Link href="/login" className="ml-2 inline-flex items-center text-primary font-bold hover:underline">
                                Login here <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
                <Sidebar collapsible="icon" className="border-r border-border/50 bg-white/50 backdrop-blur-xl">
                    <SidebarHeader className="p-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-primary/10">
                                {appUser?.profileImage ? (
                                    <AvatarImage src={appUser.profileImage} alt="Profile" />
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
                            <div className="mb-10 text-center md:text-left">
                                <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground mb-2">My Roommates</h1>
                                <p className="text-muted-foreground text-sm max-w-lg">Connect with students staying in the same room or hostel as you.</p>
                            </div>

                            {/* Privacy Controls */}
                            <Card className="mb-12 rounded-[2rem] border-transparent premium-shadow overflow-hidden bg-card/80 backdrop-blur-md">
                                <CardHeader className="pb-4 bg-primary/5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <CardTitle className="text-lg">Privacy Controls</CardTitle>
                                    </div>
                                    <CardDescription>Control how your roommates can contact you.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col sm:flex-row items-center gap-2 bg-muted/30 p-2 rounded-2xl">
                                        <Button
                                            variant={contactMode === 'phone' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="flex-1 rounded-xl font-bold h-10 transition-all"
                                            onClick={() => handleContactModeChange('phone')}
                                        >
                                            <Phone className="mr-2 h-4 w-4" /> Phone Visible
                                        </Button>
                                        <Button
                                            variant={contactMode === 'whatsapp' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="flex-1 rounded-xl font-bold h-10 transition-all"
                                            onClick={() => handleContactModeChange('whatsapp')}
                                        >
                                            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Only
                                        </Button>
                                        <Button
                                            variant={contactMode === 'basic' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="flex-1 rounded-xl font-bold h-10 transition-all"
                                            onClick={() => handleContactModeChange('basic')}
                                        >
                                            <ShieldCheck className="mr-2 h-4 w-4" /> Strictly Name
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Tabs defaultValue="roommates" className="w-full">
                                <TabsList className="bg-muted/50 p-1 rounded-2xl mb-8 flex h-auto">
                                    <TabsTrigger value="roommates" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-xs font-bold tracking-wide transition-all flex-1">
                                        MY ROOMMATES ({roommates.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="hostelMates" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-xs font-bold tracking-wide transition-all flex-1">
                                        HOSTEL COMMUNITY
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="roommates" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {roommates.length > 0 ? (
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            {roommates.map(mate => (
                                                <RoommateCard key={mate.uid} mate={mate} isRoommate />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2rem] border border-dashed border-border/60">
                                            <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                            <p className="text-sm font-medium text-muted-foreground">It&apos;s quiet in here... No roommates yet.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="hostelMates" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {Object.keys(hostelMates).length > 0 ? (
                                        <div className="space-y-12">
                                            {Object.entries(hostelMates).map(([hostelId, data]) => (
                                                <div key={hostelId}>
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <Building2 className="h-5 w-5 text-primary/60" />
                                                        <h2 className="font-black text-xl tracking-tight">{data.hostelName}</h2>
                                                        <Badge variant="secondary" className="rounded-full">{data.mates.length}</Badge>
                                                    </div>
                                                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                                        {data.mates.map(mate => (
                                                            <RoommateCard key={mate.uid} mate={mate} />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 flex flex-col items-center justify-center text-center bg-muted/20 rounded-[2rem] border border-dashed border-border/60">
                                            <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                            <p className="text-sm font-medium text-muted-foreground">No hostel community updates yet.</p>
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

function RoommateCard({ mate, isRoommate = false }: { mate: Roommate, isRoommate?: boolean }) {
    return (
        <Card className="rounded-[2rem] border-border/40 shadow-sm glass-card overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="relative mb-4">
                        <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                            {mate.profileImage ? (
                                <AvatarImage src={mate.profileImage} className="object-cover" />
                            ) : (
                                <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">
                                    {mate.fullName.charAt(0)}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-md">
                            {isRoommate ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <Users className="h-4 w-4 text-primary" />}
                        </div>
                    </div>
                    <h3 className="font-black text-lg text-foreground mb-1 group-hover:text-primary transition-colors">{mate.fullName}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{mate.program || 'Student'}</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/40">
                    {mate.contactMode !== 'basic' && (
                        <>
                            {mate.phone && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-bold">PHONE</span>
                                    <span className="font-semibold">{mate.phone}</span>
                                </div>
                            )}
                            {mate.email && (
                                <div className="flex items-center justify-between text-xs overflow-hidden">
                                    <span className="text-muted-foreground font-bold">EMAIL</span>
                                    <span className="font-semibold truncate ml-2">{mate.email}</span>
                                </div>
                            )}
                        </>
                    )}
                    {mate.contactMode === 'basic' && (
                        <div className="text-center py-2 px-4 bg-muted/30 rounded-xl">
                            <p className="text-[10px] font-bold text-muted-foreground italic uppercase">Private Profile</p>
                        </div>
                    )}
                </div>

                {mate.contactMode === 'whatsapp' && mate.whatsappNumber && (
                    <Button asChild className="w-full mt-6 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-11 border-none">
                        <a href={`https://wa.me/${mate.whatsappNumber.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noreferrer">
                            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
                        </a>
                    </Button>
                )}

                {mate.phone && mate.contactMode === 'phone' && (
                    <Button asChild className="w-full mt-6 rounded-2xl bg-primary text-white font-bold h-11">
                        <a href={`tel:${mate.phone}`}>
                            <Phone className="mr-2 h-4 w-4" /> Call Roommate
                        </a>
                    </Button>
                )}
            </div>
        </Card>
    );
}
