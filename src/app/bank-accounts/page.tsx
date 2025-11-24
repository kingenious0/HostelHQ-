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
    Eye
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

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
    const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
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

    // Listen to user profile
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

    // Fetch this student's bookings and then hostel payment accounts
    const bookingsQuery = query(
        collection(db, "bookings"),
        where("studentId", "==", currentUser.uid)
    );

    const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
        try {
            const bookings = snapshot.docs.map(d => d.data() as { hostelId?: string });
            const hostelIds = Array.from(
                new Set(
                    bookings
                        .map(b => b.hostelId as string | undefined)
                        .filter(Boolean)
                )
            ) as string[];

            const accounts: BankAccount[] = [];

            // Fetch bank accounts from the new bankAccounts collection
            for (const hostelId of hostelIds) {
                try {
                    const bankAccountsQuery = query(
                        collection(db, "bankAccounts"),
                        where("hostelId", "==", hostelId)
                    );
                    
                    const bankAccountsSnap = await getDocs(bankAccountsQuery);
                    
                    bankAccountsSnap.forEach((docSnap: any) => {
                        const accountData = docSnap.data() as any;
                        
                        // Get hostel and manager names for display
                        const hostelSnap = getDoc(doc(db, "hostels", hostelId));
                        const managerSnap = getDoc(doc(db, "users", accountData.managerId));
                        
                        accounts.push({
                            id: docSnap.id,
                            managerId: accountData.managerId,
                            hostelId: accountData.hostelId,
                            type: accountData.type,
                            bankName: accountData.bankName || "",
                            accountNumber: accountData.accountNumber || "",
                            accountName: accountData.accountName || "",
                            momoNetwork: accountData.momoNetwork || "",
                            momoNumber: accountData.momoNumber || "",
                            momoName: accountData.momoName || "",
                            isPrimary: accountData.isPrimary || false,
                            createdAt: accountData.createdAt,
                            hostelName: "", // Will be populated below
                            managerName: "", // Will be populated below
                        });
                    });
                } catch (err) {
                    console.error("Error loading bank accounts for hostel:", hostelId, err);
                }
            }

            // Populate hostel and manager names
            const enrichedAccounts = await Promise.all(
                accounts.map(async (account) => {
                    try {
                        const [hostelSnap, managerSnap] = await Promise.all([
                            getDoc(doc(db, "hostels", account.hostelId!)),
                            getDoc(doc(db, "users", account.managerId))
                        ]);
                        
                        return {
                            ...account,
                            hostelName: hostelSnap.exists() ? hostelSnap.data().name : "Unknown Hostel",
                            managerName: managerSnap.exists() ? managerSnap.data().fullName || managerSnap.data().email : "Unknown Manager"
                        };
                    } catch (err) {
                        console.error("Error enriching account:", err);
                        return account;
                    }
                })
            );

            setBankAccounts(enrichedAccounts);
            
            // Fetch student's payment proofs
            if (currentUser) {
                try {
                    const paymentProofsQuery = query(
                        collection(db, "paymentProofs"),
                        where("studentId", "==", currentUser.uid)
                    );
                    
                    const paymentProofsSnap = await getDocs(paymentProofsQuery);
                    const fetchedProofs = paymentProofsSnap.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as PaymentProof[];
                    
                    setPaymentProofs(fetchedProofs);
                } catch (err) {
                    console.error("Error fetching payment proofs:", err);
                }
            }
            
            setLoading(false);
        } catch (err) {
            console.error("Error processing bank accounts from bookings:", err);
            toast({ title: "Error fetching bank accounts", variant: "destructive" });
            setLoading(false);
        }
    }, (error: any) => {
        console.error("Error fetching bookings for bank accounts:", error);
        toast({ title: "Error fetching bank accounts", variant: "destructive" });
        setLoading(false);
    });

    return () => {
        unsubscribeUserProfile();
        unsubscribeBookings();
    };
}, [currentUser]);

    const openUploadDialog = (account: BankAccount) => {
        setSelectedAccount(account);
        setUploadDialogOpen(true);
    };

    const handlePaymentProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedAccount || !currentUser) return;

        setUploadingProof(true);
        try {
            // Import uploadImage dynamically to avoid SSR issues
            const { uploadImage } = await import('@/lib/cloudinary');
            
            const imageUrl = await uploadImage(file);
            
            // Create payment proof record
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

            toast({
                title: "Payment Proof Uploaded",
                description: "Your payment proof has been submitted. The manager will review and confirm your payment.",
            });
            
            setUploadDialogOpen(false);
            setSelectedAccount(null);
            
            // Reset file input
            event.target.value = '';
            
        } catch (error) {
            console.error('Error uploading payment proof:', error);
            toast({
                title: "Upload Failed",
                description: "Failed to upload payment proof. Please try again.",
                variant: "destructive",
            });
        } finally {
            setUploadingProof(false);
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

                                    {/* Payment Proofs Status Section */}
                                    {paymentProofs.length > 0 && (
                                        <Card className="bg-blue-50 border-blue-200">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-blue-900">
                                                    <Receipt className="h-5 w-5" />
                                                    Your Payment Proofs ({paymentProofs.length})
                                                </CardTitle>
                                                <CardDescription className="text-blue-700">
                                                    Track the status of your submitted payment proofs
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {paymentProofs.map((proof) => (
                                                        <div key={proof.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Badge variant={
                                                                        proof.status === 'approved' ? 'default' :
                                                                        proof.status === 'rejected' ? 'destructive' : 'secondary'
                                                                    }>
                                                                        {proof.status === 'approved' ? 'Approved' :
                                                                         proof.status === 'rejected' ? 'Rejected' : 'Pending'}
                                                                    </Badge>
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {proof.accountType === 'bank' ? 'Bank Transfer' : proof.momoNetwork}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-medium">
                                                                    Submitted {proof.submittedAt?.toDate()?.toLocaleDateString('en-US', {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    }) || 'Recently'}
                                                                </p>
                                                                {proof.status === 'rejected' && proof.rejectionReason && (
                                                                    <p className="text-sm text-red-600 mt-1">
                                                                        Reason: {proof.rejectionReason}
                                                                    </p>
                                                                )}
                                                                {proof.status === 'approved' && (
                                                                    <p className="text-sm text-green-600 mt-1">
                                                                        ✓ Your booking has been confirmed!
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => window.open(proof.proofImageUrl, '_blank')}
                                                                >
                                                                    <Eye className="h-3 w-3 mr-1" />
                                                                    View
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {bankAccounts.length > 0 ? (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {bankAccounts.map(account => (
      <Card key={account.id} className="bg-white shadow-md rounded-lg p-6 space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            {account.type === 'bank' ? (account.bankName || "Bank Account") : `${account.momoNetwork || "Mobile Money"}`}
          </h3>
          {account.isPrimary && <Badge className="text-xs">Primary</Badge>}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Hostel: {account.hostelName || "Unknown Hostel"}</p>
          <p>Manager: {account.managerName || "Unknown Manager"}</p>
        </div>

        {account.type === 'bank' ? (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">Bank Transfer Details</p>
            {account.bankName && (
              <p className="text-muted-foreground">Bank: {account.bankName}</p>
            )}
            {account.accountNumber && (
              <p className="text-muted-foreground">
                Account No: <span className="font-mono">{account.accountNumber}</span>
              </p>
            )}
            {account.accountName && (
              <p className="text-muted-foreground">Account Name: {account.accountName}</p>
            )}
          </div>
        ) : (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{account.momoNetwork || "Mobile Money"} Details</p>
            {account.momoNetwork && (
              <p className="text-muted-foreground">Network: {account.momoNetwork}</p>
            )}
            {account.momoNumber && (
              <p className="text-muted-foreground">
                Number: <span className="font-mono">{account.momoNumber}</span>
              </p>
            )}
            {account.momoName && (
              <p className="text-muted-foreground">Name: {account.momoName}</p>
            )}
          </div>
        )}
        
        <div className="pt-3 border-t border-gray-100">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => openUploadDialog(account)}
          >
            <Upload className="h-3 w-3 mr-2" />
            Upload Payment Proof
          </Button>
        </div>
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
                
                {/* Upload Payment Proof Dialog */}
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Upload Payment Proof</DialogTitle>
                            <DialogDescription>
                                Upload a screenshot or receipt of your payment to {selectedAccount?.type === 'bank' ? selectedAccount?.bankName : selectedAccount?.momoNetwork}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    After making your payment, upload the proof here. The manager will review and confirm your payment.
                                </p>
                                {selectedAccount && (
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                        <p className="font-medium">
                                            {selectedAccount.type === 'bank' ? 'Bank Account' : selectedAccount.momoNetwork} Details:
                                        </p>
                                        {selectedAccount.type === 'bank' ? (
                                            <>
                                                <p>Bank: {selectedAccount.bankName}</p>
                                                <p>Account: {selectedAccount.accountNumber}</p>
                                                <p>Name: {selectedAccount.accountName}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p>Network: {selectedAccount.momoNetwork}</p>
                                                <p>Number: {selectedAccount.momoNumber}</p>
                                                <p>Name: {selectedAccount.momoName}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="payment-proof" className="text-sm font-medium">
                                    Payment Proof (Image)
                                </label>
                                <input
                                    id="payment-proof"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handlePaymentProofUpload}
                                    disabled={uploadingProof}
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setUploadDialogOpen(false)}
                                disabled={uploadingProof}
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SidebarInset>
            </div>
        </SidebarProvider>
    );
}


