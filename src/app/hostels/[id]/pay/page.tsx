"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import {
    Building2,
    CheckCircle2,
    ShieldCheck,
    Smartphone,
    Landmark,
    Copy,
    Check,
    Star,
    ArrowLeft,
    AlertTriangle,
    Loader2,
    Upload,
    Receipt,
    ExternalLink,
    Lock,
    Clock,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PayoutAccount, isAccountBoundToHostel, filterAccountsForHostel } from "@/lib/payout-accounts";

interface HostelData {
    id: string;
    name: string;
    managerId: string;
    managerName?: string;
    location?: string;
    price?: number;
    currency?: string;
}

export default function HostelPaymentPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const hostelId = typeof params?.id === "string" ? params.id : "";
    const prefilledAmount = searchParams?.get("amount") || "";
    const bookingId = searchParams?.get("bookingId") || "";

    const [hostel, setHostel] = useState<HostelData | null>(null);
    const [loadingHostel, setLoadingHostel] = useState(true);
    const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"all" | "bank" | "momo">("all");
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

    // Manual Deposit / Receipt Submission State
    const [selectedAccountForDeposit, setSelectedAccountForDeposit] = useState<PayoutAccount | null>(null);
    const [depositDialogOpen, setDepositDialogOpen] = useState(false);
    const [depositAmount, setDepositAmount] = useState(prefilledAmount);
    const [transactionRef, setTransactionRef] = useState("");
    const [payerName, setPayerName] = useState("");
    const [payerPhone, setPayerPhone] = useState("");
    const [depositNotes, setDepositNotes] = useState("");
    const [submittingDeposit, setSubmittingDeposit] = useState(false);
    const [depositError, setDepositError] = useState<string | null>(null);
    const [depositSuccess, setDepositSuccess] = useState(false);

    // Track user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (user?.displayName) setPayerName(user.displayName);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Hostel Data
    useEffect(() => {
        if (!hostelId) return;

        async function fetchHostel() {
            setLoadingHostel(true);
            try {
                const hostelDocRef = doc(db, "hostels", hostelId);
                const snap = await getDoc(hostelDocRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setHostel({
                        id: snap.id,
                        name: data.name || "Campus Hostel",
                        managerId: data.managerId || "",
                        managerName: data.managerName || "Hostel Management",
                        location: data.location || data.address || "",
                        price: data.price || data.pricePerSemester,
                        currency: data.currency || "GHS",
                    });
                } else {
                    setHostel(null);
                }
            } catch (err) {
                console.error("Error fetching hostel for payment:", err);
            } finally {
                setLoadingHostel(false);
            }
        }

        fetchHostel();
    }, [hostelId]);

    // Fetch strictly scoped payout accounts for this hostel
    useEffect(() => {
        if (!hostelId || !hostel?.managerId) {
            setLoadingAccounts(false);
            return;
        }

        setLoadingAccounts(true);

        // Fetch using the server API endpoint which implements dynamic filtering & strict scoping
        async function loadScopedAccounts() {
            try {
                const res = await fetch(`/api/hostels/${encodeURIComponent(hostelId)}/pay`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status && Array.isArray(data.accounts)) {
                        setAccounts(data.accounts);
                        setLoadingAccounts(false);
                        return;
                    }
                }
            } catch (apiErr) {
                console.warn("Direct API accounts fetch fallback to Firestore:", apiErr);
            }

            // Fallback direct Firestore query if offline or direct route
            try {
                const accountsRef = collection(db, "payout_accounts");
                const q = query(accountsRef, where("managerId", "==", hostel.managerId));
                const snap = await getDocs(q);

                let fetched: PayoutAccount[] = [];
                snap.forEach((docSnap) => {
                    const d = docSnap.data();
                    fetched.push({
                        id: docSnap.id,
                        managerId: d.managerId,
                        accountType: d.accountType || (d.momoNumber ? "momo" : "bank"),
                        bankName: d.bankName,
                        bankCode: d.bankCode,
                        accountNumber: String(d.accountNumber || d.momoNumber || ""),
                        accountHolderName: d.accountHolderName || d.accountName || d.momoName || "Official Account",
                        isPrimary: !!d.isPrimary,
                        isVerified: !!d.isVerified,
                        scopeType: d.scopeType || (d.hostelId === "all" || !d.hostelId ? "all_managed_hostels" : "single_hostel"),
                        boundHostelIds: Array.isArray(d.boundHostelIds) ? d.boundHostelIds : (d.hostelId && d.hostelId !== "all" ? [d.hostelId] : []),
                        momoNetwork: d.momoNetwork,
                        momoNumber: d.momoNumber,
                        momoName: d.momoName,
                        branch: d.branch,
                    });
                });

                // If payout_accounts had 0, check legacy bankAccounts collection
                if (fetched.length === 0) {
                    const legacyRef = collection(db, "bankAccounts");
                    const legSnap = await getDocs(query(legacyRef, where("managerId", "==", hostel.managerId)));
                    legSnap.forEach((docSnap) => {
                        const d = docSnap.data();
                        fetched.push({
                            id: docSnap.id,
                            managerId: d.managerId,
                            accountType: d.type || (d.momoNumber ? "momo" : "bank"),
                            bankName: d.bankName,
                            bankCode: d.bankCode,
                            accountNumber: String(d.accountNumber || d.momoNumber || ""),
                            accountHolderName: d.accountName || d.momoName || "Official Account",
                            isPrimary: !!d.isPrimary,
                            isVerified: !!(d.isVerified || d.verifiedViaPaystack),
                            scopeType: d.scopeType || (d.hostelId === "all" || !d.hostelId ? "all_managed_hostels" : "single_hostel"),
                            boundHostelIds: Array.isArray(d.boundHostelIds) ? d.boundHostelIds : (d.hostelId && d.hostelId !== "all" ? [d.hostelId] : []),
                            momoNetwork: d.momoNetwork,
                            momoNumber: d.momoNumber,
                            momoName: d.momoName,
                            branch: d.branch,
                        });
                    });
                }

                // Dynamic Scoping Filter: restrict to accounts bound to THIS hostel or global manager scope
                const validAccounts = filterAccountsForHostel(fetched, hostelId);
                setAccounts(validAccounts);
            } catch (err) {
                console.error("Error streaming scoped payout accounts:", err);
            } finally {
                setLoadingAccounts(false);
            }
        }

        loadScopedAccounts();
    }, [hostelId, hostel?.managerId]);

    // Filter by type
    const filteredAccounts = useMemo(() => {
        if (activeTab === "all") return accounts;
        return accounts.filter((a) => a.accountType === activeTab);
    }, [accounts, activeTab]);

    const handleCopy = (text: string, id: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        setCopiedId(id);
        toast({
            title: "Copied to Clipboard",
            description: `${text} copied. Use this official number for your transfer.`,
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Open deposit submission modal for a specific account
    const openDepositDialog = (account: PayoutAccount) => {
        // Strict client-side verification
        if (!isAccountBoundToHostel(account, hostelId)) {
            toast({
                title: "Unauthorized Account",
                description: "This payment account is not linked to the selected hostel.",
                variant: "destructive",
            });
            return;
        }

        setSelectedAccountForDeposit(account);
        setDepositError(null);
        setDepositSuccess(false);
        setDepositDialogOpen(true);
    };

    // Submit payment receipt with strict 403 guard check
    const handleSubmitDepositReceipt = async () => {
        if (!selectedAccountForDeposit) return;
        setDepositError(null);

        // Enforce client validation
        if (!depositAmount || Number(depositAmount) <= 0) {
            setDepositError("Please provide a valid deposit amount.");
            return;
        }
        if (!transactionRef.trim()) {
            setDepositError("Please enter your transaction reference / receipt code.");
            return;
        }
        if (!payerPhone.trim()) {
            setDepositError("Please enter your contact phone number for confirmation.");
            return;
        }

        // Strict Authorization Enforcement
        if (
            !selectedAccountForDeposit.boundHostelIds?.includes(hostelId) &&
            selectedAccountForDeposit.scopeType !== "all_managed_hostels" &&
            selectedAccountForDeposit.hostelId !== "all" &&
            selectedAccountForDeposit.hostelId !== hostelId
        ) {
            setDepositError("Unauthorized: This payment account is not linked to the selected hostel.");
            return;
        }

        try {
            setSubmittingDeposit(true);

            const res = await fetch(`/api/hostels/${encodeURIComponent(hostelId)}/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hostelId,
                    accountId: selectedAccountForDeposit.id,
                    amount: Number(depositAmount),
                    transactionReference: transactionRef.trim(),
                    payerName: payerName.trim() || currentUser?.displayName || "Student",
                    payerPhone: payerPhone.trim(),
                    studentId: currentUser?.uid || "",
                    bookingId: bookingId || undefined,
                    notes: depositNotes.trim(),
                }),
            });

            const data = await res.json();

            if (res.status === 403 || !res.ok || !data.status) {
                // Strict 403 Forbidden Error
                const errMsg = data.error || "Unauthorized: This payment account is not linked to the selected hostel.";
                setDepositError(errMsg);
                toast({
                    title: "Authorization Error (403)",
                    description: errMsg,
                    variant: "destructive",
                });
                return;
            }

            setDepositSuccess(true);
            toast({
                title: "Deposit Receipt Submitted",
                description: "Your payment confirmation has been forwarded to the hostel manager for verification.",
            });
        } catch (err: any) {
            console.error("Error submitting deposit receipt:", err);
            setDepositError(err.message || "An unexpected error occurred while posting your receipt.");
        } finally {
            setSubmittingDeposit(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Navigation & Header */}
                <div className="flex items-center justify-between gap-4">
                    <Button asChild variant="ghost" size="sm" className="rounded-xl gap-2 text-xs font-semibold">
                        <Link href={`/hostels/${hostelId}`}>
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back to Hostel</span>
                        </Link>
                    </Button>

                    <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Verified Hostel Payout Channel</span>
                    </Badge>
                </div>

                {/* Hero / Hostel Scoping Banner */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                                Official Payment Directory
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                                {loadingHostel ? "Loading Hostel..." : hostel?.name || "Hostel Payout Details"}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                <span>
                                    Accounts below are strictly scoped to{" "}
                                    <strong className="text-foreground">{hostel?.name || "this hostel"}</strong> and managed by{" "}
                                    <strong className="text-foreground">{hostel?.managerName || "Property Administration"}</strong>.
                                </span>
                            </p>
                        </div>

                        {hostel?.price && (
                            <div className="p-3 rounded-2xl bg-background/80 border border-border/80 text-right shrink-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Base Rate</span>
                                <p className="text-lg font-mono font-bold text-primary">
                                    {hostel.currency || "GHS"} {hostel.price.toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Security Advisory */}
                <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200 rounded-2xl">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-xs font-bold">Strict Payment Security Active</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                        Students are protected against cross-hostel routing errors. You will only see bank and MoMo accounts officially bound to this property.
                    </AlertDescription>
                </Alert>

                {/* Type Filter Tabs */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                        <TabsList className="h-10 rounded-2xl bg-muted/60 p-1">
                            <TabsTrigger value="all" className="text-xs rounded-xl px-3 font-semibold">
                                All Accounts ({accounts.length})
                            </TabsTrigger>
                            <TabsTrigger value="bank" className="text-xs rounded-xl px-3 font-semibold gap-1.5">
                                <Landmark className="h-3.5 w-3.5" />
                                <span>Bank Transfer</span>
                            </TabsTrigger>
                            <TabsTrigger value="momo" className="text-xs rounded-xl px-3 font-semibold gap-1.5">
                                <Smartphone className="h-3.5 w-3.5" />
                                <span>Mobile Money</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <span className="text-xs text-muted-foreground">
                        Showing {filteredAccounts.length} verified account{filteredAccounts.length === 1 ? "" : "s"}
                    </span>
                </div>

                {/* Accounts Grid */}
                {loadingAccounts ? (
                    <div className="py-16 text-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-xs text-muted-foreground">Querying verified payment channels for this hostel...</p>
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <Card className="rounded-3xl border-dashed p-10 text-center space-y-3">
                        <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
                        <h3 className="text-base font-bold text-foreground">No Payment Accounts Bound Yet</h3>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto">
                            The manager for {hostel?.name || "this hostel"} has not yet bound an active payout account to this property. Please reach out to management directly.
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredAccounts.map((account) => {
                            const isBank = account.accountType === "bank";
                            const providerTitle = isBank
                                ? account.bankName || "Ghana Commercial Bank"
                                : `${account.momoNetwork || "MTN"} Mobile Money`;

                            return (
                                <Card
                                    key={account.id}
                                    className={cn(
                                        "rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between",
                                        account.isPrimary
                                            ? "border-primary/40 bg-card shadow-md shadow-primary/5 ring-1 ring-primary/20"
                                            : "border-border/70 bg-card hover:border-border"
                                    )}
                                >
                                    <CardHeader className="p-5 pb-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "text-[10px] font-bold rounded-lg px-2 py-0.5",
                                                    isBank
                                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
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
                                                        <span>{account.momoNetwork || "MoMo"}</span>
                                                    </span>
                                                )}
                                            </Badge>

                                            <div className="flex items-center gap-1.5">
                                                {account.isPrimary && (
                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold rounded-lg px-2 py-0.5">
                                                        <Star className="h-2.5 w-2.5 mr-1 fill-emerald-500" />
                                                        Primary
                                                    </Badge>
                                                )}
                                                {account.isVerified && (
                                                    <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/5 gap-1 py-0.5">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                        <span>Verified</span>
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-bold text-foreground truncate">{providerTitle}</h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                                <span className="truncate">
                                                    {account.scopeType === "all_managed_hostels"
                                                        ? "All Properties under Management"
                                                        : `Strictly Bound: ${hostel?.name || "This Hostel"}`}
                                                </span>
                                            </p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-5 pt-0 space-y-4">
                                        {/* Account Number Box */}
                                        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {isBank ? "Account Number" : "MoMo Number"}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleCopy(account.accountNumber, account.id)}
                                                    className="h-6 px-2 text-[11px] gap-1 rounded-lg text-muted-foreground hover:text-foreground"
                                                >
                                                    {copiedId === account.id ? (
                                                        <>
                                                            <Check className="h-3 w-3 text-emerald-600" />
                                                            <span className="text-emerald-600 font-bold">Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-3 w-3" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-lg font-mono font-extrabold tracking-tight text-foreground">
                                                {account.accountNumber}
                                            </p>
                                        </div>

                                        {/* Account Holder Name */}
                                        <div className="text-xs space-y-0.5">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Beneficiary / Account Name
                                            </span>
                                            <p className="font-semibold text-foreground text-sm truncate">
                                                {account.accountHolderName}
                                            </p>
                                            {account.branch && (
                                                <p className="text-[11px] text-muted-foreground">Branch: {account.branch}</p>
                                            )}
                                        </div>

                                        {/* Submit Deposit Receipt Button */}
                                        <Button
                                            onClick={() => openDepositDialog(account)}
                                            className="w-full rounded-xl font-semibold text-xs gap-2"
                                            variant={account.isPrimary ? "default" : "outline"}
                                        >
                                            <Receipt className="h-4 w-4" />
                                            <span>I Have Paid (Submit Deposit Receipt)</span>
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* MANUAL DEPOSIT SUBMISSION MODAL */}
            <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            <span>Confirm Manual Deposit / Transfer</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Submit your transaction receipt for verification against {hostel?.name || "this hostel"}.
                        </DialogDescription>
                    </DialogHeader>

                    {depositSuccess ? (
                        <div className="py-6 space-y-4 text-center">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-bold">Deposit Receipt Posted!</h3>
                                <p className="text-xs text-muted-foreground">
                                    Your reference <strong>{transactionRef}</strong> has been logged. The manager will verify your transfer shortly.
                                </p>
                            </div>
                            <Button
                                onClick={() => {
                                    setDepositDialogOpen(false);
                                    setDepositSuccess(false);
                                }}
                                className="rounded-xl w-full"
                            >
                                Done
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3.5 py-2">
                            {/* Target Account Summary */}
                            {selectedAccountForDeposit && (
                                <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Paying Into:
                                    </span>
                                    <p className="font-bold text-foreground">
                                        {selectedAccountForDeposit.bankName || selectedAccountForDeposit.momoNetwork} —{" "}
                                        {selectedAccountForDeposit.accountNumber}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        Name: {selectedAccountForDeposit.accountHolderName}
                                    </p>
                                </div>
                            )}

                            {depositError && (
                                <Alert className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 rounded-2xl text-xs py-2.5">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-bold">Error</AlertTitle>
                                    <AlertDescription className="text-xs">{depositError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Amount */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Amount Paid (GHS) *</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 3500"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="h-10 text-xs rounded-xl font-mono"
                                />
                            </div>

                            {/* Transaction Ref / Receipt Number */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Transaction ID / Reference / MoMo Token *</Label>
                                <Input
                                    placeholder="e.g. TRX-982348 or MoMo Transaction ID"
                                    value={transactionRef}
                                    onChange={(e) => setTransactionRef(e.target.value)}
                                    className="h-10 text-xs rounded-xl font-mono"
                                />
                            </div>

                            {/* Payer Name & Phone */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Student Name *</Label>
                                    <Input
                                        placeholder="Full Name"
                                        value={payerName}
                                        onChange={(e) => setPayerName(e.target.value)}
                                        className="h-10 text-xs rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Phone Number *</Label>
                                    <Input
                                        placeholder="024XXXXXXX"
                                        value={payerPhone}
                                        onChange={(e) => setPayerPhone(e.target.value)}
                                        className="h-10 text-xs rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Additional Notes / Room No.</Label>
                                <Input
                                    placeholder="e.g. Room 12 deposit for 1st Semester"
                                    value={depositNotes}
                                    onChange={(e) => setDepositNotes(e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                />
                            </div>

                            <DialogFooter className="pt-2 gap-2 sm:gap-0">
                                <Button
                                    variant="outline"
                                    onClick={() => setDepositDialogOpen(false)}
                                    className="rounded-xl text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitDepositReceipt}
                                    disabled={submittingDeposit}
                                    className="rounded-xl text-xs font-semibold gap-1.5"
                                >
                                    {submittingDeposit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    <span>Verify & Post Receipt</span>
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
