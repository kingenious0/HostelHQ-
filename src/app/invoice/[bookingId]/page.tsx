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
                // Try to fetch from bookings first (secured bookings)
                let bookingRef = doc(db, 'bookings', bookingId as string);
                let bookingSnap = await getDoc(bookingRef);
                let isVisit = false;
                
                // If not found in bookings, try visits collection
                if (!bookingSnap.exists()) {
                    bookingRef = doc(db, 'visits', bookingId as string);
                    bookingSnap = await getDoc(bookingRef);
                    isVisit = true;
                    if (!bookingSnap.exists()) throw new Error("Booking or visit not found.");
                }
                
                const bookingDataRaw = bookingSnap.data();
                
                // For visits, fetch student details from users collection if not present
                let studentDetails = bookingDataRaw.studentDetails || {};
                if (isVisit && bookingDataRaw.studentId) {
                    try {
                        const studentRef = doc(db, 'users', bookingDataRaw.studentId);
                        const studentSnap = await getDoc(studentRef);
                        if (studentSnap.exists()) {
                            const studentData = studentSnap.data();
                            studentDetails = {
                                fullName: studentData.fullName || '',
                                email: studentData.email || '',
                                phoneNumber: studentData.phoneNumber || studentData.phone || '',
                                indexNumber: studentData.indexNumber || '',
                                program: studentData.program || studentData.departmentName || '',
                                level: studentData.level || '',
                                ghanaCardNumber: studentData.ghanaCardNumber || '',
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching student details:', error);
                    }
                }
                
                const bookingData = { 
                    id: bookingSnap.id, 
                    ...bookingDataRaw,
                    // Ensure studentDetails has all fields
                    studentDetails: {
                        fullName: studentDetails.fullName || bookingDataRaw.studentDetails?.fullName || '',
                        email: studentDetails.email || bookingDataRaw.studentDetails?.email || '',
                        phoneNumber: studentDetails.phoneNumber || bookingDataRaw.studentDetails?.phoneNumber || '',
                        indexNumber: studentDetails.indexNumber || bookingDataRaw.studentDetails?.indexNumber || '',
                        program: studentDetails.program || bookingDataRaw.studentDetails?.program || bookingDataRaw.studentDetails?.departmentName || '',
                        level: studentDetails.level || bookingDataRaw.studentDetails?.level || '',
                        ghanaCardNumber: studentDetails.ghanaCardNumber || bookingDataRaw.studentDetails?.ghanaCardNumber || '',
                    },
                    amountPaid: bookingDataRaw.amountPaid || (isVisit ? 12 : 0), // Default visit fee is 12 GHS
                    paymentReference: bookingDataRaw.paymentReference || '',
                    // Determine booking type: visit if from visits collection, otherwise secure
                    bookingType: isVisit ? 'visit' : (bookingDataRaw.roomTypeId && bookingDataRaw.amountPaid ? 'secure' : 'visit'),
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
                const fetchedPayments = paymentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Payment[];
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

    // Simple print function - browser handles PDF generation
    const handleDownload = () => {
        setIsDownloading(true);
        toast({ title: "Opening print dialog..." });

        try {
            // Use browser's native print dialog
            window.print();
        } finally {
            // Small delay so spinner doesn't get stuck if print dialog stays open
            setTimeout(() => setIsDownloading(false), 1000);
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
            <main className="flex-1 bg-gray-50/50 py-6 sm:py-12 px-3 sm:px-4">
                <div className="container mx-auto max-w-4xl">
                    <Card>
                        <CardHeader className="pb-4 sm:pb-6">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                <div className="flex-1">
                                    <CardTitle className="text-xl sm:text-2xl font-headline leading-tight">
                                        {isSecureBooking ? 'Hostel Securing Invoice' : 'Visit Booking Invoice'} #{customInvoiceId}
                                    </CardTitle>
                                    <CardDescription className="text-sm sm:text-base mt-1">
                                        {isSecureBooking ? 'Invoice for secured hostel room' : 'Invoice for hostel visit booking'} • Generated on {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })}.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                                    <BackButton fallbackHref="/my-bookings" />
                                    <Button onClick={handleDownload} disabled={isDownloading} size="sm" className="w-full sm:w-auto">
                                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                        Print/Save PDF
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6">
                            <div 
                            ref={printRef} 
                            id="invoice-print" 
                            className="bg-white shadow-xl rounded-lg overflow-hidden" 
                            style={{ 
                                minHeight: '842px',
                                width: '100%',
                                maxWidth: '210mm',
                                margin: '0 auto'
                            }}
                        >
                                {/* Header Section */}
                                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 sm:p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h1 className="text-2xl sm:text-3xl font-bold mb-2">INVOICE</h1>
                                            <p className="text-blue-100 text-sm sm:text-base">#{customInvoiceId}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                                                <p className="text-xs sm:text-sm text-blue-100">Date</p>
                                                <p className="font-semibold">{formatBookingDate()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Company & Customer Info */}
                                <div className="p-6 sm:p-8 border-b">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* From */}
                                        <div>
                                            <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">From</h2>
                                            <div className="space-y-1">
                                                <p className="font-bold text-lg sm:text-xl text-gray-900">HostelHQ</p>
                                                <p className="text-sm sm:text-base text-gray-600">Your Accommodation Solution</p>
                                                <p className="text-sm sm:text-base text-gray-600">Ghana</p>
                                                <p className="text-sm text-gray-500">hostelhqghana@gmail.com</p>
                                            </div>
                                        </div>

                                        {/* Bill To */}
                                        <div>
                                            <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Bill To</h2>
                                            <div className="space-y-1">
                                                <p className="font-bold text-lg sm:text-xl text-gray-900">{booking.studentDetails.fullName}</p>
                                                <p className="text-sm sm:text-base text-gray-600">{booking.studentDetails.email}</p>
                                                {booking.studentDetails.phoneNumber && <p className="text-sm sm:text-base text-gray-600">{booking.studentDetails.phoneNumber}</p>}
                                                {booking.studentDetails.indexNumber && <p className="text-sm text-gray-500">Index: {booking.studentDetails.indexNumber}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Student & Booking Details */}
                                <div className="p-6 sm:p-8 space-y-6">
                                    {/* Student Details */}
                                    {isSecureBooking && (
                                        <div className="bg-gray-50 rounded-xl p-6">
                                            <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center">
                                                <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                                                Student Information
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Full Name</p>
                                                    <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.fullName}</p>
                                                </div>
                                                {booking.studentDetails.indexNumber && (
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Index Number</p>
                                                        <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.indexNumber}</p>
                                                    </div>
                                                )}
                                                {booking.studentDetails.program && (
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Department</p>
                                                        <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.program}</p>
                                                    </div>
                                                )}
                                                {booking.studentDetails.level && (
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Level</p>
                                                        <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.level}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Email</p>
                                                    <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.email}</p>
                                                </div>
                                                {booking.studentDetails.phoneNumber && (
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Phone</p>
                                                        <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.phoneNumber}</p>
                                                    </div>
                                                )}
                                                {booking.studentDetails.ghanaCardNumber && (
                                                    <div className="sm:col-span-2 lg:col-span-3">
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Ghana Card</p>
                                                        <p className="font-semibold text-sm sm:text-base">{booking.studentDetails.ghanaCardNumber}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Booking Details */}
                                    <div className="bg-gray-50 rounded-xl p-6">
                                        <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                                            Booking Information
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs sm:text-sm text-gray-500 mb-1">Hostel</p>
                                                <p className="font-semibold text-sm sm:text-base">{hostel.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs sm:text-sm text-gray-500 mb-1">Location</p>
                                                <p className="font-semibold text-sm sm:text-base">{hostel.location}</p>
                                            </div>
                                            {isSecureBooking && bookedRoom && (
                                                <div>
                                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Room Type</p>
                                                    <p className="font-semibold text-sm sm:text-base">{bookedRoom.name}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs sm:text-sm text-gray-500 mb-1">Booking Date</p>
                                                <p className="font-semibold text-sm sm:text-base">{formatBookingDate()}</p>
                                            </div>
                                            {booking.paymentReference && (
                                                <div className="sm:col-span-2 lg:col-span-3">
                                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Payment Reference</p>
                                                    <p className="font-semibold text-sm sm:text-base font-mono bg-white px-3 py-1 rounded border">{booking.paymentReference}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Summary */}
                                <div className="p-6 sm:p-8">
                                    <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                                        Payment Summary
                                    </h3>
                                    
                                    <div className="bg-white border rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="text-left py-4 px-6 font-semibold text-sm sm:text-base text-gray-900">Description</th>
                                                    <th className="text-right py-4 px-6 font-semibold text-sm sm:text-base text-gray-900">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {isSecureBooking ? (
                                                    <>
                                                        <tr>
                                                            <td className="py-4 px-6">
                                                                <div>
                                                                    <p className="font-semibold text-sm sm:text-base">Room Rent - {bookedRoom?.name || 'Standard Room'}</p>
                                                                    <p className="text-xs text-gray-500 mt-1">Academic Year {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <p className="font-semibold text-sm sm:text-base">GH₵ {roomPrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                            </td>
                                                        </tr>
                                                        {payments.map(payment => {
                                                            const paymentAmount = payment.amount > 1000 ? payment.amount / 100 : payment.amount;
                                                            return (
                                                                <tr key={payment.id} className="bg-green-50">
                                                                    <td className="py-3 px-6">
                                                                        <div>
                                                                            <p className="font-medium text-sm sm:text-base text-green-800">Payment Received</p>
                                                                            <p className="text-xs text-green-600">{payment.type} • {payment.paymentDate?.seconds 
                                                                                ? new Date(payment.paymentDate.seconds * 1000).toLocaleDateString('en-GH')
                                                                                : (payment.paymentDate as any)?.toDate?.()
                                                                                ? (payment.paymentDate as any).toDate().toLocaleDateString('en-GH')
                                                                                : 'N/A'}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-6 text-right">
                                                                        <p className="font-semibold text-sm sm:text-base text-green-700">-GH₵ {paymentAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="bg-gray-50">
                                                            <td className="py-4 px-6">
                                                                <p className="font-bold text-sm sm:text-base">Total Amount Paid</p>
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <p className="font-bold text-lg sm:text-xl text-green-600">GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                            </td>
                                                        </tr>
                                                        {balanceDue > 0 && (
                                                            <tr className="bg-red-50">
                                                                <td className="py-3 px-6">
                                                                    <p className="font-semibold text-sm sm:text-base text-red-800">Balance Due</p>
                                                                </td>
                                                                <td className="py-3 px-6 text-right">
                                                                    <p className="font-bold text-sm sm:text-base text-red-600">GH₵ {balanceDue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <tr>
                                                            <td className="py-4 px-6">
                                                                <p className="font-semibold text-sm sm:text-base">Hostel Visit Booking Fee</p>
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <p className="font-semibold text-sm sm:text-base">GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                            </td>
                                                        </tr>
                                                        <tr className="bg-gray-50">
                                                            <td className="py-4 px-6">
                                                                <p className="font-bold text-sm sm:text-base">Total Paid</p>
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <p className="font-bold text-lg sm:text-xl text-green-600">GH₵ {totalAmountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                            </td>
                                                        </tr>
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Status & Footer */}
                                <div className="p-6 sm:p-8 space-y-6">
                                    {isSecureBooking && (
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-green-100 rounded-full p-2">
                                                    <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-green-900 text-lg">Payment Status: Paid</p>
                                                    <p className="text-green-700">Your payment has been successfully processed and booking confirmed.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-center border-t pt-6">
                                        <p className="text-gray-600 font-medium mb-2">Thank you for choosing HostelHQ!</p>
                                        <p className="text-sm text-gray-500">For any queries, contact us at hostelhqghana@gmail.com</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 p-4 sm:p-6">
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
