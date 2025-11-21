
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
import { Loader2, CheckCircle2, FileText, Receipt, BedDouble, ShieldCheck } from "lucide-react"
import { getHostel, Hostel, RoomType } from "@/lib/data"
import { notFound } from 'next/navigation';
import { initializeHostelPayment } from "@/app/actions/paystack"
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
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
  guardianName: z.string().min(2, { message: "Guardian name must be at least 2 characters." }),
  guardianRelationship: z.string().min(3, { message: "Relationship is required." }),
  guardianPhoneNumber: z.string().regex(/^\+?[0-9]{10,13}$/, { message: "Invalid guardian phone number." }),
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
    const [aiQuestion, setAiQuestion] = React.useState("");
    const [aiAnswer, setAiAnswer] = React.useState<string | null>(null);
    const [aiLoading, setAiLoading] = React.useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: 'onChange', // Enable real-time validation
        defaultValues: {
            studentName: "",
            indexNumber: "",
            ghanaCardNumber: "",
            departmentName: "",
            level: "100",
            phoneNumber: "",
            email: "",
            guardianName: "",
            guardianRelationship: "",
            guardianPhoneNumber: "",
        },
    });

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
            if (!user || typeof hostelId !== 'string') {
                setExistingBooking(null);
                form.reset({
                    studentName: "",
                    indexNumber: "",
                    ghanaCardNumber: "",
                    departmentName: "",
                    level: "100",
                    phoneNumber: "",
                    email: "",
                    guardianName: "",
                    guardianRelationship: "",
                    guardianPhoneNumber: "",
                });
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

    async function handleAskAi(question: string) {
        const trimmed = question.trim();
        if (!trimmed) {
            toast({ title: "Ask a question first", description: "Type or choose a question for the AI helper.", variant: "destructive" });
            return;
        }
        if (!hostel || !selectedRoom) {
            toast({ title: "Room not ready", description: "Please wait for the room details to finish loading.", variant: "destructive" });
            return;
        }

        try {
            setAiLoading(true);
            setAiAnswer(null);
            const res = await fetch('/api/room-ai-helper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: trimmed,
                    hostel: { name: hostel.name, location: hostel.location },
                    room: {
                        name: selectedRoom.name,
                        price: selectedRoom.price,
                        capacity: selectedRoom.capacity,
                        availability: selectedRoom.availability,
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok || !data?.answer) {
                throw new Error(data?.error || 'AI helper could not answer right now.');
            }
            setAiAnswer(data.answer as string);
        } catch (error: any) {
            console.error('AI helper error', error);
            toast({
                title: 'AI helper unavailable',
                description: error.message || 'Please try again in a moment.',
                variant: 'destructive',
            });
        } finally {
            setAiLoading(false);
        }
    }

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
                guardianName: values.guardianName,
                guardianRelationship: values.guardianRelationship,
                guardianPhoneNumber: values.guardianPhoneNumber,
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
        <main className="flex-1 bg-gray-50/50 py-8 md:py-12">
            <div className="mx-auto max-w-6xl px-4 md:px-6 mb-6 md:mb-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-primary/5 via-muted/70 to-background px-6 py-6 md:px-10 md:py-8 border border-primary/20 shadow-sm">
                    <div className="space-y-2 md:space-y-3 text-center md:text-left md:flex-1">
                        <p className="text-xs md:text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border/60">
                                <ShieldCheck className="h-3 w-3 text-primary" />
                            </span>
                            <span>Review &amp; secure your booking</span>
                        </p>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-headline font-semibold tracking-tight text-foreground">
                            Secure Your Room
                        </h1>
                        <div className="flex flex-col items-center md:items-start gap-2">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs md:text-sm">
                                {hostel?.name && (
                                    <span className="font-medium text-foreground">
                                        {hostel.name}
                                    </span>
                                )}
                                {hostel?.location && (
                                    <span className="text-muted-foreground text-[11px] md:text-xs">
                                      {"· "}  {hostel.location}
                                    </span>
                                )}
                                {selectedRoom?.name && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/20 px-3 py-1 text-[11px] md:text-xs text-muted-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                                        <BedDouble className="h-3 w-3 text-primary" />
                                        <span className="font-medium text-foreground">{selectedRoom.name}</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-xs md:text-sm text-muted-foreground max-w-xl">
                                Confirm your student details and complete payment to lock in this room for the upcoming academic year.
                            </p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center text-xs text-muted-foreground">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border/60">
                            <BedDouble className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_0.9fr] md:px-6">
                <Card className="shadow-xl border border-border/40">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Review your details</CardTitle>
                        <CardDescription>
                            Make sure your student and guardian information is accurate before you proceed to pay.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="studentName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Akua Mensah" {...field} />
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
                                                    <Input placeholder="AAMUSTED/xxx/xx" {...field} />
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
                                                    <Input placeholder="Computer Science" {...field} />
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
                                                    We&apos;ll trigger mobile money to this number. Ensure it&apos;s active.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="space-y-4 rounded-xl border border-border/60 bg-muted/40 p-4 mt-2">
                                    <p className="font-semibold text-sm">Parent / Guardian Details</p>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <FormField
                                            control={form.control}
                                            name="guardianName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Guardian Full Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., Kofi Mensah" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="guardianRelationship"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Relationship</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Mother, Father, Guardian" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="guardianPhoneNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Guardian Phone Number</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="+233 XX XXX XXXX" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

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
                                                We&apos;ll send your payment receipt and tenancy agreement here.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm">
                                    <p className="font-semibold text-primary uppercase tracking-[0.2em]">Before you continue</p>
                                    <ul className="mt-2 space-y-2 text-muted-foreground">
                                        <li>• Confirm your details match your student records.</li>
                                        <li>• Mobile money payments are processed instantly.</li>
                                        <li>• Refunds follow our cancellation policy.</li>
                                    </ul>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-12 text-lg"
                                    disabled={isSubmitting || !selectedRoom}
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                    {isSubmitting ? 'Processing...' : `Pay GH₵${selectedRoom?.price?.toLocaleString() || 'N/A'} Securely`}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                <Card className="border border-border/40 bg-background/70 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl font-headline">Room Summary</CardTitle>
                        <CardDescription>
                            Review what&apos;s included before you confirm payment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 text-sm">
                        <div className="rounded-xl border border-muted bg-muted/30 p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Selected Room</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">{selectedRoom?.name}</p>
                            <p className="text-muted-foreground">
                                Annual rent: GH₵{selectedRoom?.price?.toLocaleString()} · Availability: {selectedRoom?.availability}
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                                <span className="text-muted-foreground">Hostel</span>
                                <span className="font-medium text-foreground">{hostel?.name}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                                <span className="text-muted-foreground">Location</span>
                                <span className="font-medium text-foreground">{hostel?.location}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                                <span className="text-muted-foreground">Rating</span>
                                <span className="font-medium text-foreground">{hostel?.rating?.toFixed(1)} / 5</span>
                            </div>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-4 text-sm">
                            <p className="font-semibold text-primary uppercase tracking-[0.2em]">Payment includes</p>
                            <ul className="mt-2 space-y-2 text-muted-foreground">
                                <li>• Room Price</li>
                                <li>• Digital tenancy agreement instantly generated</li>
                                <li>• Access to HostelHQ support for onboarding</li>
                            </ul>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-4 text-muted-foreground">
                            <p className="font-semibold text-foreground">Having issues?</p>
                            <p className="mt-1">Call our support team on <span className="text-primary font-semibold">+233 20 123 4567</span> or email support@hostelhq.africa.</p>
                        </div>
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                            <p className="font-semibold text-primary text-sm">AI Helper (coming alive soon)</p>
                            <p className="text-xs text-muted-foreground">
                                Ask smart questions about this room and hostel. We&apos;ll use the details on this page to give you clear answers.
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <button
                                    type="button"
                                    className="px-2 py-1 rounded-full border text-xs bg-background hover:bg-primary/10"
                                    onClick={() => {
                                        const q = `Is the room "${selectedRoom?.name}" at ${hostel?.name} good for quiet study and focus?`;
                                        setAiQuestion(q);
                                        handleAskAi(q);
                                    }}
                                >
                                    Quiet study suitability
                                </button>
                                <button
                                    type="button"
                                    className="px-2 py-1 rounded-full border text-xs bg-background hover:bg-primary/10"
                                    onClick={() => {
                                        const q = `What are the main pros and cons of choosing the room "${selectedRoom?.name}" at ${hostel?.name}?`;
                                        setAiQuestion(q);
                                        handleAskAi(q);
                                    }}
                                >
                                    Pros & cons summary
                                </button>
                                <button
                                    type="button"
                                    className="px-2 py-1 rounded-full border text-xs bg-background hover:bg-primary/10"
                                    onClick={() => {
                                        const q = `How does this room at ${hostel?.name} compare to other similar hostels for price, distance and comfort (based only on the data you see)?`;
                                        setAiQuestion(q);
                                        handleAskAi(q);
                                    }}
                                >
                                    Compare with others
                                </button>
                            </div>
                            <div className="space-y-2">
                                <textarea
                                    placeholder="Type a question about this room or hostel (e.g. privacy, noise, distance)..."
                                    className="w-full min-h-[70px] rounded-md border bg-background px-2 py-1 text-xs"
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    className="w-full h-8 text-xs"
                                    disabled={aiLoading}
                                    onClick={() => handleAskAi(aiQuestion)}
                                >
                                    {aiLoading ? 'Asking AI...' : 'Ask AI about this room'}
                                </Button>
                                {aiAnswer && (
                                    <div className="mt-2 rounded-md bg-background/80 border border-primary/20 p-2 text-xs text-left text-foreground">
                                        {aiAnswer}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    </div>
  )
}
