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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
    PlusCircle,
    Upload,
    Receipt,
    Eye,
    ShieldCheck,
    Building2,
    ArrowRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BankAccount {
    id: string;
    managerId: string;
    hostelId?: string;
    type: 'bank' | 'momo';
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    momoNetwork?: string;
    momoNumber?: string;
    momoName?: string;
    isPrimary: boolean;
    createdAt?: any;
    hostelName?: string;
    managerName?: string;
}

interface PaymentProof {
    id: string;
    accountId: string;
    accountType: 'bank' | 'momo';
    managerId: string;
    hostelId: string;
    proofImageUrl: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: any;
    reviewedAt?: any;
    reviewedBy?: string;
    rejectionReason?: string;
    studentName: string;
    studentEmail: string;
}

interface AppUser {
    uid: string;
    email: string;
    fullName: string;
    role: string;
    profileImage?: string;
    phone?: string;
}

export default function BankAccountsPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
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
                });
            } else {
                setAppUser(null);
            }
        });

        const fetchBankData = async () => {
            setLoading(true);
            const bookingsQuery = query(
                collection(db, "bookings"),
                where("studentId", "==", currentUser.uid)
            );

            const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
                try {
                    const bookings = snapshot.docs.map(d => d.data() as { hostelId?: string });
                    const hostelIds = Array.from(new Set(bookings.map(b => b.hostelId).filter(Boolean))) as string[];
                    const accounts: BankAccount[] = [];

                    for (const hostelId of hostelIds) {
                        const bankAccountsQuery = query(collection(db, "bankAccounts"), where("hostelId", "==", hostelId));
                        const bankAccountsSnap = await getDocs(bankAccountsQuery);
                        bankAccountsSnap.forEach((docSnap) => {
                            const accountData = docSnap.data();
                            accounts.push({
                                id: docSnap.id,
                                ...accountData,
                                hostelName: "",
                                managerName: "",
                            } as BankAccount);
                        });
                    }

                    const enrichedAccounts = await Promise.all(accounts.map(async (account) => {
                        const [hostelSnap, managerSnap] = await Promise.all([
                            getDoc(doc(db, "hostels", account.hostelId!)),
                            getDoc(doc(db, "users", account.managerId))
                        ]);
                        return {
                            ...account,
                            hostelName: hostelSnap.exists() ? hostelSnap.data().name : "Unknown Hostel",
                            managerName: managerSnap.exists() ? managerSnap.data().fullName || managerSnap.data().email : "Unknown Manager"
                        };
                    }));

                    setBankAccounts(enrichedAccounts);

                    const paymentProofsQuery = query(collection(db, "paymentProofs"), where("studentId", "==", currentUser.uid));
                    const paymentProofsSnap = await getDocs(paymentProofsQuery);
                    setPaymentProofs(paymentProofsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PaymentProof[]);
                    setLoading(false);
                } catch (err) {
                    setLoading(false);
                }
            });

            return unsubscribeBookings;
        };

        const unsubscribeBankDataP = fetchBankData();

        return () => {
            unsubscribeUserProfile();
            unsubscribeBankDataP.then(unsub => unsub());
        };
    }, [currentUser]);

    const handlePaymentProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedAccount || !currentUser) return;

        setUploadingProof(true);
        try {
            const { uploadImage } = await import('@/lib/cloudinary');
            const imageUrl = await uploadImage(file);
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            await addDoc(collection(db, 'paymentProofs'), {
                studentId: currentUser.uid,
                accountId: selectedAccount.id,
                accountType: selectedAccount.type,
                managerId: selectedAccount.managerId,
                hostelId: selectedAccount.hostelId,
                proofImageUrl: imageUrl,
                status: 'pending',
                submittedAt: serverTimestamp(),
                studentName: appUser?.fullName || appUser?.email,
                studentEmail: appUser?.email,
            });

            toast({ title: "Proof Uploaded", description: "Manager will review and confirm." });
            setUploadDialogOpen(false);
            setSelectedAccount(null);
        } catch (error) {
            toast({ title: "Upload Failed", variant: "destructive" });
        } finally {
            setUploadingProof(false);
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
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
                            <div className="mb-10 text-center md:text-left">
                                <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground mb-2">Hostel Bank Accounts</h1>
                                <p className="text-muted-foreground text-sm max-w-lg">Official payment channels for your secured hostels.</p>
                            </div>

                            <Alert variant="default" className="mb-8 border-yellow-500/20 bg-yellow-500/5 text-yellow-800 rounded-3xl">
                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                <AlertTitle className="font-black uppercase text-xs tracking-widest">Important Reminder</AlertTitle>
                                <AlertDescription className="mt-1 text-sm font-medium">
                                    Official receipts must be collected from the Hostel management after a successful transfer for full security.
                                </AlertDescription>
                            </Alert>

                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {/* Bank Accounts Grid */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                                <Banknote className="h-5 w-5" />
                                            </div>
                                            <h2 className="text-xl font-bold font-headline">Available Accounts</h2>
                                        </div>
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            {bankAccounts.map(account => (
                                                <Card key={account.id} className="rounded-[2rem] border-border/40 shadow-sm glass-card overflow-hidden hover:shadow-xl transition-all duration-300">
                                                    <div className="p-6">
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center">
                                                                <Building2 className="h-6 w-6 text-primary" />
                                                            </div>
                                                            {account.isPrimary && <Badge className="rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">Primary</Badge>}
                                                        </div>
                                                        <h3 className="font-bold text-lg mb-1">{account.type === 'bank' ? account.bankName : account.momoNetwork}</h3>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{account.hostelName}</p>

                                                        <div className="space-y-3 pt-4 border-t border-border/40 text-sm">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Account Holder</span>
                                                                <span className="font-semibold">{account.type === 'bank' ? account.accountName : account.momoName}</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{account.type === 'bank' ? 'Account Number' : 'MoMo Number'}</span>
                                                                <span className="font-mono font-bold text-primary tracking-wider">{account.type === 'bank' ? account.accountNumber : account.momoNumber}</span>
                                                            </div>
                                                        </div>

                                                        <Button
                                                            variant="outline"
                                                            className="w-full mt-6 rounded-2xl border-primary/20 text-primary font-bold h-11 hover:bg-primary/5"
                                                            onClick={() => {
                                                                setSelectedAccount(account);
                                                                setUploadDialogOpen(true);
                                                            }}
                                                        >
                                                            <Upload className="mr-2 h-4 w-4" /> Upload Proof
                                                        </Button>
                                                    </div>
                                                </Card>
                                            ))}
                                            {bankAccounts.length === 0 && (
                                                <div className="col-span-full py-20 bg-muted/20 border border-dashed rounded-[2rem] flex flex-col items-center justify-center">
                                                    <Banknote className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                                    <p className="text-muted-foreground font-medium">No official accounts found for your booked hostels.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Proofs Section */}
                                    {paymentProofs.length > 0 && (
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                    <Receipt className="h-5 w-5" />
                                                </div>
                                                <h2 className="text-xl font-bold font-headline">Submission History</h2>
                                            </div>
                                            <div className="grid gap-4">
                                                {paymentProofs.map(proof => (
                                                    <Card key={proof.id} className="rounded-3xl border-border/40 shadow-sm glass-card overflow-hidden">
                                                        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                                                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-sm">Transfer Receipt</p>
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Submitted {new Date(proof.submittedAt?.toDate()).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant={proof.status === 'approved' ? 'default' : proof.status === 'rejected' ? 'destructive' : 'secondary'} className="rounded-full px-4 text-[10px] font-bold uppercase tracking-widest">
                                                                    {proof.status}
                                                                </Badge>
                                                                <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={() => window.open(proof.proofImageUrl, '_blank')}>
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>

                    {/* Dialog */}
                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                        <DialogContent className="rounded-[2rem] max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black">Upload Proof</DialogTitle>
                                <DialogDescription>Help us confirm your payment faster by uploading your transfer screenshot.</DialogDescription>
                            </DialogHeader>
                            <div className="py-6 space-y-4">
                                <div className="p-4 bg-muted/40 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-4 min-h-[160px] relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handlePaymentProofUpload}
                                        disabled={uploadingProof}
                                    />
                                    {uploadingProof ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    ) : (
                                        <>
                                            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                                                <Upload className="h-6 w-6 text-primary" />
                                            </div>
                                            <p className="text-xs font-bold text-muted-foreground text-center">TAP TO SELECT IMAGE<br /><span className="font-normal opacity-60">PNG, JPG or PDF</span></p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
