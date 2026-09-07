"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2,
    AlertTriangle,
    Banknote,
    PlusCircle,
    Edit,
    Trash2,
    Building2,
    CheckCircle2,
    ShieldCheck,
    Smartphone,
    Copy,
    ArrowLeft,
    Search,
    Landmark,
    Check,
    Star,
    Sparkles,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Official Ghana Banks Directory with Paystack Bank Codes
export const GHANA_BANKS = [
    { code: '040100', name: 'GCB Bank PLC', short: 'GCB' },
    { code: '130100', name: 'Ecobank Ghana', short: 'Ecobank' },
    { code: '030100', name: 'ABSA Bank Ghana', short: 'ABSA' },
    { code: '190100', name: 'Stanbic Bank', short: 'Stanbic' },
    { code: '240100', name: 'Fidelity Bank Ghana', short: 'Fidelity' },
    { code: '140100', name: 'CalBank', short: 'CalBank' },
    { code: '340100', name: 'Consolidated Bank Ghana (CBG)', short: 'CBG' },
    { code: '120100', name: 'Zenith Bank Ghana', short: 'Zenith' },
    { code: '280100', name: 'Access Bank Ghana', short: 'Access' },
    { code: '020100', name: 'Standard Chartered Bank', short: 'StanChart' },
    { code: '090100', name: 'Republic Bank Ghana', short: 'Republic' },
    { code: '180100', name: 'Prudential Bank', short: 'Prudential' },
    { code: '070100', name: 'Universal Merchant Bank (UMB)', short: 'UMB' },
    { code: '330100', name: 'First National Bank (FNB)', short: 'FNB' },
    { code: '080100', name: 'Agricultural Development Bank (ADB)', short: 'ADB' },
    { code: '050100', name: 'Societe Generale Ghana', short: 'SG-SSB' },
    { code: '170100', name: 'First Atlantic Bank', short: 'First Atlantic' },
    { code: 'custom', name: 'Other Ghana Bank', short: 'Other' },
];

