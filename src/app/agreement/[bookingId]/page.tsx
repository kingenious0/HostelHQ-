// src/app/agreement/[bookingId]/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download, Printer, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { Hostel, RoomType } from '@/lib/data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { tenancyAgreementText, termsAndConditionsText } from '@/lib/legal';
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
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadCompleted, setDownloadCompleted] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);

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
                position = heightLeft - pdfHeight; // Corrected: subtract pdfHeight not finalHeight
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`tenancy-agreement-${hostel?.name?.replace(/\s/g, '-')}.pdf`);
            toast({ title: "Download started", description: "Your PDF is being downloaded."});
            setDownloadCompleted(true);

        } catch (error) {
            console.error(error);
            toast({ title: "Download Failed", description: "Could not generate the PDF.", variant: "destructive"});
            setDownloadCompleted(false);
        } finally {
            setIsDownloading(false);
        }
    };
    
    const getFilledTemplate = () => {
        if (!booking || !hostel || !manager) return "";
        let content = tenancyAgreementText;
        
        const studentDetails = booking.studentDetails; // Assumed to be available from booking
        // Defensively handle cases where roomTypes might be missing or empty
        const roomTypes = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
        const room = roomTypes.find(rt => rt.id === booking.roomTypeId) || roomTypes[0] || null;

        const today = new Date();
        const academicYearStart = today.getFullYear();
        const academicYearEnd = today.getFullYear() + 1;

        const replacements = {
            '{{currentDate}}': today.toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }),
            '{{hostelName}}': hostel.name.toUpperCase(),
            '{{hostelLocation}}': hostel.location,
            '{{landlordName}}': manager?.fullName || 'Hostel Management',
            '{{tenantName}}': studentDetails?.fullName || 'N/A',
            '{{tenantProgram}}': studentDetails?.program || 'N/A',
            '{{tenantIndexNumber}}': studentDetails?.indexNumber || 'N/A',
            '{{tenantMobile}}': studentDetails?.phoneNumber || 'N/A',
            '{{tenantEmail}}': studentDetails?.email || 'N/A',
            '{{roomType}}': room?.name || 'N/A',
            '{{roomPrice}}': room && typeof room.price === 'number' ? room.price.toLocaleString() : 'N/A',
            '{{academicYear}}': `${academicYearStart}/${academicYearEnd}`,
            '{{paymentDeadline}}': booking.paymentDeadline ? new Date(booking.paymentDeadline.seconds * 1000).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
            '{{roomSharingClause}}': hostel.roomSharingClause || 'Standard room sharing conditions apply.',
            '{{accessRules}}': hostel.accessRules || 'Standard access rules apply.',
            '{{termsAndConditions}}': termsAndConditionsText,
        };

        for (const [key, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(key, 'g'), value);
        }

        return content;
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
                                    <Button onClick={handleDownload} disabled={isDownloading}>
                                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                        Download PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div ref={printRef} className="p-8 border rounded-lg bg-white shadow-sm text-sm text-gray-800 relative overflow-hidden">
                                <div
                                  className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center"
                                  style={{
                                    fontSize: '8rem',
                                    fontWeight: 'bold',
                                    color: '#000',
                                    transform: 'rotate(-45deg)',
                                    userSelect: 'none',
                                  }}
                                >
                                  HostelHQ
                                </div>
                                <h1 className="text-xl font-bold text-center mb-6 relative z-10">TENANCY AGREEMENT</h1>
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed relative z-10">
                                    {getFilledTemplate()}
                                </pre>
                                 <div className="mt-16 grid grid-cols-2 gap-16 relative z-10">
                                    <div>
                                        <div className="border-t pt-2">
                                            <p className="font-semibold">Student Signature</p>
                                            <p className="text-xs mb-8">&nbsp;</p>
                                            <p className="text-xs">({booking.studentDetails.fullName})</p>
                                            <p className="text-xs">Date: {new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="border-t pt-2">
                                            <p className="font-semibold">Manager Signature</p>
                                            <p className="text-xs mb-8">&nbsp;</p>
                                            <p className="text-xs">({manager.fullName})</p>
                                            <p className="text-xs">Date: {new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
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
