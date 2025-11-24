"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Loader2,
    AlertTriangle,
    Banknote,
    PlusCircle,
    Edit,
    Trash2,
    Building2
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isPrimary: boolean;
    hostelId?: string;
    hostelName?: string;
    type: 'bank' | 'momo';
    momoNetwork?: string;
    momoNumber?: string;
    momoName?: string;
    createdAt: Timestamp;
}

interface Hostel {
    id: string;
    name: string;
    managerId: string;
}

export default function ManagerBankAccountsPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [isManager, setIsManager] = useState<boolean | null>(null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [hostels, setHostels] = useState<Hostel[]>([]);
    const { toast } = useToast();
    const router = useRouter();

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [accountType, setAccountType] = useState<'bank' | 'momo'>('bank');
    const [selectedHostelId, setSelectedHostelId] = useState('all');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [isPrimary, setIsPrimary] = useState(false);
    const [momoNetwork, setMomoNetwork] = useState('');
    const [momoNumber, setMomoNumber] = useState('');
    const [momoName, setMomoName] = useState('');

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
            
            if (!user) {
                setIsManager(false);
                setLoading(false);
                return;
            }

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data() as { role?: string };
                    setIsManager(data.role === 'hostel_manager');
                } else {
                    setIsManager(false);
                }
            } catch (error) {
                console.error('Error checking manager role:', error);
                setIsManager(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser || !isManager) {
            setLoading(false);
            return;
        }

        // Fetch manager's hostels
        const hostelsQuery = query(
            collection(db, 'hostels'),
            where('managerId', '==', currentUser.uid)
        );

        const unsubscribeHostels = onSnapshot(hostelsQuery, (snapshot) => {
            const fetchedHostels = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Hostel));
            setHostels(fetchedHostels);
        });

        // Fetch bank accounts for manager's hostels
        const accountsQuery = query(
            collection(db, 'bankAccounts'),
            where('managerId', '==', currentUser.uid)
        );

        const unsubscribeAccounts = onSnapshot(accountsQuery, async (snapshot) => {
            const accounts: BankAccount[] = [];
            
            for (const docSnap of snapshot.docs) {
                const account = {
                    id: docSnap.id,
                    ...docSnap.data()
                } as BankAccount;

                // Add hostel name if hostelId exists
                if (account.hostelId) {
                    const hostelDoc = await getDoc(doc(db, 'hostels', account.hostelId));
                    if (hostelDoc.exists()) {
                        account.hostelName = hostelDoc.data().name;
                    }
                }
                
                accounts.push(account);
            }

            setBankAccounts(accounts);
            setLoading(false);
        });

        return () => {
            unsubscribeHostels();
            unsubscribeAccounts();
        };
    }, [currentUser, isManager]);

    const handleAddAccount = async () => {
        if (!currentUser) return;

        if (accountType === 'bank') {
            if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
                toast({
                    title: 'Missing information',
                    description: 'Please fill in all bank account fields.',
                    variant: 'destructive'
                });
                return;
            }
        } else {
            if (!momoNetwork.trim() || !momoNumber.trim() || !momoName.trim()) {
                toast({
                    title: 'Missing information',
                    description: 'Please fill in all mobile money fields.',
                    variant: 'destructive'
                });
                return;
            }
        }

        try {
            setSubmitting(true);
            
            const accountData: any = {
                managerId: currentUser.uid,
                type: accountType,
                isPrimary,
                createdAt: new Date(),
            };

            if (selectedHostelId && selectedHostelId !== 'all') {
                accountData.hostelId = selectedHostelId;
            }

            if (accountType === 'bank') {
                accountData.bankName = bankName.trim();
                accountData.accountNumber = accountNumber.trim();
                accountData.accountName = accountName.trim();
            } else {
                accountData.momoNetwork = momoNetwork.trim();
                accountData.momoNumber = momoNumber.trim();
                accountData.momoName = momoName.trim();
            }

            // If setting as primary, unset other primary accounts
            if (isPrimary) {
                const primaryAccounts = bankAccounts.filter(acc => acc.isPrimary);
                for (const acc of primaryAccounts) {
                    await updateDoc(doc(db, 'bankAccounts', acc.id), { isPrimary: false });
                }
            }

            await addDoc(collection(db, 'bankAccounts'), accountData);
            
            setAddDialogOpen(false);
            resetForm();
            toast({
                title: 'Account added',
                description: 'Payment account has been added successfully.'
            });
        } catch (error) {
            console.error('Error adding bank account:', error);
            toast({
                title: 'Error adding account',
                description: 'Please try again later.',
                variant: 'destructive'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditAccount = async () => {
        if (!selectedAccount) return;

        try {
            setSubmitting(true);
            
            const accountData: any = {
                isPrimary,
            };

            if (selectedAccount.type === 'bank') {
                accountData.bankName = bankName.trim();
                accountData.accountNumber = accountNumber.trim();
                accountData.accountName = accountName.trim();
            } else {
                accountData.momoNetwork = momoNetwork.trim();
                accountData.momoNumber = momoNumber.trim();
                accountData.momoName = momoName.trim();
            }

            // If setting as primary, unset other primary accounts
            if (isPrimary && !selectedAccount.isPrimary) {
                const primaryAccounts = bankAccounts.filter(acc => acc.isPrimary && acc.id !== selectedAccount.id);
                for (const acc of primaryAccounts) {
                    await updateDoc(doc(db, 'bankAccounts', acc.id), { isPrimary: false });
                }
            }

            await updateDoc(doc(db, 'bankAccounts', selectedAccount.id), accountData);
            
            setEditDialogOpen(false);
            resetForm();
            toast({
                title: 'Account updated',
                description: 'Payment account has been updated successfully.'
            });
        } catch (error) {
            console.error('Error updating bank account:', error);
            toast({
                title: 'Error updating account',
                description: 'Please try again later.',
                variant: 'destructive'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteAccount = async (account: BankAccount) => {
        if (!confirm('Are you sure you want to delete this payment account? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'bankAccounts', account.id));
            toast({
                title: 'Account deleted',
                description: 'Payment account has been deleted successfully.'
            });
        } catch (error) {
            console.error('Error deleting bank account:', error);
            toast({
                title: 'Error deleting account',
                description: 'Please try again later.',
                variant: 'destructive'
            });
        }
    };

    const openEditDialog = (account: BankAccount) => {
        setSelectedAccount(account);
        setAccountType(account.type);
        setBankName(account.bankName || '');
        setAccountNumber(account.accountNumber || '');
        setAccountName(account.accountName || '');
        setMomoNetwork(account.momoNetwork || '');
        setMomoNumber(account.momoNumber || '');
        setMomoName(account.momoName || '');
        setIsPrimary(account.isPrimary);
        setSelectedHostelId(account.hostelId || 'all');
        setEditDialogOpen(true);
    };

    const resetForm = () => {
        setAccountType('bank');
        setBankName('');
        setAccountNumber('');
        setAccountName('');
        setMomoNetwork('');
        setMomoNumber('');
        setMomoName('');
        setIsPrimary(false);
        setSelectedHostelId('all');
        setSelectedAccount(null);
    };

    if (loadingAuth || isManager === null) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }

    if (!currentUser || !isManager) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                    <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as a Hostel Manager to view this page.
                        </AlertDescription>
                    </Alert>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 p-3 sm:p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payment Accounts</h1>
                            <p className="text-sm text-muted-foreground">Manage bank accounts and mobile money for your hostels</p>
                        </div>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Account
                        </Button>
                    </div>

                    <Alert className="mb-6">
                        <Banknote className="h-4 w-4" />
                        <AlertTitle>Payment Information</AlertTitle>
                        <AlertDescription>
                            These bank accounts and mobile money numbers will be displayed to students for making payments. 
                            Make sure to keep them updated and mark one as primary for each hostel.
                        </AlertDescription>
                    </Alert>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Your Payment Accounts</CardTitle>
                                <CardDescription>
                                    Bank accounts and mobile money numbers for receiving payments
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {bankAccounts.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Details</TableHead>
                                                <TableHead>Hostel</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bankAccounts.map((account) => (
                                                <TableRow key={account.id}>
                                                    <TableCell>
                                                        <Badge variant={account.type === 'bank' ? 'default' : 'secondary'}>
                                                            {account.type === 'bank' ? 'Bank' : 'MoMo'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            {account.type === 'bank' ? (
                                                                <>
                                                                    <p className="font-medium">{account.bankName}</p>
                                                                    <p className="text-muted-foreground">Account: {account.accountNumber}</p>
                                                                    <p className="text-muted-foreground">Name: {account.accountName}</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="font-medium">{account.momoNetwork}</p>
                                                                    <p className="text-muted-foreground">Number: {account.momoNumber}</p>
                                                                    <p className="text-muted-foreground">Name: {account.momoName}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">
                                                                {account.hostelName || 'All Hostels'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {account.isPrimary && (
                                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                                Primary
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openEditDialog(account)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDeleteAccount(account)}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-16">
                                        <Banknote className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-lg text-muted-foreground">No payment accounts found.</p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Add your first bank account or mobile money number to start receiving payments.
                                        </p>
                                        <Button onClick={() => setAddDialogOpen(true)}>
                                            <PlusCircle className="h-4 w-4 mr-2" />
                                            Add Your First Account
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Add Account Dialog */}
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Payment Account</DialogTitle>
                            <DialogDescription>
                                Add a new bank account or mobile money number for receiving payments.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="accountType">Account Type</Label>
                                <Select value={accountType} onValueChange={(value: 'bank' | 'momo') => setAccountType(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank">Bank Account</SelectItem>
                                        <SelectItem value="momo">Mobile Money</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="hostel">Hostel (Optional)</Label>
                                <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All hostels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Hostels</SelectItem>
                                        {hostels.map((hostel) => (
                                            <SelectItem key={hostel.id} value={hostel.id}>
                                                {hostel.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {accountType === 'bank' ? (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="bankName">Bank Name</Label>
                                        <Input
                                            id="bankName"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            placeholder="e.g., Ghana Commercial Bank"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="accountNumber">Account Number</Label>
                                        <Input
                                            id="accountNumber"
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                            placeholder="e.g., 1234567890"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="accountName">Account Name</Label>
                                        <Input
                                            id="accountName"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            placeholder="e.g., HostelHQ Ltd"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="momoNetwork">Mobile Network</Label>
                                        <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select network" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MTN">MTN</SelectItem>
                                                <SelectItem value="Vodafone">Vodafone</SelectItem>
                                                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="momoNumber">Mobile Money Number</Label>
                                        <Input
                                            id="momoNumber"
                                            value={momoNumber}
                                            onChange={(e) => setMomoNumber(e.target.value)}
                                            placeholder="e.g., 0241234567"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="momoName">Account Name</Label>
                                        <Input
                                            id="momoName"
                                            value={momoName}
                                            onChange={(e) => setMomoName(e.target.value)}
                                            placeholder="e.g., HostelHQ Ltd"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="isPrimary"
                                    checked={isPrimary}
                                    onChange={(e) => setIsPrimary(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="isPrimary">Set as primary account</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddAccount} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Account
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Account Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Payment Account</DialogTitle>
                            <DialogDescription>
                                Update the bank account or mobile money details.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editHostel">Hostel (Optional)</Label>
                                <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All hostels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Hostels</SelectItem>
                                        {hostels.map((hostel) => (
                                            <SelectItem key={hostel.id} value={hostel.id}>
                                                {hostel.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {accountType === 'bank' ? (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editBankName">Bank Name</Label>
                                        <Input
                                            id="editBankName"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            placeholder="e.g., Ghana Commercial Bank"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editAccountNumber">Account Number</Label>
                                        <Input
                                            id="editAccountNumber"
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                            placeholder="e.g., 1234567890"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editAccountName">Account Name</Label>
                                        <Input
                                            id="editAccountName"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            placeholder="e.g., HostelHQ Ltd"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editMomoNetwork">Mobile Network</Label>
                                        <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select network" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MTN">MTN</SelectItem>
                                                <SelectItem value="Vodafone">Vodafone</SelectItem>
                                                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editMomoNumber">Mobile Money Number</Label>
                                        <Input
                                            id="editMomoNumber"
                                            value={momoNumber}
                                            onChange={(e) => setMomoNumber(e.target.value)}
                                            placeholder="e.g., 0241234567"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="editMomoName">Account Name</Label>
                                        <Input
                                            id="editMomoName"
                                            value={momoName}
                                            onChange={(e) => setMomoName(e.target.value)}
                                            placeholder="e.g., HostelHQ Ltd"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="editIsPrimary"
                                    checked={isPrimary}
                                    onChange={(e) => setIsPrimary(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="editIsPrimary">Set as primary account</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleEditAccount} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Account
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
