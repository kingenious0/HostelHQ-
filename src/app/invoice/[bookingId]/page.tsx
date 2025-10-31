"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
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
      level?: string;
      ghanaCardNumber?: string;
    };
    hostelId: string;
    bookingDate: any; // Can be Timestamp or string
    status: string;
    roomTypeId?: string;
    paymentDeadline?: { seconds: number; nanoseconds: number; };
    paymentReference?: string;
    amountPaid?: number;
    bookingType?: string; // 'secure' or 'visit'
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
                const bookingDataRaw = bookingSnap.data();
                const bookingData = { 
                    id: bookingSnap.id, 
                    ...bookingDataRaw,
                    // Ensure studentDetails has all fields
                    studentDetails: {
                        fullName: bookingDataRaw.studentDetails?.fullName || '',
                        email: bookingDataRaw.studentDetails?.email || '',
                        phoneNumber: bookingDataRaw.studentDetails?.phoneNumber || '',
                        indexNumber: bookingDataRaw.studentDetails?.indexNumber || '',
                        program: bookingDataRaw.studentDetails?.program || bookingDataRaw.studentDetails?.departmentName || '',
                        level: bookingDataRaw.studentDetails?.level || '',
                        ghanaCardNumber: bookingDataRaw.studentDetails?.ghanaCardNumber || '',
                    },
                    amountPaid: bookingDataRaw.amountPaid || 0,
                    paymentReference: bookingDataRaw.paymentReference || '',
                    // Determine booking type: secure if has roomTypeId and amountPaid, otherwise visit
                    bookingType: bookingDataRaw.roomTypeId && bookingDataRaw.amountPaid ? 'secure' : 'visit',
                } as Booking;
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

    // Determine if this is a secure booking (has room and amount) or visit booking
    const isSecureBooking = booking.bookingType === 'secure' || (booking.roomTypeId && booking.amountPaid && booking.amountPaid > 0);
    
    // Calculate total amount paid - use amountPaid from booking first, then sum payments
    const totalAmountPaid = booking.amountPaid || payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Find the room type associated with the booking
    const roomTypes = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
    const bookedRoom = booking.roomTypeId ? roomTypes.find(rt => rt.id === booking.roomTypeId) : null;
    const roomPrice = bookedRoom && typeof bookedRoom.price === 'number' ? bookedRoom.price : (booking.amountPaid || 0);
    const balanceDue = isSecureBooking ? roomPrice - totalAmountPaid : 0;
    
    // Format booking date properly
    const formatBookingDate = () => {
        if (!booking.bookingDate) return 'N/A';
        if (booking.bookingDate instanceof Timestamp) {
            return booking.bookingDate.toDate().toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (booking.bookingDate.seconds) {
            return new Date(booking.bookingDate.seconds * 1000).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        try {
            return new Date(booking.bookingDate).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return 'N/A';
        }
    };

    // Generate professional invoice ID: INV-{first 3 letters capitalized}{last 3 digits}
    const generateInvoiceId = () => {
        if (!booking || !booking.studentDetails) {
            return `INV-Xxx000`;
        }

        const fullName = booking.studentDetails.fullName || '';
        const phoneNumber = booking.studentDetails.phoneNumber || '';

        // Extract first 3 letters of name (remove spaces, capitalize first letter)
        const nameNoSpaces = fullName.replace(/\s+/g, ''); // Remove all spaces
        const namePart = nameNoSpaces.length >= 3
            ? nameNoSpaces.substring(0, 3).charAt(0).toUpperCase() + nameNoSpaces.substring(1, 3).toLowerCase()
            : (nameNoSpaces.charAt(0).toUpperCase() + nameNoSpaces.substring(1).toLowerCase()).padEnd(3, 'x');

        // Extract last 3 digits of phone (remove all non-digits first)
        const digitsOnly = phoneNumber.replace(/\D/g, ''); // Remove all non-digit characters
        const phonePart = digitsOnly.length >= 3 
            ? digitsOnly.slice(-3) // Last 3 digits
            : digitsOnly.padStart(3, '0'); // Pad with zeros if less than 3 digits

        return `INV-${namePart}${phonePart}`;
    };

    const customInvoiceId = generateInvoiceId();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-gray-50/50 py-12 px-4">
                <div className="container mx-auto max-w-4xl">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-headline">
                                        {isSecureBooking ? 'Hostel Securing Invoice' : 'Visit Booking Invoice'} #{customInvoiceId}
                                    </CardTitle>
                                    <CardDescription>
                                        {isSecureBooking ? 'Invoice for secured hostel room' : 'Invoice for hostel visit booking'} • Generated on {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })}.
                                    </CardDescription>
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
                                <div className="relative z-10">
                                    <div className="text-center mb-6 pb-4 border-b-2">
                                        <h1 className="text-2xl font-bold mb-2">INVOICE</h1>
                                        <p className="text-sm text-gray-600">Invoice #{customInvoiceId}</p>
                                        <p className="text-sm text-gray-600">Date: {formatBookingDate()}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div>
                                            <p className="font-semibold text-base mb-2">Invoice To:</p>
                                            <p className="font-medium">{booking.studentDetails.fullName}</p>
                                            <p className="text-sm">{booking.studentDetails.email}</p>
                                            {booking.studentDetails.phoneNumber && <p className="text-sm">{booking.studentDetails.phoneNumber}</p>}
                                            {booking.studentDetails.indexNumber && <p className="text-xs text-gray-600 mt-2">Index: {booking.studentDetails.indexNumber}</p>}
                                            {booking.studentDetails.ghanaCardNumber && <p className="text-xs text-gray-600">Ghana Card: {booking.studentDetails.ghanaCardNumber}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-base mb-2">From:</p>
                                            <p className="font-medium">HostelHQ</p>
                                            <p className="text-sm">Your Accommodation Solution</p>
                                            <p className="text-sm">Ghana</p>
                                            <p className="text-xs text-gray-600 mt-2">Email: support@hostelhq.com</p>
                                        </div>
                                    </div>

                                    {isSecureBooking && (
                                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                            <h3 className="font-bold text-base mb-3">Student Details</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-gray-600">Full Name:</span>
                                                    <span className="ml-2 font-semibold">{booking.studentDetails.fullName}</span>
                                                </div>
                                                {booking.studentDetails.indexNumber && (
                                                    <div>
                                                        <span className="text-gray-600">Index Number:</span>
                                                        <span className="ml-2 font-semibold">{booking.studentDetails.indexNumber}</span>
                                                    </div>
                                                )}
                                                {booking.studentDetails.program && (
                                                    <div>
                                                        <span className="text-gray-600">Department:</span>
                                                        <span className="ml-2 font-semibold">{booking.studentDetails.program}</span>
                                                    </div>
                                                )}
                                                {booking.studentDetails.level && (
                                                    <div>
                                                        <span className="text-gray-600">Level:</span>
                                                        <span className="ml-2 font-semibold">{booking.studentDetails.level}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-gray-600">Email:</span>
                                                    <span className="ml-2 font-semibold">{booking.studentDetails.email}</span>
                                                </div>
                                                {booking.studentDetails.phoneNumber && (
                                                    <div>
                                                        <span className="text-gray-600">Phone:</span>
                                                        <span className="ml-2 font-semibold">{booking.studentDetails.phoneNumber}</span>
                                                    </div>
                                                )}
                                                {booking.studentDetails.ghanaCardNumber && (
                                                    <div className="col-span-2">
                                                        <span className="text-gray-600">Ghana Card:</span>
                                                        <span className="ml-2 font-semibold">{booking.studentDetails.ghanaCardNumber}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                        <h3 className="font-bold text-base mb-3">Booking Details</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-600">Hostel:</span>
                                                <span className="ml-2 font-semibold">{hostel.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Location:</span>
                                                <span className="ml-2 font-semibold">{hostel.location}</span>
                                            </div>
                                            {isSecureBooking && bookedRoom && (
                                                <div>
                                                    <span className="text-gray-600">Room Type:</span>
                                                    <span className="ml-2 font-semibold">{bookedRoom.name}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-600">Booking Date:</span>
                                                <span className="ml-2 font-semibold">{formatBookingDate()}</span>
                                            </div>
                                            {booking.paymentReference && (
                                                <div className="col-span-2">
                                                    <span className="text-gray-600">Payment Reference:</span>
                                                    <span className="ml-2 font-semibold font-mono text-xs">{booking.paymentReference}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <h3 className="font-bold text-base mb-3">Payment Summary</h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border border-gray-300 py-3 px-4 text-left font-bold">Description</th>
                                                    <th className="border border-gray-300 py-3 px-4 text-right font-bold">Amount (GH₵)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {isSecureBooking ? (
                                                    <>
                                                        <tr>
                                                            <td className="border border-gray-300 py-3 px-4">
                                                                <div>
                                                                    <p className="font-semibold">Room Rent - {bookedRoom?.name || 'Standard Room'}</p>
                                                                    <p className="text-xs text-gray-600">Academic Year {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                                                                </div>
                                                            </td>
                                                            <td className="border border-gray-300 py-3 px-4 text-right font-semibold">
                                                                GH₵ {roomPrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                        {payments.map(payment => {
                                                            // Payment amount might be in pesewas (cents) or cedis, normalize to cedis
                                                            const paymentAmount = payment.amount > 1000 ? payment.amount / 100 : payment.amount;
                                                            return (
                                                                <tr key={payment.id}>
                                                                    <td className="border border-gray-300 py-2 px-4 text-sm">
                                                                        Payment ({payment.type}) - {payment.paymentDate?.seconds 
                                                                            ? new Date(payment.paymentDate.seconds * 1000).toLocaleDateString('en-GH')
                                                                            : payment.paymentDate instanceof Timestamp
                                                                            ? payment.paymentDate.toDate().toLocaleDateString('en-GH')
                                                                            : 'N/A'}
                                                                    </td>
                                                                    <td className="border border-gray-300 py-2 px-4 text-right text-sm text-green-600">
                                                                        -GH₵ {paymentAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="bg-gray-50">
                                                            <td className="border border-gray-300 py-3 px-4 font-bold">Total Amount Paid</td>
                                                            <td className="border border-gray-300 py-3 px-4 text-right font-bold text-lg">
                                                                GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                        {balanceDue > 0 && (
                                                            <tr>
                                                                <td className="border border-gray-300 py-2 px-4 font-semibold">Balance Due</td>
                                                                <td className="border border-gray-300 py-2 px-4 text-right font-semibold text-red-600">
                                                                    GH₵ {balanceDue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <tr>
                                                            <td className="border border-gray-300 py-3 px-4">
                                                                <p className="font-semibold">Hostel Visit Booking Fee</p>
                                                            </td>
                                                            <td className="border border-gray-300 py-3 px-4 text-right font-semibold">
                                                                GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                        <tr className="bg-gray-50">
                                                            <td className="border border-gray-300 py-3 px-4 font-bold">Total Paid</td>
                                                            <td className="border border-gray-300 py-3 px-4 text-right font-bold text-lg">
                                                                GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {isSecureBooking && (
                                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <p className="font-semibold text-green-900">Payment Status: Paid</p>
                                            </div>
                                            <p className="text-sm text-green-700 mt-1">Your payment has been successfully processed.</p>
                                        </div>
                                    )}

                                    <div className="text-center mt-12">
                                        <p className="text-xs text-gray-600">Thank you for choosing HostelHQ!</p>
                                        <p className="text-xs text-gray-600">For any queries, please contact us.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            {isSecureBooking && (
                                <Button 
                                    onClick={() => router.push(`/agreement/${booking.id}`)} 
                                    className="w-full"
                                    size="lg"
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    View Tenancy Agreement
                                </Button>
                            )}
                            <p className="text-xs text-muted-foreground text-center">
                                This is an electronically generated invoice and may not require a signature.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
