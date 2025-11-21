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
    Menu,
    PlusCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isPrimary: boolean;
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
  };
}

export default function BankAccountsPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
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
                    privacySettings: userData.privacySettings,
                });
            } else {
                setAppUser(null);
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAppUser(null);
        });

        const bankAccountsQuery = query(collection(db, `users/${currentUser.uid}/bankAccounts`));
        const unsubscribeBankAccounts = onSnapshot(bankAccountsQuery, (snapshot) => {
            const fetchedAccounts = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as BankAccount[];
            setBankAccounts(fetchedAccounts);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bank accounts:", error);
            toast({ title: "Error fetching bank accounts", variant: 'destructive' });
            setLoading(false);
        });

        return () => {
            unsubscribeUserProfile();
            unsubscribeBankAccounts();
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
                            You must be logged in to view your bank accounts.
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
                                        <SidebarMenuButton asChild isActive={false}>
                                            <Link href="/my-roommates">
                                                <Users />
                                                <span>My Roommates</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive>
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
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Bank Accounts</h1>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                        <AlertTitle>Important Note</AlertTitle>
                                        <AlertDescription>
                                            Pay in Slip must be returned to the Hostel before the payments can be reflected.
                                        </AlertDescription>
                                    </Alert>

                                    {bankAccounts.length > 0 ? (
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {bankAccounts.map(account => (
                                                <Card key={account.id} className="bg-white shadow-md rounded-lg p-6">
                                                    <h3 className="font-semibold text-lg">{account.bankName}</h3>
                                                    <p className="text-sm text-muted-foreground">Account No: {account.accountNumber}</p>
                                                    <p className="text-sm text-muted-foreground">Name: {account.accountName}</p>
                                                    {account.isPrimary && <Badge className="mt-2">Primary</Badge>}
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <Banknote className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                            <p className="text-lg text-muted-foreground">No bank account details found.</p>
                                            <Button className="mt-4">
                                                <PlusCircle className="h-4 w-4 mr-2" /> Add New Bank Account
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}


