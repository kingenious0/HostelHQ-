
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, RefreshCw, Briefcase, DollarSign } from "lucide-react";
import {
    getPendingWithdrawals,
    processWithdrawalAction,
    processBulkWithdrawalAction,
    rejectWithdrawalAction,
    getSystemSettings,
    setPayoutAutoApprove,
    PayoutRequest
} from "@/app/actions/payouts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { checkPaystackBalance } from "@/lib/paystack-payouts";

export default function AdminPayoutsPage() {
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const { toast } = useToast();
    const [balance, setBalance] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        const data = await getPendingWithdrawals();
        setRequests(data);

        // Also fetch admin balance
        try {
            // We can't call library function directly from client if it uses secrets? 
            // Ah, wait. paystack-payouts.ts uses process.env.PAYSTACK_SECRET_KEY which is SERVER only.
            // I need a server action for balance. I'll skip balance display for now or add a server action wrapper.
            // Doing it implicitly via the actions/payouts.ts check is safer.
        } catch (e) { }

        setLoading(false);
    };

    const [autoApprove, setAutoApprove] = useState(false);

    useEffect(() => {
        fetchData();
        getSystemSettings().then(s => setAutoApprove(s.autoApprove));
    }, []);

    const handleAutoApproveToggle = async (checked: boolean) => {
        setAutoApprove(checked);
        const result = await setPayoutAutoApprove(checked);
        if (result.success) {
            toast({ title: "Settings Updated", description: `Auto-Approval is now ${checked ? 'ON' : 'OFF'}` });
        } else {
            setAutoApprove(!checked); // Revert UI on failure
            toast({ title: "Update Failed", description: result.message, variant: 'destructive' });
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(requests.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const handleApprove = async (id: string) => {
        if (!confirm("Are you sure you want to release funds for this request?")) return;

        setProcessingId(id);
        const result = await processWithdrawalAction(id);
        if (result.success) {
            toast({ title: "Funds Released", description: result.message });
            fetchData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setProcessingId(null);
    };

    const handleReject = async (id: string) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;

        setProcessingId(id);
        const result = await rejectWithdrawalAction(id, reason);
        if (result.success) {
            toast({ title: "Request Rejected", description: result.message });
            fetchData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setProcessingId(null);
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to release funds for ${selectedIds.length} requests?`)) return;

        setBulkProcessing(true);
        const result = await processBulkWithdrawalAction(selectedIds);
        if (result.success) {
            toast({ title: "Bulk Payout Initiated", description: result.message });
            fetchData();
            setSelectedIds([]);
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setBulkProcessing(false);
    };

    const totalRequested = requests.reduce((acc, r) => acc + r.amount, 0);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header />
            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Payout Control Center</h1>
                        <p className="text-muted-foreground">Manage and release agent/manager withdrawals.</p>
                    </div>
                    <Button onClick={fetchData} variant="outline" size="icon">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Auto-Approval</CardTitle>
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="flex items-center space-x-2 pt-4">
                            <Switch id="auto-mode" checked={autoApprove} onCheckedChange={handleAutoApproveToggle} />
                            <Label htmlFor="auto-mode">{autoApprove ? 'Enabled' : 'Disabled'}</Label>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{requests.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Pending Value</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">GH₵ {(totalRequested / 100).toFixed(2)}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ready for Release</CardTitle>
                            <CheckCircle className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full mt-2"
                                onClick={handleBulkApprove}
                                disabled={selectedIds.length === 0 || bulkProcessing}
                            >
                                {bulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Release Funds ({selectedIds.length})
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="rounded-md border bg-white shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={requests.length > 0 && selectedIds.length === requests.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>MoMo Details</TableHead>
                                <TableHead>Amount (GHS)</TableHead>
                                <TableHead>Requested At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No pending withdrawal requests.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(request.id)}
                                                onCheckedChange={(checked) => handleSelectOne(request.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {request.userName}
                                            <div className="text-xs text-muted-foreground truncate w-32" title={request.userId}>ID: {request.userId}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{request.phonenumber}</span>
                                                <span className="text-xs text-muted-foreground uppercase">{request.network || 'MoMo'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-lg">
                                            {(request.amount / 100).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(request.requestedAt), 'dd MMM HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => handleReject(request.id)}
                                                    disabled={processingId === request.id}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleApprove(request.id)}
                                                    disabled={processingId === request.id}
                                                >
                                                    {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Push"}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </main>
        </div>
    );
}
