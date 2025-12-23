
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registerPaystackRecipient } from "@/app/actions/payouts";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PaystackSetupModalProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function PaystackSetupModal({ userId, isOpen, onClose, onSuccess }: PaystackSetupModalProps) {
    const [name, setName] = useState("");
    const [number, setNumber] = useState(""); // Account Number (Phone)
    const [provider, setProvider] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!name || !number || !provider) {
            toast({ title: "Missing fields", description: "Please fill in all details.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const result = await registerPaystackRecipient(userId, name, number, provider);
            if (result.success) {
                toast({ title: "Success", description: result.message });
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
                    <DialogTitle>Link Mobile Money Wallet</DialogTitle>
                    <DialogDescription>
                        Link your MoMo account to receive instant payouts.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Account Name (As registered on MoMo)</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Kwame Mensah"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Mobile Number</Label>
                        <Input
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="024xxxxxxx"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Network Provider</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                                <SelectItem value="VOD">Telecel (Vodafone) Cash</SelectItem>
                                <SelectItem value="ATL">AirtelTigo Money</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Link Account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