export const MOMO_NETWORKS = [
    { code: 'MTN', name: 'MTN Mobile Money', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    { code: 'VOD', name: 'Telecel Cash (Vodafone)', color: 'bg-red-500/15 text-red-600 border-red-500/30' },
    { code: 'ATL', name: 'AT Money (AirtelTigo)', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
];

export interface BankAccount {
    id: string;
    managerId: string;
    managerEmail?: string;
    type: 'bank' | 'momo';
    hostelId?: string;
    hostelName?: string;
    bankName: string;
    bankCode?: string;
    branch?: string;
    accountNumber: string;
    accountName: string;
    momoNetwork?: string;
    momoNumber?: string;
    momoName?: string;
    isPrimary: boolean;
    isVerified?: boolean;
    verifiedViaPaystack?: boolean;
    status?: string;
    createdAt?: any;
    updatedAt?: any;
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

    // Filters & views
    const [activeHostelFilter, setActiveHostelFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'bank' | 'momo'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [accountType, setAccountType] = useState<'bank' | 'momo'>('bank');
    const [formHostelId, setFormHostelId] = useState('all');
    const [selectedBankCode, setSelectedBankCode] = useState('040100'); // GCB default
    const [customBankName, setCustomBankName] = useState('');
    const [bankBranch, setBankBranch] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [selectedMomoNetwork, setSelectedMomoNetwork] = useState('MTN');
    const [momoNumber, setMomoNumber] = useState('');
    const [momoName, setMomoName] = useState('');
    const [isPrimary, setIsPrimary] = useState(false);

    // Paystack Resolution State
    const [isResolving, setIsResolving] = useState(false);
    const [isResolved, setIsResolved] = useState(false);
    const [resolutionError, setResolutionError] = useState<string | null>(null);

    // Check user role
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
                    const isMgr = data.role === 'hostel_manager' || data.role === 'manager' || data.role === 'admin';
                    setIsManager(isMgr);
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

    // Fetch manager's hostels and bank accounts in real time
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
            const fetchedHostels = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                name: docSnap.data().name || 'Unnamed Hostel',
                managerId: docSnap.data().managerId
            } as Hostel));
            setHostels(fetchedHostels);
        });

        // Fetch bank accounts for this manager
        const accountsQuery = query(
            collection(db, 'bankAccounts'),
            where('managerId', '==', currentUser.uid)
        );

        const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
            const accounts: BankAccount[] = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    managerId: data.managerId,
                    managerEmail: data.managerEmail,
                    type: data.type || (data.momoNumber ? 'momo' : 'bank'),
                    hostelId: data.hostelId || '',
                    hostelName: data.hostelName || '',
                    bankName: data.bankName || (data.type === 'momo' ? data.momoNetwork : 'Bank Account'),
                    bankCode: data.bankCode,
                    branch: data.branch || '',
                    accountNumber: String(data.accountNumber || data.momoNumber || ''),
                    accountName: data.accountName || data.momoName || 'Official Account',
                    momoNetwork: data.momoNetwork,
                    momoNumber: data.momoNumber,
                    momoName: data.momoName,
                    isPrimary: !!data.isPrimary,
                    isVerified: !!(data.isVerified || data.verifiedViaPaystack),
                    verifiedViaPaystack: !!(data.verifiedViaPaystack || data.isVerified),
                    status: data.status || 'active',
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
            });

            setBankAccounts(accounts);
            setLoading(false);
        }, (error) => {
            console.error('Error listening to manager bank accounts:', error);
            setLoading(false);
        });

        return () => {
            unsubscribeHostels();
            unsubscribeAccounts();
        };
    }, [currentUser, isManager]);

    // Live Paystack Account Resolution Check
    const handleResolveAccount = async () => {
        const targetNumber = accountType === 'bank' ? accountNumber.trim() : momoNumber.trim();
        const targetBankCode = accountType === 'bank'
            ? (selectedBankCode === 'custom' ? '040100' : selectedBankCode)
            : selectedMomoNetwork;

        if (!targetNumber) {
            toast({
                title: 'Account number required',
                description: accountType === 'bank'
                    ? 'Please enter your bank account number to verify with Paystack.'
                    : 'Please enter your Mobile Money phone number to verify with Paystack.',
                variant: 'destructive',
            });
            return;
        }

        setIsResolving(true);
        setIsResolved(false);
        setResolutionError(null);

        try {
            const res = await fetch(
                `/api/paystack/resolve?account_number=${encodeURIComponent(targetNumber)}&bank_code=${encodeURIComponent(targetBankCode)}`
            );
            const json = await res.json();

            if (json.status && json.data?.account_name) {
                const resolved = json.data.account_name;
                if (accountType === 'bank') {
                    setAccountName(resolved);
                } else {
                    setMomoName(resolved);
                }
                setIsResolved(true);
                setResolutionError(null);
                toast({
                    title: 'Paystack Name Resolved!',
                    description: `Account holder confirmed: "${resolved}"`,
                });
            } else {
                setIsResolved(false);
                const errMsg = json.message || 'Paystack could not verify this account. Please verify details or enter name manually.';
                setResolutionError(errMsg);
                toast({
                    title: 'Verification Inconclusive',
                    description: errMsg,
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            setIsResolved(false);
            setResolutionError(err.message || 'Unable to connect to Paystack verification API.');
            toast({
                title: 'Resolution Service Error',
                description: 'Failed to contact Paystack. You can still enter your registered account name manually.',
                variant: 'destructive',
            });
        } finally {
            setIsResolving(false);
        }
    };

    // Open Add Dialog
    const openAddDialog = () => {
        resetForm();
        if (activeHostelFilter !== 'all') {
            setFormHostelId(activeHostelFilter);
        }
        setAddDialogOpen(true);
    };

    // Open Edit Dialog
    const openEditDialog = (account: BankAccount) => {
        setSelectedAccount(account);
        setAccountType(account.type);
        setFormHostelId(account.hostelId || 'all');
        setIsPrimary(account.isPrimary);
        setIsResolved(!!account.isVerified || !!account.verifiedViaPaystack);
        setResolutionError(null);

        if (account.type === 'bank') {
            const matchedBank = GHANA_BANKS.find(b => b.code === account.bankCode || b.name === account.bankName);
            if (matchedBank) {
                setSelectedBankCode(matchedBank.code);
                setCustomBankName('');
            } else {
                setSelectedBankCode('custom');
                setCustomBankName(account.bankName || '');
            }
            setBankBranch(account.branch || '');
            setAccountNumber(account.accountNumber || '');
            setAccountName(account.accountName || '');
        } else {
            const matchedNetwork = MOMO_NETWORKS.find(n => n.code === account.bankCode || n.name === account.bankName || n.code === account.momoNetwork);
            setSelectedMomoNetwork(matchedNetwork ? matchedNetwork.code : 'MTN');
            setMomoNumber(account.momoNumber || account.accountNumber || '');
            setMomoName(account.momoName || account.accountName || '');
        }

        setEditDialogOpen(true);
    };

    const resetForm = () => {
        setAccountType('bank');
        setFormHostelId('all');
        setSelectedBankCode('040100');
        setCustomBankName('');
        setBankBranch('');
        setAccountNumber('');
        setAccountName('');
        setSelectedMomoNetwork('MTN');
        setMomoNumber('');
        setMomoName('');
        setIsPrimary(false);
        setIsResolving(false);
        setIsResolved(false);
        setResolutionError(null);
        setSelectedAccount(null);
    };

    // Handle Create Account in Firestore
    const handleAddAccount = async () => {
        if (!currentUser) return;

        const isBank = accountType === 'bank';
        const num = isBank ? accountNumber.trim() : momoNumber.trim();
        const name = isBank ? accountName.trim() : momoName.trim();

        if (!num || !name) {
            toast({
                title: 'Required fields missing',
                description: 'Please provide both the account number and account name.',
                variant: 'destructive',
            });
            return;
        }

        // Determine bank/network details
        let bankNameFinal = '';
        let bankCodeFinal = '';
        if (isBank) {
            if (selectedBankCode === 'custom') {
                bankNameFinal = customBankName.trim() || 'Custom Ghana Bank';
                bankCodeFinal = 'custom';
            } else {
                const found = GHANA_BANKS.find(b => b.code === selectedBankCode);
                bankNameFinal = found?.name || 'Bank Account';
                bankCodeFinal = selectedBankCode;
            }
        } else {
            const found = MOMO_NETWORKS.find(n => n.code === selectedMomoNetwork);
            bankNameFinal = found?.name || `${selectedMomoNetwork} Mobile Money`;
            bankCodeFinal = selectedMomoNetwork;
        }

        // Determine hostel assignment
        let assignedHostelName = 'All Managed Hostels';
        if (formHostelId !== 'all') {
            const matched = hostels.find(h => h.id === formHostelId);
            if (matched) assignedHostelName = matched.name;
        }

        try {
            setSubmitting(true);

            // If primary, demote existing primary accounts for this hostel
            if (isPrimary) {
                const siblings = bankAccounts.filter(acc =>
                    acc.isPrimary &&
                    (formHostelId === 'all' || acc.hostelId === formHostelId || !acc.hostelId)
                );
                for (const sib of siblings) {
                    await updateDoc(doc(db, 'bankAccounts', sib.id), { isPrimary: false });
                }
            }

            const newDoc: any = {
                managerId: currentUser.uid,
                managerEmail: currentUser.email || '',
                type: accountType,
                bankName: bankNameFinal,
                bankCode: bankCodeFinal,
                accountNumber: num,
                accountName: name,
                isPrimary,
                isVerified: isResolved,
                verifiedViaPaystack: isResolved,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (isBank) {
                if (bankBranch.trim()) newDoc.branch = bankBranch.trim();
            } else {
                newDoc.momoNetwork = selectedMomoNetwork;
                newDoc.momoNumber = num;
                newDoc.momoName = name;
            }

            if (formHostelId !== 'all') {
                newDoc.hostelId = formHostelId;
                newDoc.hostelName = assignedHostelName;
            } else {
                newDoc.hostelId = 'all';
                newDoc.hostelName = 'All Managed Hostels';
            }

            await addDoc(collection(db, 'bankAccounts'), newDoc);

            setAddDialogOpen(false);
            resetForm();
            toast({
                title: 'Payment Account Linked!',
                description: `${bankNameFinal} account (${num}) is now active for ${assignedHostelName}.`,
            });
        } catch (error: any) {
            console.error('Error adding bank account:', error);
            toast({
                title: 'Failed to add account',
                description: error.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Edit Account in Firestore
    const handleEditAccount = async () => {
        if (!selectedAccount) return;

        const isBank = accountType === 'bank';
        const num = isBank ? accountNumber.trim() : momoNumber.trim();
        const name = isBank ? accountName.trim() : momoName.trim();

        if (!num || !name) {
            toast({
                title: 'Required fields missing',
                description: 'Please provide both the account number and account name.',
                variant: 'destructive',
            });
            return;
        }

        let bankNameFinal = '';
        let bankCodeFinal = '';
        if (isBank) {
            if (selectedBankCode === 'custom') {
                bankNameFinal = customBankName.trim() || 'Custom Ghana Bank';
                bankCodeFinal = 'custom';
            } else {
                const found = GHANA_BANKS.find(b => b.code === selectedBankCode);
                bankNameFinal = found?.name || 'Bank Account';
                bankCodeFinal = selectedBankCode;
            }
        } else {
            const found = MOMO_NETWORKS.find(n => n.code === selectedMomoNetwork);
            bankNameFinal = found?.name || `${selectedMomoNetwork} Mobile Money`;
            bankCodeFinal = selectedMomoNetwork;
        }

        let assignedHostelName = 'All Managed Hostels';
        if (formHostelId !== 'all') {
            const matched = hostels.find(h => h.id === formHostelId);
            if (matched) assignedHostelName = matched.name;
        }

        try {
            setSubmitting(true);

            // If setting as primary, demote existing primary siblings
            if (isPrimary && !selectedAccount.isPrimary) {
                const siblings = bankAccounts.filter(acc =>
                    acc.id !== selectedAccount.id &&
                    acc.isPrimary &&
                    (formHostelId === 'all' || acc.hostelId === formHostelId || !acc.hostelId)
                );
                for (const sib of siblings) {
                    await updateDoc(doc(db, 'bankAccounts', sib.id), { isPrimary: false });
                }
            }

            const updates: any = {
                type: accountType,
                bankName: bankNameFinal,
                bankCode: bankCodeFinal,
                accountNumber: num,
                accountName: name,
                isPrimary,
                isVerified: isResolved,
                verifiedViaPaystack: isResolved,
                updatedAt: serverTimestamp(),
            };

            if (isBank) {
                updates.branch = bankBranch.trim();
                updates.momoNetwork = null;
                updates.momoNumber = null;
                updates.momoName = null;
            } else {
                updates.branch = null;
                updates.momoNetwork = selectedMomoNetwork;
                updates.momoNumber = num;
                updates.momoName = name;
            }

            if (formHostelId !== 'all') {
                updates.hostelId = formHostelId;
                updates.hostelName = assignedHostelName;
            } else {
                updates.hostelId = 'all';
                updates.hostelName = 'All Managed Hostels';
            }

            await updateDoc(doc(db, 'bankAccounts', selectedAccount.id), updates);

            setEditDialogOpen(false);
            resetForm();
            toast({
                title: 'Account Updated',
                description: `Payment details for ${assignedHostelName} updated successfully.`,
            });
        } catch (error: any) {
            console.error('Error updating bank account:', error);
            toast({
                title: 'Failed to update account',
                description: error.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Quick Toggle Primary Payout Account
    const handleTogglePrimary = async (account: BankAccount) => {
        try {
            if (!account.isPrimary) {
                // Demote others for this hostel
                const siblings = bankAccounts.filter(acc =>
                    acc.id !== account.id &&
                    acc.isPrimary &&
                    (account.hostelId === 'all' || !account.hostelId || acc.hostelId === account.hostelId)
                );
                for (const sib of siblings) {
                    await updateDoc(doc(db, 'bankAccounts', sib.id), { isPrimary: false });
                }
                await updateDoc(doc(db, 'bankAccounts', account.id), { isPrimary: true, updatedAt: serverTimestamp() });
                toast({
                    title: 'Primary Account Set',
                    description: `${account.bankName} (${account.accountNumber}) is now the primary payout account.`,
                });
            }
        } catch (err: any) {
            toast({
                title: 'Action Failed',
                description: err.message || 'Failed to update primary account.',
                variant: 'destructive',
            });
        }
    };

    // Handle Delete Account
    const confirmDelete = async () => {
        if (!accountToDelete) return;
        try {
            setSubmitting(true);
            await deleteDoc(doc(db, 'bankAccounts', accountToDelete.id));
            setDeleteDialogOpen(false);
            setAccountToDelete(null);
            toast({
                title: 'Account Deleted',
                description: 'The payment account has been removed from Firestore.',
            });
        } catch (error: any) {
            console.error('Error deleting account:', error);
            toast({
                title: 'Failed to delete account',
                description: error.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Copy helper
    const handleCopy = (text: string, id: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        setCopiedId(id);
        toast({
            title: 'Copied to clipboard',
            description: `${text} copied.`,
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Filtered bank accounts list
    const filteredAccounts = useMemo(() => {
        return bankAccounts.filter(acc => {
            // Hostel filter
            if (activeHostelFilter !== 'all') {
                if (acc.hostelId && acc.hostelId !== 'all' && acc.hostelId !== activeHostelFilter) {
                    return false;
                }
            }

            // Type filter
            if (typeFilter !== 'all' && acc.type !== typeFilter) {
                return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const bankMatch = acc.bankName?.toLowerCase().includes(q);
                const numMatch = acc.accountNumber?.includes(q);
                const nameMatch = acc.accountName?.toLowerCase().includes(q);
                const hostelMatch = acc.hostelName?.toLowerCase().includes(q);
                const branchMatch = acc.branch?.toLowerCase().includes(q);
                if (!bankMatch && !numMatch && !nameMatch && !hostelMatch && !branchMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [bankAccounts, activeHostelFilter, typeFilter, searchQuery]);

    // Active hostel name for heading
    const activeHostelName = useMemo(() => {
        if (activeHostelFilter === 'all') return 'All Managed Properties';
        return hostels.find(h => h.id === activeHostelFilter)?.name || 'Selected Hostel';
    }, [activeHostelFilter, hostels]);

    if (loadingAuth || isManager === null) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    if (!currentUser || !isManager) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 flex items-center justify-center p-6">
                    <Alert variant="destructive" className="max-w-md rounded-2xl border-destructive/30">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertTitle className="font-bold">Hostel Manager Authorization Required</AlertTitle>
                        <AlertDescription className="text-xs mt-1 leading-relaxed">
                            You must be logged in with a certified Hostel Manager profile to access payment routing and bank settlement accounts.
                        </AlertDescription>
                        <div className="pt-4">
                            <Button asChild size="sm" variant="outline" className="rounded-xl">
                                <Link href="/login">Sign In as Manager</Link>
                            </Button>
                        </div>
                    </Alert>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Header />

            <main className="flex-1 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
                {/* Navigation Bar & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground">
                                <Link href="/manager/dashboard">
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    <span>Dashboard</span>
                                </Link>
                            </Button>
                            <span className="text-muted-foreground/50">•</span>
                            <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/30">
                                Property Payout Control
                            </Badge>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Hostel Bank & Mobile Money Accounts
                        </h1>
                        <p className="text-sm text-muted-foreground max-w-3xl">
                            Configure verified GCB, Ecobank, or MTN MoMo accounts for your physical properties. Updates sync to student manual payment views instantly with zero platform admin bottlenecks.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            onClick={openAddDialog}
                            className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/10"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Add Payout Account</span>
                        </Button>
                    </div>
                </div>

                {/* Statutory Anti-Fraud Advisory Banner */}
                <Alert className="rounded-2xl border-primary/20 bg-primary/5 text-foreground">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                    <div className="space-y-1">
                        <AlertTitle className="text-xs font-bold uppercase tracking-wider text-primary">
                            Real-Time Student Payment Routing & Live Paystack Resolution
                        </AlertTitle>
                        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
                            Accounts registered here are instantly accessible to students on their manual payment page (<code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[11px]">/bank-accounts</code>). Use the live Paystack name check to verify account holder names before publishing.
                        </AlertDescription>
                    </div>
                </Alert>

                {/* Filters Strip */}
                <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        {/* Property Selector */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filter by Property:</span>
                            </div>
                            <Select value={activeHostelFilter} onValueChange={setActiveHostelFilter}>
                                <SelectTrigger className="w-full sm:w-[260px] h-9 text-xs rounded-xl font-medium">
                                    <SelectValue placeholder="All Managed Hostels" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">All Managed Hostels ({hostels.length})</SelectItem>
                                    {hostels.map(h => (
                                        <SelectItem key={h.id} value={h.id}>
                                            {h.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Search & Type Tabs */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search bank, account #, name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 pl-8 text-xs rounded-xl"
                                />
                            </div>

                            <Tabs
                                value={typeFilter}
                                onValueChange={(v: string) => setTypeFilter(v as any)}
                                className="w-auto shrink-0"
                            >
                                <TabsList className="h-9 p-1 rounded-xl bg-muted/60">
                                    <TabsTrigger value="all" className="text-xs rounded-lg px-3">All ({bankAccounts.length})</TabsTrigger>
                                    <TabsTrigger value="bank" className="text-xs rounded-lg px-3">Banks</TabsTrigger>
                                    <TabsTrigger value="momo" className="text-xs rounded-lg px-3">MoMo</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                </Card>

                {/* Accounts Feed */}
                {loading ? (
                    <Card className="rounded-2xl p-16 border-border/60 bg-card text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground font-medium">Loading property settlement accounts...</p>
                        </div>
                    </Card>
                ) : filteredAccounts.length === 0 ? (
                    /* Clean Empty State */
                    <Card className="rounded-3xl border-border/60 bg-card p-10 sm:p-14 text-center shadow-sm">
                        <div className="max-w-md mx-auto space-y-4">
                            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                                <Banknote className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold">No Accounts Found for {activeHostelName}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {activeHostelFilter === 'all'
                                        ? 'You have not registered any bank accounts or Mobile Money numbers yet. Link your first account to accept direct student rent settlements.'
                                        : `No dedicated bank or MoMo accounts have been configured for ${activeHostelName}. Students viewing this hostel's manual payment tab will not see direct deposit routing until you add one.`
                                    }
                                </p>
                            </div>
                            <Button onClick={openAddDialog} className="rounded-2xl gap-2 font-semibold">
                                <PlusCircle className="h-4 w-4" />
                                <span>Add Account for {activeHostelFilter === 'all' ? 'Property' : activeHostelName}</span>
                            </Button>
                        </div>
                    </Card>
                ) : (
                    /* Populated Accounts Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {filteredAccounts.map((account) => {
                            const isBank = account.type === 'bank';
                            const bankDisplay = isBank
                                ? `${account.bankName}${account.branch ? ` — ${account.branch}` : ''}`
                                : account.bankName;

                            return (
                                <Card
                                    key={account.id}
                                    className={cn(
                                        "rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between bg-card hover:shadow-md",
                                        account.isPrimary
                                            ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
                                            : "border-border/60 hover:border-border"
                                    )}
                                >
                                    <div className="p-5 space-y-4">
                                        {/* Card Header Pills */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={isBank ? "secondary" : "outline"}
                                                    className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5",
                                                        !isBank && "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                                    )}
                                                >
                                                    {isBank ? (
                                                        <span className="flex items-center gap-1">
                                                            <Landmark className="h-3 w-3" />
                                                            <span>Bank Account</span>
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <Smartphone className="h-3 w-3" />
                                                            <span>Mobile Money</span>
                                                        </span>
                                                    )}
                                                </Badge>

                                                {account.isPrimary && (
                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold rounded-lg px-2 py-0.5">
                                                        <Star className="h-2.5 w-2.5 mr-1 fill-emerald-500" />
                                                        Primary Payout
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Paystack Verification Badge */}
                                            {account.isVerified ? (
                                                <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/5 gap-1 py-0.5">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                    <span>Paystack Verified</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground border-border py-0.5">
                                                    Unverified
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Bank / Provider Name */}
                                        <div>
                                            <h4 className="text-base font-bold text-foreground truncate">
                                                {bankDisplay}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                                <span className="font-medium truncate">
                                                    {account.hostelName || 'All Managed Hostels'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Account Number Box */}
                                        <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {isBank ? 'Account Number' : 'MoMo Phone Number'}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleCopy(account.accountNumber, account.id)}
                                                    className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                                                >
                                                    {copiedId === account.id ? (
                                                        <>
                                                            <Check className="h-3 w-3 text-emerald-600" />
                                                            <span className="text-emerald-600 font-semibold">Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-3 w-3" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-base font-mono font-bold tracking-tight text-foreground">
                                                {account.accountNumber}
                                            </p>
                                        </div>

                                        {/* Account Holder Name */}
                                        <div className="text-xs space-y-0.5">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Account Holder Name
                                            </span>
                                            <p className="font-semibold text-foreground truncate">
                                                {account.accountName}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Strip */}
                                    <div className="p-3 bg-muted/20 border-t border-border/50 flex items-center justify-between gap-2">
                                        <div>
                                            {!account.isPrimary ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleTogglePrimary(account)}
                                                    className="h-8 text-xs font-semibold text-muted-foreground hover:text-primary rounded-xl"
                                                >
                                                    <Star className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                                    <span>Set Primary</span>
                                                </Button>
                                            ) : (
                                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 pl-2">
                                                    Active Default
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(account)}
                                                className="h-8 w-8 p-0 rounded-xl"
                                                title="Edit Account"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    setAccountToDelete(account);
                                                    setDeleteDialogOpen(true);
                                                }}
                                                className="h-8 w-8 p-0 rounded-xl"
                                                title="Delete Account"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Quick Link to Student View */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="text-xs">
                            <p className="font-bold text-foreground">Want to see what students see?</p>
                            <p className="text-muted-foreground">Test the live student payment page for your properties.</p>
                        </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5 font-semibold text-xs">
                        <Link href="/bank-accounts" target="_blank">
                            <span>Open Student Payment View</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
            </main>

            {/* ADD ACCOUNT DIALOG */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl font-bold">Add Payout & Deposit Account</DialogTitle>
                        <DialogDescription className="text-xs">
                            Link a bank account or Mobile Money number for your hostel property.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Account Type Selector */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Account Type *</Label>
                            <Tabs
                                value={accountType}
                                onValueChange={(v) => {
                                    setAccountType(v as any);
                                    setIsResolved(false);
                                    setResolutionError(null);
                                }}
                            >
                                <TabsList className="grid grid-cols-2 h-10 rounded-xl bg-muted/60 p-1">
                                    <TabsTrigger value="bank" className="text-xs rounded-lg gap-2">
                                        <Landmark className="h-3.5 w-3.5" />
                                        <span>Ghana Bank Account</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="momo" className="text-xs rounded-lg gap-2">
                                        <Smartphone className="h-3.5 w-3.5" />
                                        <span>Mobile Money (MoMo)</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Property Assignment Dropdown */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Associated Property / Hostel *</Label>
                            <Select value={formHostelId} onValueChange={setFormHostelId}>
                                <SelectTrigger className="h-10 text-xs rounded-xl">
                                    <SelectValue placeholder="Select hostel" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">All My Hostels (Global Default)</SelectItem>
                                    {hostels.map(h => (
                                        <SelectItem key={h.id} value={h.id}>
                                            {h.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Students booking this specific hostel will see this account on their checkout/deposit guide.
                            </p>
                        </div>

                        {/* Conditional Form Fields */}
                        {accountType === 'bank' ? (
                            <>
                                {/* Bank Provider Dropdown */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Bank Provider *</Label>
                                    <Select
                                        value={selectedBankCode}
                                        onValueChange={(val) => {
                                            setSelectedBankCode(val);
                                            setIsResolved(false);
                                            setResolutionError(null);
                                        }}
                                    >
                                        <SelectTrigger className="h-10 text-xs rounded-xl">
                                            <SelectValue placeholder="Select Ghana Bank" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-56">
                                            {GHANA_BANKS.map(bank => (
                                                <SelectItem key={bank.code} value={bank.code}>
                                                    {bank.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedBankCode === 'custom' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Bank Name *</Label>
                                        <Input
                                            placeholder="e.g. Standard Chartered Ghana"
                                            value={customBankName}
                                            onChange={(e) => setCustomBankName(e.target.value)}
                                            className="h-10 text-xs rounded-xl"
                                        />
                                    </div>
                                )}

                                {/* Branch */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Branch Name (Optional)</Label>
                                    <Input
                                        placeholder="e.g. KNUST Campus Branch or Ayeduase Commercial Area"
                                        value={bankBranch}
                                        onChange={(e) => setBankBranch(e.target.value)}
                                        className="h-10 text-xs rounded-xl"
                                    />
                                </div>

                                {/* Account Number with Paystack Resolve */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Bank Account Number *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. 1151000048291"
                                            value={accountNumber}
                                            onChange={(e) => {
                                                setAccountNumber(e.target.value);
                                                setIsResolved(false);
                                                setResolutionError(null);
                                            }}
                                            className="h-10 text-xs rounded-xl font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResolveAccount}
                                            disabled={isResolving || !accountNumber.trim()}
                                            className="h-10 px-3 text-xs font-semibold shrink-0 gap-1.5 rounded-xl border-primary/30 hover:bg-primary/5"
                                        >
                                            {isResolving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                            )}
                                            <span>Verify Account</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Account Name */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold">Account Holder Name *</Label>
                                        {isResolved && (
                                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Paystack Verified
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        placeholder="e.g. Kingenious Hostel Ltd or Ayeduase Executive"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        className="h-10 text-xs rounded-xl font-medium"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Mobile Money Network */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Mobile Money Network *</Label>
                                    <Select
                                        value={selectedMomoNetwork}
                                        onValueChange={(val) => {
                                            setSelectedMomoNetwork(val);
                                            setIsResolved(false);
                                            setResolutionError(null);
                                        }}
                                    >
                                        <SelectTrigger className="h-10 text-xs rounded-xl">
                                            <SelectValue placeholder="Select network" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {MOMO_NETWORKS.map(net => (
                                                <SelectItem key={net.code} value={net.code}>
                                                    {net.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* MoMo Phone Number with Resolve */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Mobile Money Phone Number *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. 0244123456"
                                            value={momoNumber}
                                            onChange={(e) => {
                                                setMomoNumber(e.target.value);
                                                setIsResolved(false);
                                                setResolutionError(null);
                                            }}
                                            className="h-10 text-xs rounded-xl font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResolveAccount}
                                            disabled={isResolving || !momoNumber.trim()}
                                            className="h-10 px-3 text-xs font-semibold shrink-0 gap-1.5 rounded-xl border-primary/30 hover:bg-primary/5"
                                        >
                                            {isResolving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                            )}
                                            <span>Verify MoMo</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* MoMo Account Name */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold">Registered Subscriber Name *</Label>
                                        {isResolved && (
                                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Paystack Verified
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        placeholder="e.g. Kwabena Mensah or Kingenious Ltd"
                                        value={momoName}
                                        onChange={(e) => setMomoName(e.target.value)}
                                        className="h-10 text-xs rounded-xl font-medium"
                                    />
                                </div>
                            </>
                        )}

                        {/* Resolution Status Message */}
                        {isResolved && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>Official recipient name resolved via Paystack Banking Engine.</span>
                            </div>
                        )}
                        {resolutionError && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200">
                                <p className="font-semibold">Note on verification:</p>
                                <p className="text-[11px] mt-0.5">{resolutionError}</p>
                            </div>
                        )}

                        {/* Primary Account Checkbox */}
                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="isPrimaryAdd"
                                checked={isPrimary}
                                onChange={(e) => setIsPrimary(e.target.checked)}
                                className="rounded h-4 w-4 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="isPrimaryAdd" className="text-xs font-medium cursor-pointer">
                                Set as primary payout account for this property
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button onClick={handleAddAccount} disabled={submitting} className="rounded-xl font-semibold gap-2">
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            <span>Save Payment Account</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT ACCOUNT DIALOG */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl font-bold">Edit Payment Account</DialogTitle>
                        <DialogDescription className="text-xs">
                            Update banking details or hostel routing assignments.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Property Assignment Dropdown */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Associated Property / Hostel *</Label>
                            <Select value={formHostelId} onValueChange={setFormHostelId}>
                                <SelectTrigger className="h-10 text-xs rounded-xl">
                                    <SelectValue placeholder="Select hostel" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">All My Hostels (Global Default)</SelectItem>
                                    {hostels.map(h => (
                                        <SelectItem key={h.id} value={h.id}>
                                            {h.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {accountType === 'bank' ? (
                            <>
                                {/* Bank Provider */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Bank Provider *</Label>
                                    <Select
                                        value={selectedBankCode}
                                        onValueChange={(val) => {
                                            setSelectedBankCode(val);
                                            setIsResolved(false);
                                            setResolutionError(null);
                                        }}
                                    >
                                        <SelectTrigger className="h-10 text-xs rounded-xl">
                                            <SelectValue placeholder="Select Ghana Bank" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-56">
                                            {GHANA_BANKS.map(bank => (
                                                <SelectItem key={bank.code} value={bank.code}>
                                                    {bank.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedBankCode === 'custom' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Bank Name *</Label>
                                        <Input
                                            value={customBankName}
                                            onChange={(e) => setCustomBankName(e.target.value)}
                                            className="h-10 text-xs rounded-xl"
                                        />
                                    </div>
                                )}

                                {/* Branch */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Branch Name</Label>
                                    <Input
                                        placeholder="e.g. KNUST Campus Branch"
                                        value={bankBranch}
                                        onChange={(e) => setBankBranch(e.target.value)}
                                        className="h-10 text-xs rounded-xl"
                                    />
                                </div>

                                {/* Account Number with Paystack Resolve */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Bank Account Number *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={accountNumber}
                                            onChange={(e) => {
                                                setAccountNumber(e.target.value);
                                                setIsResolved(false);
                                            }}
                                            className="h-10 text-xs rounded-xl font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResolveAccount}
                                            disabled={isResolving || !accountNumber.trim()}
                                            className="h-10 px-3 text-xs font-semibold shrink-0 gap-1.5 rounded-xl border-primary/30"
                                        >
                                            {isResolving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                            )}
                                            <span>Re-verify</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Account Name */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold">Account Holder Name *</Label>
                                        {isResolved && (
                                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Paystack Verified
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        className="h-10 text-xs rounded-xl font-medium"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Mobile Network */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Mobile Money Network *</Label>
                                    <Select
                                        value={selectedMomoNetwork}
                                        onValueChange={(val) => {
                                            setSelectedMomoNetwork(val);
                                            setIsResolved(false);
                                        }}
                                    >
                                        <SelectTrigger className="h-10 text-xs rounded-xl">
                                            <SelectValue placeholder="Select network" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {MOMO_NETWORKS.map(net => (
                                                <SelectItem key={net.code} value={net.code}>
                                                    {net.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* MoMo Phone Number with Resolve */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Mobile Money Phone Number *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={momoNumber}
                                            onChange={(e) => {
                                                setMomoNumber(e.target.value);
                                                setIsResolved(false);
                                            }}
                                            className="h-10 text-xs rounded-xl font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResolveAccount}
                                            disabled={isResolving || !momoNumber.trim()}
                                            className="h-10 px-3 text-xs font-semibold shrink-0 gap-1.5 rounded-xl border-primary/30"
                                        >
                                            {isResolving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                            )}
                                            <span>Re-verify</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* MoMo Account Name */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold">Subscriber Name *</Label>
                                        {isResolved && (
                                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Paystack Verified
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        value={momoName}
                                        onChange={(e) => setMomoName(e.target.value)}
                                        className="h-10 text-xs rounded-xl font-medium"
                                    />
                                </div>
                            </>
                        )}

                        {/* Primary Checkbox */}
                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="isPrimaryEdit"
                                checked={isPrimary}
                                onChange={(e) => setIsPrimary(e.target.checked)}
                                className="rounded h-4 w-4 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="isPrimaryEdit" className="text-xs font-medium cursor-pointer">
                                Set as primary payout account for this property
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button onClick={handleEditAccount} disabled={submitting} className="rounded-xl font-semibold gap-2">
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            <span>Update Details</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            <span>Remove Payment Account?</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-relaxed">
                            Are you sure you want to delete this payment account? Students will no longer see this account for manual bank deposits or mobile money transfers.
                        </DialogDescription>
                    </DialogHeader>

                    {accountToDelete && (
                        <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-xs space-y-1 my-2">
                            <p className="font-bold text-foreground">{accountToDelete.bankName}</p>
                            <p className="font-mono text-muted-foreground">{accountToDelete.accountNumber}</p>
                            <p className="text-muted-foreground">Holder: {accountToDelete.accountName}</p>
                            <p className="text-primary font-medium">Hostel: {accountToDelete.hostelName || 'All Hostels'}</p>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={submitting}
                            className="rounded-xl font-semibold gap-2"
                        >
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            <span>Delete Account</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
