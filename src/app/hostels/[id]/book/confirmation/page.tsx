import { Header } from '@/components/header';
import { hostels } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
    const hostel = hostels.find((h) => h.id === params.id);

    if (!hostel) {
        notFound();
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Card className="w-full max-w-md shadow-xl text-center">
                    <CardHeader className="items-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                        <CardTitle className="text-2xl font-headline">Booking Request Sent!</CardTitle>
                        <CardDescription>Your visit request for {hostel.name} has been received.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="relative h-40 w-full rounded-lg overflow-hidden">
                            <Image src={hostel.images[0]} alt={hostel.name} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel exterior" />
                        </div>
                        
                        <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertTitle>What Happens Next?</AlertTitle>
                            <AlertDescription>
                                The hostel agent has been notified. They will contact you within 24 hours via the contact details you provided during sign-up to schedule the exact time and date for your visit.
                            </AlertDescription>
                        </Alert>
                        
                        <p className="text-sm text-muted-foreground">You will also receive an email confirmation shortly with your booking details.</p>

                        <Link href="/" className="w-full">
                            <Button className="w-full">Back to Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
