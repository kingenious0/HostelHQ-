
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { requestWithdrawal } from "@/app/actions/payouts";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface WithdrawalModalProps {
    userId: string;
    availableBalance: number; // in pesewas
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function WithdrawalModal({ userId, availableBalance, isOpen, onClose, onSuccess }: WithdrawalModalProps) {
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const maxAmountGhs = availableBalance / 100;

    const handleSubmit = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount > 0", variant: "destructive" });
            return;
        }

        if (val > maxAmountGhs) {
            toast({ title: "Insufficient Funds", description: `You can only withdraw up to GHS ${maxAmountGhs.toFixed(2)}`, variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const amountPesewas = Math.round(val * 100);
            const result = await requestWithdrawal(userId, amountPesewas);
            if (result.success) {
                toast({ title: "Request Submitted", description: result.message });
                onSuccess();
                onClose();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                    <DialogDescription>
                        Request a payout to your linked MoMo wallet.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg bg-muted p-4 text-center">
                        <span className="text-sm text-muted-foreground">Available to Withdraw</span>
                        <div className="mt-1 text-3xl font-bold text-primary">
                            GH₵ {maxAmountGhs.toFixed(2)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount to Withdraw (GHS)</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            min={1}
                            max={maxAmountGhs}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
