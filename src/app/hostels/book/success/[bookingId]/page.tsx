"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Hostel, RoomType } from '@/lib/data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Booking = {
    id: string;
    studentId: string;
    studentDetails: {
        fullName: string;
        indexNumber?: string;
        phoneNumber?: string;
        email: string;
        program?: string;
        level?: string;
        ghanaCardNumber?: string;
    };
    hostelId: string;
    bookingDate: any;
    status: string;
    roomTypeId?: string;
    paymentReference?: string;
    amountPaid?: number;
};

export default function PaymentSuccessPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { bookingId } = params;

    const [booking, setBooking] = useState<Booking | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
    const [invoiceGenerated, setInvoiceGenerated] = useState(false);
    
    const invoiceRef = useRef<HTMLDivElement>(null);

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

                // Store invoice data in booking document if not already stored
                if (!bookingSnap.data().invoiceGenerated) {
                    await updateDoc(bookingRef, {
                        invoiceGenerated: true,
                        invoiceGeneratedAt: serverTimestamp(),
                    });
                }
                setInvoiceGenerated(true);

            } catch (error: any) {
                console.error("Failed to fetch success page data:", error);
                toast({ title: "Failed to load", description: error.message, variant: "destructive" });
                router.push('/my-bookings');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [bookingId, router, toast]);

    const handleDownloadInvoice = async () => {
        if (!invoiceRef.current) return;
        setIsDownloadingInvoice(true);
        toast({ title: "Generating Invoice PDF..." });

        try {
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2,
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

            const fileName = `invoice-${hostel?.name?.replace(/\s/g, '-')}-${bookingId?.substring(0, 8)}.pdf`;
            pdf.save(fileName);
            toast({ title: "Download started", description: "Your invoice PDF is being downloaded." });

        } catch (error) {
            console.error(error);
            toast({ title: "Download Failed", description: "Could not generate the invoice PDF.", variant: "destructive" });
        } finally {
            setIsDownloadingInvoice(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-4">
                        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading your payment confirmation...</p>
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
                    <p className="text-destructive">Failed to load booking details.</p>
                </main>
            </div>
        );
    }

    // Find the room type
    const roomTypes = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
    const bookedRoom = roomTypes.find(rt => rt.id === booking.roomTypeId) || roomTypes[0] || null;
    const roomPrice = bookedRoom && typeof bookedRoom.price === 'number' ? bookedRoom.price : booking.amountPaid || 0;
    const bookingDate = booking.bookingDate?.seconds 
        ? new Date(booking.bookingDate.seconds * 1000) 
        : new Date();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 py-12 px-4">
                <div className="container mx-auto max-w-4xl space-y-6">
                    {/* Success Message */}
                    <Card className="border-green-200 bg-green-50/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                                <div>
                                    <h2 className="text-2xl font-bold font-headline text-green-900">Payment Successful!</h2>
                                    <p className="text-green-700 mt-1">Your room has been secured. Your invoice and tenancy agreement are ready.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Invoice Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-headline">Invoice</CardTitle>
                                    <CardDescription>Payment confirmation for your booking at {hostel.name}</CardDescription>
                                </div>
                                <Button onClick={handleDownloadInvoice} disabled={isDownloadingInvoice} variant="outline">
                                    {isDownloadingInvoice ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-4 w-4"/>
                                            Download Invoice
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div ref={invoiceRef} className="p-8 border rounded-lg bg-white shadow-sm text-sm text-gray-800 relative overflow-hidden">
                                {/* Watermark */}
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
                                
                                <div className="relative z-10">
                                    {/* Header */}
                                    <div className="text-center mb-8 pb-4 border-b-2">
                                        <h1 className="text-3xl font-bold mb-2">INVOICE</h1>
                                        <p className="text-sm text-gray-600">Invoice #INV-{bookingId?.substring(0, 8).toUpperCase()}</p>
                                        <p className="text-sm text-gray-600">Date: {bookingDate.toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>

                                    {/* Bill To / From */}
                                    <div className="grid grid-cols-2 gap-8 mb-8">
                                        <div>
                                            <h3 className="font-bold text-base mb-2 text-gray-900">Bill To:</h3>
                                            <p className="font-semibold">{booking.studentDetails.fullName}</p>
                                            <p className="text-sm">{booking.studentDetails.email}</p>
                                            {booking.studentDetails.phoneNumber && (
                                                <p className="text-sm">{booking.studentDetails.phoneNumber}</p>
                                            )}
                                            {booking.studentDetails.indexNumber && (
                                                <p className="text-xs text-gray-600 mt-2">Index: {booking.studentDetails.indexNumber}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <h3 className="font-bold text-base mb-2 text-gray-900">From:</h3>
                                            <p className="font-semibold">HostelHQ</p>
                                            <p className="text-sm">Your Accommodation Solution</p>
                                            <p className="text-sm">Ghana</p>
                                            <p className="text-xs text-gray-600 mt-2">Email: support@hostelhq.com</p>
                                        </div>
                                    </div>

                                    {/* Booking Details */}
                                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                        <h3 className="font-bold text-base mb-3 text-gray-900">Booking Details</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-600">Hostel:</span>
                                                <span className="ml-2 font-semibold">{hostel.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Location:</span>
                                                <span className="ml-2 font-semibold">{hostel.location}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Room Type:</span>
                                                <span className="ml-2 font-semibold">{bookedRoom?.name || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Payment Reference:</span>
                                                <span className="ml-2 font-semibold">{booking.paymentReference || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoice Table */}
                                    <div className="mb-6">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border border-gray-300 py-3 px-4 text-left font-bold">Description</th>
                                                    <th className="border border-gray-300 py-3 px-4 text-right font-bold">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="border border-gray-300 py-3 px-4">
                                                        <div>
                                                            <p className="font-semibold">Room Rent - {bookedRoom?.name || 'N/A'}</p>
                                                            <p className="text-xs text-gray-600">Academic Year {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-300 py-3 px-4 text-right font-semibold">
                                                        GH₵ {roomPrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                                <tr className="bg-gray-50">
                                                    <td className="border border-gray-300 py-3 px-4 font-bold">Total Amount Paid</td>
                                                    <td className="border border-gray-300 py-3 px-4 text-right font-bold text-lg">
                                                        GH₵ {roomPrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Payment Status */}
                                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <p className="font-semibold text-green-900">Payment Status: Paid</p>
                                        </div>
                                        <p className="text-sm text-green-700 mt-1">Your payment has been successfully processed.</p>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center mt-8 pt-4 border-t">
                                        <p className="text-xs text-gray-600">Thank you for choosing HostelHQ!</p>
                                        <p className="text-xs text-gray-600 mt-1">This is an electronically generated invoice and may not require a signature.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <Button 
                                    onClick={() => router.push(`/agreement/${bookingId}`)} 
                                    size="lg"
                                    className="flex-1"
                                >
                                    <FileText className="mr-2 h-5 w-5"/>
                                    View Tenancy Agreement
                                </Button>
                                <Button 
                                    onClick={() => router.push(`/invoice/${bookingId}`)} 
                                    size="lg"
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <Download className="mr-2 h-5 w-5"/>
                                    View Full Invoice
                                </Button>
                            </div>
                            <Button 
                                onClick={() => router.push('/my-bookings')} 
                                variant="secondary"
                                className="w-full"
                            >
                                Go to My Bookings
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}

