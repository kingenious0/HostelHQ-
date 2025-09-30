import { Header } from '@/components/header';
import { hostels } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
    const hostel = hostels.find((h) => h.id === params.id);

    if (!hostel) {
        notFound();
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4">
                <Card className="w-full max-w-md shadow-xl text-center">
                    <CardHeader className="items-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                        <CardTitle className="text-2xl font-headline">Booking Successful!</CardTitle>
                        <CardDescription>Your visit to {hostel.name} has been confirmed.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="relative h-40 w-full rounded-lg overflow-hidden">
                            <Image src={hostel.images[0]} alt={hostel.name} fill style={{ objectFit: 'cover' }} data-ai-hint="hostel exterior" />
                        </div>
                        <p className="text-muted-foreground">You will receive an email confirmation shortly with the details of your visit. The agent will contact you to schedule the exact time.</p>
                        <Link href="/">
                            <Button className="w-full">Back to Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
