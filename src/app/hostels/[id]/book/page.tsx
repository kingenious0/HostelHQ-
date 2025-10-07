
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
import { CreditCard, Calendar, Loader2, Phone, Briefcase } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initializeMomoPayment } from '@/app/actions/paystack';

export default function BookingPage() {
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    
    // Form state
    const [phone, setPhone] = useState('');
    const [provider, setProvider] = useState('');
    const [email, setEmail] = useState('student@test.com'); // Default email

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

    const handlePayment = async () => {
        if (!hostel || !phone || !provider || !email) {
            toast({ title: "Missing Information", description: "Please fill in your email, phone, and select a provider.", variant: "destructive" });
            return;
        }

        setIsPaying(true);
        toast({ title: "Initializing Payment..." });
        
        try {
            const result = await initializeMomoPayment({
                email,
                amount: 10 * 100, // 10 GHS in pesewas
                phone,
                provider: provider as 'mtn' | 'vod' | 'tgo',
                label: `Visit fee for ${hostel.name}`,
                hostelId: id, // Pass the hostelId
            });

            if (result.status && result.authorization_url) {
                // Open the payment link in a new tab to avoid iframe issues
                window.open(result.authorization_url, '_blank');
                toast({ title: "Complete Payment", description: "Please complete the payment in the new tab."});
                // The user will be redirected to the confirmation page by Paystack in the new tab.
            } else {
                throw new Error(result.message || "Failed to initialize payment.");
            }

        } catch (error: any) {
            console.error("Payment initialization failed:", error);
            toast({ title: "Payment Error", description: error.message || "Could not connect to payment service.", variant: "destructive" });
        } finally {
            setIsPaying(false);
        }
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
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Mobile Money Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input id="phone" type="tel" className="pl-10" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233244123456" />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="provider">Provider</Label>
                                 <Select value={provider} onValueChange={setProvider}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select mobile money provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mtn">MTN</SelectItem>
                                        <SelectItem value="vod">Telecel (Vodafone)</SelectItem>
                                        <SelectItem value="tgo">AirtelTigo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
