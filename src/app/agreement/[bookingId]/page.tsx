// src/app/agreement/[bookingId]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download, Calendar, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { Hostel } from '@/lib/data';
import { BackButton } from '@/components/ui/back-button';

type Booking = {
    id: string;
    studentId: string;
    studentDetails: {
      fullName: string;
      indexNumber?: string;
      phoneNumber?: string;
      email: string;
      program?: string;
      ghanaCard?: string;
      address?: string;
    };
    hostelId: string;
    bookingDate: string;
    status: string;
    roomTypeId?: string;
    paymentDeadline?: { seconds: number; nanoseconds: number; };
};

type Manager = {
    id: string;
    fullName: string;
}

export default function AgreementPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { bookingId } = params;

    const [booking, setBooking] = useState<Booking | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [manager, setManager] = useState<Manager | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadCompleted, setDownloadCompleted] = useState(false);

    const staticAgreementPath = encodeURI('/Professional_Hostel_Tenancy_Agreement_static new.pdf');

    useEffect(() => {
        if (!bookingId) {
            toast({ title: "Error", description: "No booking ID provided.", variant: "destructive" });
            router.push('/my-bookings'); // Redirect to my bookings if no ID
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch Booking
                const bookingRef = doc(db, 'bookings', bookingId as string);
                const bookingSnap = await getDoc(bookingRef);
                if (!bookingSnap.exists()) throw new Error("Booking not found.");
                const bookingData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
                setBooking(bookingData);

                // Fetch Hostel
                const hostelRef = doc(db, 'hostels', bookingData.hostelId);
                const hostelSnap = await getDoc(hostelRef);
                if (!hostelSnap.exists()) throw new Error("Hostel not found.");
                const hostelData = { id: hostelSnap.id, ...hostelSnap.data() } as Hostel;
                setHostel(hostelData);
                
                // Fetch the manager associated with the hostel's agentId
                if (hostelData.agentId) {
                    const managerQuery = query(
                        collection(db, 'users'),
                        where('uid', '==', hostelData.agentId), // Assuming agentId is the manager's uid for now
                            limit(1)
                    );
                    const managerSnapshot = await getDocs(managerQuery);
                    
                    if (!managerSnapshot.empty) {
                        const managerData = managerSnapshot.docs[0].data();
                        setManager({ id: managerSnapshot.docs[0].id, fullName: managerData.fullName });
                    } else {
                        setManager({ id: 'default-manager', fullName: 'Hostel Management' });
                    }
                } else {
                     setManager({ id: 'default-manager', fullName: 'Hostel Management' });
                }


            } catch (error: any) {
                console.error("Failed to fetch agreement data:", error);
                toast({ title: "Failed to load agreement", description: error.message, variant: "destructive" });
                router.push('/my-bookings');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [bookingId, router, toast]);

    const handleDownload = async () => {
        if (!booking || !hostel || !manager) return;
        
        toast({ title: "Generating PDF..."});

        try {
            const filename = `tenancy-agreement-${hostel.name.replace(/\s/g, '-')}-${booking.id.slice(-4)}.pdf`;
            const link = document.createElement('a');
            link.href = staticAgreementPath;
            link.download = filename;
            link.target = '_blank';
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({ title: "Download started", description: "Your PDF is being downloaded."});
            setDownloadCompleted(true);

        } catch (error) {
            console.error(error);
            toast({ 
                title: "Download Failed", 
                description: "Could not generate the PDF. Please try again.", 
                variant: "destructive"
            });
            setDownloadCompleted(false);
        }
    };

    if (loading) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-4">
                        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading your agreement...</p>
                    </div>
                </main>
            </div>
        );
    }
    
    if (!booking || !hostel || !manager) {
         return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <p className="text-destructive">Failed to load agreement details.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 py-12 px-4">
                <div className="container mx-auto max-w-4xl">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-headline">Your Tenancy Agreement</CardTitle>
                                    <CardDescription>This is your official agreement for your room at {hostel.name}.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <BackButton fallbackHref="/my-bookings" />
                                    <Button onClick={handleDownload}>
                                        <Download className="mr-2 h-4 w-4"/>
                                        Download PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 py-20 px-6 text-center">
                                <FileText className="h-20 w-20 text-primary" />
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold">Professional Hostel Tenancy Agreement</h2>
                                    <p className="text-muted-foreground max-w-md mx-auto">
                                        Your tenancy agreement is ready. Download the PDF, fill it out manually, sign, and submit it to the hostel management.
                                    </p>
                                        </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button asChild variant="secondary">
                                        <a href={staticAgreementPath} target="_blank" rel="noopener">
                                            <FileText className="mr-2 h-4 w-4" />
                                            Open in new tab
                                        </a>
                                    </Button>
                                    <Button onClick={handleDownload}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download PDF
                                    </Button>
                                    </div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex flex-col gap-4">
                            {downloadCompleted && (
                                <Button 
                                    onClick={() => router.push('/my-bookings')} 
                                    variant="default"
                                    size="lg"
                                    className="w-full"
                                >
                                    <Calendar className="mr-2 h-4 w-4"/>
                                    Go to your bookings
                                </Button>
                            )}
                            <p className="text-xs text-muted-foreground text-center">
                                Please keep a copy of this agreement for your records. You can access this page anytime from your "My Bookings" section.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
