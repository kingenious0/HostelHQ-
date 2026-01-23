
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WithdrawalModal } from "./withdrawal-modal";
import { Wallet, ArrowUpRight, CreditCard } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ManagerWalletCardProps {
    userId: string;
}

export function ManagerWalletCard({ userId }: ManagerWalletCardProps) {
    const [balanceData, setBalanceData] = useState<{
        balance: number;
        currency: string;
        recipientCode?: string;
        momoNumber?: string;
        momoProviderName?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [withdrawOpen, setWithdrawOpen] = useState(false);

    useEffect(() => {
        if (!userId) return;

        setLoading(true);
        const userRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBalanceData({
                    balance: data.walletBalance || 0,
                    currency: 'GHS', // Default to GHS
                    recipientCode: data.paystackRecipientCode,
                    momoNumber: data.momoNumber,
                    momoProviderName: data.momoProviderName
                });
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching wallet balance:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const hasLinkedAccount = !!balanceData?.recipientCode;

    // Helper to map saved provider name back to code for pre-filling
    const getNetworkCode = (name?: string) => {
        if (!name) return "";
        const lower = name.toLowerCase();
        if (lower.includes('mtn')) return 'MTN';
        if (lower.includes('vodafone') || lower.includes('telecel')) return 'VOD';
        if (lower.includes('airtel') || lower.includes('tigo')) return 'ATL';
        return "";
    };

    return (
        <>
            <Card className="shadow-lg border-primary/20 bg-gradient-to-br from-background to-muted/30">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Wallet className="h-5 w-5 text-primary" />
                        Wallet Balance
                    </CardTitle>
                    <CardDescription>Earnings available for withdrawal</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-1">
                        {loading ? (
                            <div className="h-10 w-32 animate-pulse rounded bg-muted"></div>
                        ) : (
                            <div className="text-4xl font-bold tracking-tight text-primary">
                                GH₵ {(balanceData?.balance! / 100).toFixed(2)}
                            </div>
                        )}

                        {!loading && hasLinkedAccount && (
                            <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                <CreditCard className="mr-1 h-3 w-3" />
                                <span>Linked: {balanceData?.momoProviderName} • {balanceData?.momoNumber}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="pt-2 gap-2">
                    {loading ? (
                        <div className="h-9 w-full rounded bg-muted animate-pulse"></div>
                    ) : (
                        <>
                            <Button className="w-full gap-2" variant="default" onClick={() => setWithdrawOpen(true)}>
                                <ArrowUpRight className="h-4 w-4" /> Withdraw Funds
                            </Button>

                            {/* Real-time indicator (optional) */}
                            <div className="flex justify-center mt-2">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    Live Balance
                                </span>
                            </div>
                        </>
                    )}
                </CardFooter>
            </Card>

            <WithdrawalModal
                userId={userId}
                availableBalance={balanceData?.balance || 0}
                isOpen={withdrawOpen}
                onClose={() => setWithdrawOpen(false)}
                onSuccess={() => { }}
                defaultNetwork={getNetworkCode(balanceData?.momoProviderName)}
                defaultNumber={balanceData?.momoNumber}
            />
        </>
    );
}
