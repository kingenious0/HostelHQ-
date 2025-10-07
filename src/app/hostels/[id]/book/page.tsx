
import { Header } from '@/components/header';
import { getHostel } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { PAYSTACK_PAYMENT_SLUG } from '@/lib/paystack';

export default async function BookingPage({ params }: { params: { id: string } }) {
    const hostel = await getHostel(params.id);

    if (!hostel) {
        notFound();
    }
    
    // Note: In a real app, email and ref would be dynamic.
    const queryParams = new URLSearchParams({
        email: 'student@test.com',
        amount: (10 * 100).toString(), // Paystack amount is in pesewas (10 GH₵)
        ref: `hostel-visit-${params.id}-${Date.now()}`,
        label: "Hostel Visit Fee",
        currency: 'GHS',
        callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/hostels/${params.id}/book/confirmation`,
    }).toString();

    const paystackUrl = `https://paystack.shop/pay/${PAYSTACK_PAYMENT_SLUG}?${queryParams}`;


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

                        <form className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="date">Preferred Visit Date</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input id="date" type="date" className="pl-10" />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground text-center pt-2">You will be redirected to Paystack to complete your payment.</p>
                        </form>

                    </CardContent>
                    <CardFooter>
                        <Link href={paystackUrl} className="w-full">
                            <Button className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground">
                                <CreditCard className="mr-2 h-5 w-5" />
                                Proceed to Pay
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
