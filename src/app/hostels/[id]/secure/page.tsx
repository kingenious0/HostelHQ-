
"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2, FileText, Receipt } from "lucide-react"
import { getHostel, Hostel, RoomType } from "@/lib/data"
import { notFound } from 'next/navigation';
import { initializeHostelPayment } from "@/app/actions/paystack"
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'

const formSchema = z.object({
  studentName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  indexNumber: z.string().min(5, { message: "Index number is required." }),
  ghanaCardNumber: z.string().regex(/^(GHA-)?\d{9}-\d$/, { message: "Invalid Ghana Card number. Format: GHA-XXXXXXXXX-X" }),
  departmentName: z.string().min(3, { message: "Department is required." }),
  level: z.enum(["100", "200", "300", "400"]),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,13}$/, { message: "Invalid phone number." }),
  email: z.string().email({ message: "Invalid email address." }),
})


export default function SecureHostelPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const hostelId = params.id as string;
    const roomTypeId = searchParams.get('roomTypeId');

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostel, setHostel] = React.useState<Hostel | null>(null);
    const [selectedRoom, setSelectedRoom] = React.useState<RoomType | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [existingBooking, setExistingBooking] = React.useState<{ id: string } | null | undefined>(undefined);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
            if (!user || typeof hostelId !== 'string') {
                setExistingBooking(null);
                return;
            }

            // Check if user already has a confirmed booking for this hostel
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('studentId', '==', user.uid),
                where('hostelId', '==', hostelId),
                where('status', '==', 'confirmed')
            );

            const bookingSnapshot = await getDocs(bookingsQuery);
            if (!bookingSnapshot.empty) {
                const booking = bookingSnapshot.docs[0];
                setExistingBooking({ id: booking.id });
            } else {
                setExistingBooking(null);
            }
        });

        return () => unsubscribe();
    }, [hostelId]);

     React.useEffect(() => {
        const fetchHostelData = async () => {
            setLoading(true);
            if(typeof hostelId !== 'string') return;
            const hostelData = await getHostel(hostelId);
            if (!hostelData) {
                notFound();
                return;
            }
            setHostel(hostelData);
            
            const targetRoomId = roomTypeId || hostelData.roomTypes[0]?.id;
            if (targetRoomId && hostelData.roomTypes.length > 0) {
                const room = hostelData.roomTypes.find(rt => rt.id === targetRoomId);
                if (room) {
                    setSelectedRoom(room);
                } else {
                    // Fallback to first room if specified room not found
                    console.warn(`Room type ${targetRoomId} not found, using first available room`);
                    setSelectedRoom(hostelData.roomTypes[0]);
                }
            } else if (hostelData.roomTypes.length > 0) {
                // If no roomTypeId specified, use first room
                setSelectedRoom(hostelData.roomTypes[0]);
            } else {
                console.error('No room types available for this hostel');
                setSelectedRoom(null);
            }
            setLoading(false);
        };
        if(hostelId) {
            fetchHostelData();
        }
    }, [hostelId, roomTypeId]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: 'onChange', // Enable real-time validation
        defaultValues: {
            studentName: "",
            indexNumber: "",
            ghanaCardNumber: "",
            departmentName: "",
            phoneNumber: "",
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!hostel || !selectedRoom || typeof hostelId !== 'string') return;
        
        setIsSubmitting(true);
        toast({ title: "Initializing Payment..." });

        try {
            // Store form data in sessionStorage to retrieve after payment confirmation
            sessionStorage.setItem('pendingBookingData', JSON.stringify({
                studentName: values.studentName,
                indexNumber: values.indexNumber,
                ghanaCardNumber: values.ghanaCardNumber,
                departmentName: values.departmentName,
                level: values.level,
                phoneNumber: values.phoneNumber,
                email: values.email,
                roomTypeId: selectedRoom.id,
                roomTypeName: selectedRoom.name,
                roomPrice: selectedRoom.price,
            }));

            const result = await initializeHostelPayment({
                email: values.email,
                amount: selectedRoom.price * 100, // Amount in pesewas
                hostelName: hostel.name,
                studentName: values.studentName,
                hostelId: hostelId,
            });

            if (result.status && result.authorization_url) {
                toast({ title: "Redirecting to Payment", description: "Your payment page will open in a new tab."});
                window.location.href = result.authorization_url; // Use location.href instead of window.open
            } else {
                throw new Error(result.message || "Failed to initialize payment.");
            }

        } catch (error: any) {
             toast({ title: "Payment Error", description: error.message || "Could not connect to payment service.", variant: "destructive" });
             setIsSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </main>
            </div>
        )
    }

    // Check if hostel is already secured
    if (existingBooking !== undefined && existingBooking !== null) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                    <Card className="w-full max-w-lg shadow-xl border-green-200">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                                <CardTitle className="text-2xl font-headline text-green-900">Hostel Secured!</CardTitle>
                            </div>
                            <CardDescription className="text-base">
                                This hostel has been successfully secured. Your payment has been processed and your booking is confirmed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-800 font-medium">
                                    You can view your invoice and tenancy agreement below, or access them anytime from your bookings page.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <Button 
                                    onClick={() => router.push(`/invoice/${existingBooking.id}`)} 
                                    className="flex-1"
                                    variant="outline"
                                >
                                    <Receipt className="mr-2 h-4 w-4"/>
                                    View Invoice
                                </Button>
                                <Button 
                                    onClick={() => router.push(`/agreement/${existingBooking.id}`)} 
                                    className="flex-1"
                                    variant="outline"
                                >
                                    <FileText className="mr-2 h-4 w-4"/>
                                    View Agreement
                                </Button>
                            </div>
                            <Button 
                                onClick={() => router.push('/my-bookings')} 
                                className="w-full"
                            >
                                Go to My Bookings
                            </Button>
                        </CardFooter>
                    </Card>
                </main>
            </div>
        );
    }

    if (!selectedRoom) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                    <Card className="w-full max-w-lg shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline text-destructive">Room Not Available</CardTitle>
                            <CardDescription>
                                No room type is available for this hostel. Please contact support or try selecting a different hostel.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </main>
            </div>
        )
    }

  return (
    <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Secure Your Room: {selectedRoom?.name}</CardTitle>
                    <CardDescription>
                        Complete this form to pay for the <span className="font-semibold">{selectedRoom?.name}</span> room at <span className="font-semibold">{hostel?.name}</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="studentName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="indexNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Index Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your university index number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="ghanaCardNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Ghana Card Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="GHA-XXXXXXXXX-X" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="departmentName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Computer Science" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="level"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Level</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your current level" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="100">Level 100</SelectItem>
                                                <SelectItem value="200">Level 200</SelectItem>
                                                <SelectItem value="300">Level 300</SelectItem>
                                                <SelectItem value="400">Level 400</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                             <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Payment Phone Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="+233 XX XXX XXXX" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        This can be any number for the transaction.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="you@example.com" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your payment receipt will be sent here.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <CardFooter className="px-0 pt-6">
                                <Button 
                                    type="submit" 
                                    className="w-full" 
                                    disabled={isSubmitting || !selectedRoom}
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Proceed to Pay GH₵{selectedRoom?.price?.toLocaleString() || 'N/A'}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </main>
    </div>
  )
}
