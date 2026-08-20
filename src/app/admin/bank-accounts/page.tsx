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
    Building2,
    Search,
    Filter
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, getDocs } from 'firebase/firestore';
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
    managerId: string;
    managerName?: string;
    managerEmail?: string;
}

interface Hostel {
    id: string;
    name: string;
    managerId: string;
}

interface Manager {
    uid: string;
    fullName: string;
    email: string;
}

export default function AdminBankAccountsPage() {
    const [loading, setLoading] = useState(true);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [hostels, setHostels] = useState<Hostel[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const { toast } = useToast();
    const router = useRouter();

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterHostel, setFilterHostel] = useState('all');
    const [filterManager, setFilterManager] = useState('all');
    const [filterType, setFilterType] = useState<'all' | 'bank' | 'momo'>('all');

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [accountType, setAccountType] = useState<'bank' | 'momo'>('bank');
    const [selectedManagerId, setSelectedManagerId] = useState('');
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
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data() as { role?: string };
                    setIsAdmin(data.role === 'admin');
                } else {
                    setIsAdmin(false);
                }
            } catch (error) {
                console.error('Error checking admin role:', error);
                setIsAdmin(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser || !isAdmin) {
            setLoading(false);
            return;
        }

        // Fetch all hostels
        const unsubscribeHostels = onSnapshot(collection(db, 'hostels'), (snapshot) => {
            const fetchedHostels = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Hostel));
            setHostels(fetchedHostels);
        });

        // Fetch all managers
        const fetchManagers = async () => {
            try {
                const managersQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'hostel_manager')
                );
                const managersSnap = await getDocs(managersQuery);
                const fetchedManagers = managersSnap.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                } as Manager));
                setManagers(fetchedManagers);
            } catch (error) {
                console.error('Error fetching managers:', error);
            }
        };

        fetchManagers();

        // Fetch all bank accounts
        const unsubscribeAccounts = onSnapshot(collection(db, 'bankAccounts'), async (snapshot) => {
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

                // Add manager info
                if (account.managerId) {
                    const managerDoc = await getDoc(doc(db, 'users', account.managerId));
                    if (managerDoc.exists()) {
                        const managerData = managerDoc.data();
                        account.managerName = managerData.fullName || managerData.email;
                        account.managerEmail = managerData.email;
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
    }, [currentUser, isAdmin]);

    // Filter accounts
    const filteredAccounts = bankAccounts.filter(account => {
        const matchesSearch = searchTerm === '' || 
            account.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.momoNetwork?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.hostelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.managerName?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesHostel = filterHostel === 'all' || account.hostelId === filterHostel;
        const matchesManager = filterManager === 'all' || account.managerId === filterManager;
        const matchesType = filterType === 'all' || account.type === filterType;

        return matchesSearch && matchesHostel && matchesManager && matchesType;
    });

    const handleAddAccount = async () => {
        if (!currentUser) return;

        if (!selectedManagerId) {
            toast({
                title: 'Missing information',
                description: 'Please select a manager for this account.',
                variant: 'destructive'
            });
            return;
        }

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
                managerId: selectedManagerId,
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

            // If setting as primary, unset other primary accounts for the same manager/hostel
            if (isPrimary) {
                const primaryQuery = query(
                    collection(db, 'bankAccounts'),
                    where('managerId', '==', selectedManagerId),
                    where('isPrimary', '==', true)
                );
                const primarySnap = await getDocs(primaryQuery);
                
                for (const doc of primarySnap.docs) {
                    await updateDoc(doc.ref, { isPrimary: false });
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

            // If setting as primary, unset other primary accounts for the same manager
            if (isPrimary && !selectedAccount.isPrimary) {
                const primaryQuery = query(
                    collection(db, 'bankAccounts'),
                    where('managerId', '==', selectedAccount.managerId),
                    where('isPrimary', '==', true)
                );
                const primarySnap = await getDocs(primaryQuery);
                
                for (const doc of primarySnap.docs) {
                    if (doc.id !== selectedAccount.id) {
                        await updateDoc(doc.ref, { isPrimary: false });
                    }
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
        setSelectedManagerId(account.managerId || '');
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
        setSelectedManagerId('');
        setSelectedAccount(null);
    };

    if (loadingAuth || isAdmin === null) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }

    if (!currentUser || !isAdmin) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                    <Alert variant="destructive" className="max-w-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be logged in as an Admin to view this page.
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
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payment Accounts Management</h1>
                            <p className="text-sm text-muted-foreground">Manage all bank accounts and mobile money numbers in the system</p>
                        </div>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Account
                        </Button>
                    </div>

                    <Alert className="mb-6">
                        <Banknote className="h-4 w-4" />
                        <AlertTitle>System-wide Payment Management</AlertTitle>
                        <AlertDescription>
                            As an admin, you can view, add, edit, and delete all payment accounts for all managers and hostels in the system.
                        </AlertDescription>
                    </Alert>

                    {/* Filters */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Filters</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search accounts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={filterType} onValueChange={(value: 'all' | 'bank' | 'momo') => setFilterType(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Account type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="bank">Bank Accounts</SelectItem>
                                        <SelectItem value="momo">Mobile Money</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterManager} onValueChange={setFilterManager}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Managers</SelectItem>
                                        {managers.map((manager) => (
                                            <SelectItem key={manager.uid} value={manager.uid}>
                                                {manager.fullName || manager.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={filterHostel} onValueChange={setFilterHostel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filter by hostel" />
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
                        </CardContent>
                    </Card>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>All Payment Accounts ({filteredAccounts.length})</CardTitle>
                                <CardDescription>
                                    Bank accounts and mobile money numbers across all managers and hostels
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {filteredAccounts.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Details</TableHead>
                                                <TableHead>Manager</TableHead>
                                                <TableHead>Hostel</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAccounts.map((account) => (
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
                                                        <div className="text-sm">
                                                            <p className="font-medium">{account.managerName}</p>
                                                            <p className="text-muted-foreground">{account.managerEmail}</p>
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
                                            {searchTerm || filterHostel || filterManager || filterType !== 'all' 
                                                ? 'Try adjusting your filters to see more results.'
                                                : 'Add the first payment account to get started.'
                                            }
                                        </p>
                                        <Button onClick={() => setAddDialogOpen(true)}>
                                            <PlusCircle className="h-4 w-4 mr-2" />
                                            Add First Account
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
                                Add a new bank account or mobile money number for a manager.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="manager">Manager *</Label>
                                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {managers.map((manager) => (
                                            <SelectItem key={manager.uid} value={manager.uid}>
                                                {manager.fullName || manager.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

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
                                        {selectedManagerId && hostels
                                            .filter(hostel => hostel.managerId === selectedManagerId)
                                            .map((hostel) => (
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
                                <Label>Manager</Label>
                                <p className="text-sm text-muted-foreground">
                                    {selectedAccount?.managerName || selectedAccount?.managerEmail}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="editHostel">Hostel (Optional)</Label>
                                <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All hostels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Hostels</SelectItem>
                                        {selectedAccount?.managerId && hostels
                                            .filter(hostel => hostel.managerId === selectedAccount.managerId)
                                            .map((hostel) => (
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
