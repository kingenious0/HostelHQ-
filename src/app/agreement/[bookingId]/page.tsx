// src/app/agreement/[bookingId]/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { Hostel, RoomType } from '@/lib/data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { tenancyAgreementText } from '@/lib/legal';

type Booking = {
    id: string;
    studentId: string;
    studentDetails: any;
    hostelId: string;
    bookingDate: string;
    status: string;
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
    const [isDownloading, setIsDownloading] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bookingId) {
            toast({ title: "Error", description: "No booking ID provided.", variant: "destructive" });
            router.push('/');
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
                        where('role', '==', 'hostel_manager')
                        // This logic assumes an agent is linked to a manager.
                        // A more direct link from hostel -> manager would be better.
                        // For now, let's find ANY manager for demo purposes.
                    );
                    const managerSnapshot = await getDocs(
                        query(
                            collection(db, 'users'), 
                            where('role', '==', 'hostel_manager'), 
                            limit(1)
                        )
                    );
                    
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
                router.push('/my-visits');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [bookingId, router, toast]);

    const handleDownload = async () => {
        if (!printRef.current) return;
        setIsDownloading(true);
        toast({ title: "Generating PDF..."});

        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const finalHeight = canvasHeight / ratio;
            
            let position = 0;
            let heightLeft = finalHeight;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - finalHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`tenancy-agreement-${hostel?.name?.replace(/\s/g, '-')}.pdf`);
            toast({ title: "Download started", description: "Your PDF is being downloaded."});

        } catch (error) {
            console.error(error);
            toast({ title: "Download Failed", description: "Could not generate the PDF.", variant: "destructive"});
        } finally {
            setIsDownloading(false);
        }
    };
    
    const getFilledTemplate = () => {
        if (!booking || !hostel || !manager) return "";
        let content = tenancyAgreementText;
        
        const studentDetails = booking.studentDetails;
        // Defensively handle cases where roomTypes might be missing or empty
        const roomTypes = Array.isArray((hostel as any).roomTypes) ? (hostel as any).roomTypes : [];
        const room = roomTypes.find((rt: any) => rt.id === (booking as any).roomTypeId) || roomTypes[0] || null;

        const replacements = {
            '{{studentName}}': studentDetails?.fullName || 'N/A',
            '{{studentID}}': studentDetails?.indexNumber || 'N/A',
            '{{studentPhone}}': studentDetails?.phoneNumber || 'N/A',
            '{{studentEmail}}': studentDetails?.email || 'N/A',
            '{{hostelName}}': hostel.name,
            '{{hostelAddress}}': hostel.location,
            '{{roomNumber}}': 'To be assigned',
            '{{roomType}}': room?.name || 'N/A',
            '{{rentAmount}}': room && typeof room.price === 'number' ? room.price.toLocaleString() : 'N/A',
            '{{startDate}}': new Date().toLocaleDateString(),
            '{{endDate}}': new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
            '{{managerName}}': manager?.fullName || 'Hostel Management',
            // Add other placeholders as needed
        };

        for (const [key, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(key, 'g'), value);
        }

        return content;
    }

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
                                <Button onClick={handleDownload} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                    Download PDF
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div ref={printRef} className="p-8 border rounded-lg bg-white shadow-sm text-sm text-gray-800">
                                <h1 className="text-xl font-bold text-center mb-6">TENANCY AGREEMENT</h1>
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                    {getFilledTemplate()}
                                </pre>
                                 <div className="mt-16 grid grid-cols-2 gap-16">
                                    <div>
                                        <div className="border-t pt-2">
                                            <p className="font-semibold">Student Signature</p>
                                            <p className="text-xs">({booking.studentDetails.fullName})</p>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="border-t pt-2">
                                            <p className="font-semibold">Manager Signature</p>
                                            <p className="text-xs">({manager.fullName})</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter>
                            <p className="text-xs text-muted-foreground">
                                Please keep a copy of this agreement for your records. You can access this page anytime from your "My Bookings" section.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
