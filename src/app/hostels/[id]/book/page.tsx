
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { getHostel, Hostel } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PAYSTACK_PUBLIC_KEY } from '@/lib/paystack';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function BookingPage() {
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    useEffect(() => {
        const fetchHostelData = async () => {
            const hostelData = await getHostel(id);
            if (!hostelData) {
                notFound();
            }
            setHostel(hostelData);
            setLoading(false);
        };
        fetchHostelData();
    }, [id]);

    useEffect(() => {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      }
    }, []);

    const handlePayment = () => {
        if (!hostel) return;

        setIsPaying(true);
        const paystack = new window.PaystackPop();

        paystack.newTransaction({
            key: PAYSTACK_PUBLIC_KEY,
            email: 'student@test.com', // In a real app, get this from user's profile
            amount: 10 * 100, // 10 GHS in pesewas
            currency: 'GHS',
            ref: `hostel-visit-${id}-${Date.now()}`,
            label: `Visit fee for ${hostel.name}`,
            onSuccess: (transaction: any) => {
                toast({ title: "Payment Successful!", description: "Redirecting to confirmation..."});
                router.push(`/hostels/${id}/book/confirmation?reference=${transaction.reference}`);
            },
            onCancel: () => {
                toast({ title: "Payment Cancelled", variant: "destructive" });
                setIsPaying(false);
            },
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                </main>
            </div>
        );
    }
    
    if (!hostel) {
        notFound();
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4">
                <Card className="w-full max-w-lg shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Book a Visit to {hostel.name}</CardTitle>
                        <CardDescription>Secure your spot to visit this hostel. A small fee is required.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative h-24 w-24 rounded-lg overflow-hidden">
                                <Image src={hostel.images[0]} alt={hostel.name} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel exterior" />
                            </div>
                            <div>
                                <h3 className="font-semibold">{hostel.name}</h3>
                                <p className="text-sm text-muted-foreground">{hostel.location}</p>
                            </div>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between items-center">
                                <span>Visit Fee</span>
                                <span className="font-semibold">GH₵ 10.00</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>Total</span>
                                <span>GH₵ 10.00</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="date">Preferred Visit Date</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input id="date" type="date" className="pl-10" defaultValue={new Date().toISOString().split('T')[0]} />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground text-center pt-2">The Paystack checkout will open in a popup.</p>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handlePayment} disabled={isPaying}>
                            {isPaying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                            Proceed to Pay
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}

