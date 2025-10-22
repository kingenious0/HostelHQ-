"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Hostel, RoomType } from '@/lib/data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

type Payment = {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    paymentDate: { seconds: number; nanoseconds: number; };
    status: string;
    type: string; // e.g., 'rent', 'damage_fee'
};

export default function InvoicePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { bookingId } = params;

    const [booking, setBooking] = useState<Booking | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bookingId) {
            toast({ title: "Error", description: "No booking ID provided.", variant: "destructive" });
            router.push('/my-bookings');
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

                // Fetch Payments for this booking
                const paymentsQuery = query(
                    collection(db, 'payments'),
                    where('bookingId', '==', bookingId as string)
                );
                const paymentsSnapshot = await getDocs(paymentsQuery);
                const fetchedPayments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payment[];
                setPayments(fetchedPayments);

            } catch (error: any) {
                console.error("Failed to fetch invoice data:", error);
                toast({ title: "Failed to load invoice", description: error.message, variant: "destructive" });
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
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`invoice-${bookingId}.pdf`);
            toast({ title: "Download started", description: "Your PDF is being downloaded."});

        } catch (error) {
            console.error(error);
            toast({ title: "Download Failed", description: "Could not generate the PDF.", variant: "destructive"});
        } finally {
            setIsDownloading(false);
        }
    };

    if (loading) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-4">
                        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading your invoice...</p>
                    </div>
                </main>
            </div>
        );
    }
    
    if (!booking || !hostel) {
         return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <p className="text-destructive">Failed to load invoice details.</p>
                </main>
            </div>
        );
    }

    // Calculate total amount paid
    const totalAmountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    // Find the room type associated with the booking
    const roomTypes = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
    const bookedRoom = roomTypes.find(rt => rt.id === booking.roomTypeId) || roomTypes[0] || null;
    const roomPrice = bookedRoom && typeof bookedRoom.price === 'number' ? bookedRoom.price : 0;
    const balanceDue = roomPrice - totalAmountPaid;

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 py-12 px-4">
                <div className="container mx-auto max-w-4xl">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-headline">Invoice for Booking #{booking.id.substring(0, 8)}</CardTitle>
                                    <CardDescription>Generated on {new Date().toLocaleDateString()}.</CardDescription>
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
                                  className="absolute inset-0 opacity-10 pointer-events-none"
                                  style={{
                                    backgroundImage: 'url(/HostelHQ.png)',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: 'contain',
                                  }}
                                />
                                <div className="relative z-10">
                                    <h1 className="text-xl font-bold text-center mb-6">INVOICE</h1>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div>
                                            <p className="font-semibold">Invoice To:</p>
                                            <p>{booking.studentDetails.fullName}</p>
                                            <p>{booking.studentDetails.email}</p>
                                            <p>{booking.studentDetails.phoneNumber}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">HostelHQ</p>
                                            <p>Your Accommodation Solution</p>
                                            <p>Ghana</p>
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <h2 className="text-lg font-semibold mb-2">Booking Details</h2>
                                        <p><strong>Hostel:</strong> {hostel.name}</p>
                                        <p><strong>Location:</strong> {hostel.location}</p>
                                        <p><strong>Room Type:</strong> {bookedRoom?.name || 'N/A'}</p>
                                        <p><strong>Booking Date:</strong> {new Date(booking.bookingDate).toLocaleDateString()}</p>
                                    </div>

                                    <div className="mb-8">
                                        <h2 className="text-lg font-semibold mb-2">Payment Summary</h2>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="border-b-2 py-2">Description</th>
                                                    <th className="border-b-2 py-2 text-right">Amount (GH₵)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="py-2">Room Rent for {bookedRoom?.name || 'N/A'}</td>
                                                    <td className="py-2 text-right">{roomPrice.toFixed(2)}</td>
                                                </tr>
                                                {payments.map(payment => (
                                                    <tr key={payment.id}>
                                                        <td className="py-2">Payment ({payment.type}) - {new Date(payment.paymentDate.seconds * 1000).toLocaleDateString()}</td>
                                                        <td className="py-2 text-right">-{(payment.amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold">
                                                    <td className="py-2 border-t-2">Total Paid</td>
                                                    <td className="py-2 border-t-2 text-right">{totalAmountPaid.toFixed(2)}</td>
                                                </tr>
                                                <tr className="font-bold">
                                                    <td className="py-2">Balance Due</td>
                                                    <td className="py-2 text-right">{balanceDue.toFixed(2)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="text-center mt-12">
                                        <p className="text-xs text-gray-600">Thank you for choosing HostelHQ!</p>
                                        <p className="text-xs text-gray-600">For any queries, please contact us.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <p className="text-xs text-muted-foreground">
                                This is an electronically generated invoice and may not require a signature.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
