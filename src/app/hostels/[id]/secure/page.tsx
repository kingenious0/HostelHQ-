"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Image from "next/image"
import Link from "next/link"

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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2,
  CheckCircle2,
  FileText,
  Receipt,
  BedDouble,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Lock,
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  Star,
  User,
  Users,
  CreditCard,
  Building,
  GraduationCap,
  Phone,
  Mail,
  Shield,
  Check,
  HelpCircle,
  Clock,
  Eye,
  Info
} from "lucide-react"
import { getHostel, Hostel, RoomType } from "@/lib/data"
import { notFound } from 'next/navigation';
import { initializeHostelPayment } from "@/app/actions/paystack"
import { SanctionBanner } from "@/components/hostels/SanctionBanner"
import { isHostelRevoked, isHostelSanctioned, isHostelRestricted, SANCTION_MESSAGES } from "@/lib/sanctions"
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'
import { calculateRoomTypeInventory, isRoomTypeSoldOut, isHostelSoldOut } from '@/lib/room-capacity'
import { RoomCapacityRack } from '@/components/hostels/RoomCapacityRack'
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  // Step 1: Student Details & Bed Selection
  studentName: z.string().min(2, { message: "Student full name must be at least 2 characters." }),
  indexNumber: z.string().min(5, { message: "Valid index number is required." }),
  ghanaCardNumber: z.string().regex(/^(GHA-)?\d{9}-\d$/, { message: "Format must be GHA-XXXXXXXXX-X" }),
  departmentName: z.string().min(2, { message: "Department or programme is required." }),
  level: z.enum(["100", "200", "300", "400"]),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,13}$/, { message: "Valid phone number is required (e.g. 0244123456)." }),
  email: z.string().email({ message: "Valid email address is required." }),
  roomNumber: z.string().optional(),

  // Step 2: Guardian Details (Optional & Skippable)
  guardianName: z.string().optional().or(z.literal("")),
  guardianRelationship: z.string().optional().or(z.literal("")),
  guardianPhoneNumber: z.string().refine(val => !val || /^\+?[0-9]{10,13}$/.test(val), { message: "Invalid guardian phone number." }).optional().or(z.literal("")),
  guardianEmail: z.string().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), { message: "Invalid guardian email address." }).optional().or(z.literal("")),

  // Step 3: Terms Agreement
  termsAccepted: z.boolean().refine(val => val === true, { message: "You must accept the terms & conditions to complete your booking." }),
})

export default function SecureHostelPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const hostelId = params.id as string;
    const roomTypeId = searchParams.get('roomTypeId');
    const roomId = searchParams.get('roomId');
    const roomNumber = searchParams.get('roomNumber');

    // Stepper State: 1 = Student Details & Bed, 2 = Guardian (Optional), 3 = Review & Payment
    const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);
    const [mobileSummaryOpen, setMobileSummaryOpen] = React.useState(false);

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostel, setHostel] = React.useState<Hostel | null>(null);
    const [selectedRoom, setSelectedRoom] = React.useState<RoomType | null>(null);
    const [selectedRoomNumber, setSelectedRoomNumber] = React.useState<string>(roomNumber || '');
    const [confirmedBookings, setConfirmedBookings] = React.useState<Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }>>([]);
    const [loading, setLoading] = React.useState(true);
    const [existingBooking, setExistingBooking] = React.useState<{ id: string } | null | undefined>(null);
    const [verificationStatus, setVerificationStatus] = React.useState<string | null>(null);
    const [aiQuestion, setAiQuestion] = React.useState("");
    const [aiAnswer, setAiAnswer] = React.useState<string | null>(null);
    const [aiLoading, setAiLoading] = React.useState(false);
    const [userRole, setUserRole] = React.useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
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
            guardianEmail: "",
            roomNumber: roomNumber || "",
            termsAccepted: false,
        },
    });

    React.useEffect(() => {
        const fetchBookings = async () => {
            if (!hostelId) return;
            try {
                const bookingsQuery = query(
                    collection(db, 'bookings'),
                    where('hostelId', '==', hostelId),
                    where('status', '==', 'confirmed')
                );
                const snapshot = await getDocs(bookingsQuery);
                const bookings: Array<{ roomId?: string; roomNumber?: string; roomTypeId?: string }> = [];
                snapshot.forEach((d) => {
                    const data = d.data() as any;
                    bookings.push({
                        roomId: data.roomId,
                        roomNumber: data.roomNumber,
                        roomTypeId: data.roomTypeId,
                    });
                });
                setConfirmedBookings(bookings);
            } catch (e) {
                console.error('Error fetching confirmed bookings for secure page:', e);
            }
        };
        fetchBookings();
    }, [hostelId]);

    const inventorySummary = React.useMemo(() => {
        if (!selectedRoom) return null;
        return calculateRoomTypeInventory(selectedRoom, confirmedBookings);
    }, [selectedRoom, confirmedBookings]);

    const isSoldOut = React.useMemo(() => {
        if (hostel && isHostelSoldOut(hostel, confirmedBookings)) return true;
        if (selectedRoom && isRoomTypeSoldOut(selectedRoom, confirmedBookings)) return true;
        return inventorySummary?.isSoldOut ?? false;
    }, [hostel, selectedRoom, confirmedBookings, inventorySummary]);

    const isRevoked = React.useMemo(() => isHostelRevoked(hostel), [hostel]);
    const isSanctioned = React.useMemo(() => isHostelSanctioned(hostel), [hostel]);
    const isRestricted = isRevoked || isSanctioned;

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
            if (!user || typeof hostelId !== 'string') {
                setExistingBooking(null);
                setVerificationStatus(null);
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
                    guardianEmail: "",
                    roomNumber: selectedRoomNumber || roomNumber || "",
                    termsAccepted: false,
                });
                return;
            }

            setExistingBooking(null);

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() as any : {};
                const role = userData.role || 'student';
                if (role !== 'student') {
                    toast({
                        title: "Access Denied",
                        description: "Only students can book hostels",
                        variant: "destructive",
                    });
                    router.replace('/');
                    return;
                }
                setUserRole(role);
                if (userData.verificationStatus) setVerificationStatus(userData.verificationStatus);
                form.reset({
                    studentName: userData.fullName || user.displayName || "",
                    indexNumber: userData.indexNumber || "",
                    ghanaCardNumber: userData.ghanaCardNumber || "",
                    departmentName: userData.department || userData.programme || "",
                    level: (userData.level as "100" | "200" | "300" | "400") || "100",
                    phoneNumber: userData.phone || user.phoneNumber || "",
                    email: user.email || "",
                    guardianName: userData.guardianName || "",
                    guardianRelationship: userData.guardianRelationship || "",
                    guardianPhoneNumber: userData.guardianPhoneNumber || "",
                    guardianEmail: userData.guardianEmail || "",
                    roomNumber: selectedRoomNumber || roomNumber || "",
                    termsAccepted: false,
                });
            } catch {
                // ignore profile load errors
            }
        });

        return () => unsubscribe();
    }, [hostelId, selectedRoomNumber, roomNumber, router, toast]);

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

            // Sanction Status Check: Ensure fresh accreditationStatus from Firestore
            try {
                const liveDocSnap = await getDoc(doc(db, 'hostels', hostelId));
                if (liveDocSnap.exists()) {
                    const liveData = liveDocSnap.data();
                    if (liveData?.accreditationStatus) hostelData.accreditationStatus = liveData.accreditationStatus;
                    if (liveData?.sanctionStatus) hostelData.sanctionStatus = liveData.sanctionStatus;
                    if (liveData?.status) hostelData.status = liveData.status;
                }
            } catch (snapErr) {
                console.warn("Realtime sanction check fallback:", snapErr);
            }

            setHostel(hostelData);
            
            const targetRoomId = roomTypeId || hostelData.roomTypes[0]?.id;
            if (targetRoomId && hostelData.roomTypes.length > 0) {
                const room = hostelData.roomTypes.find(rt => rt.id === targetRoomId);
                if (room) {
                    setSelectedRoom(room);
                } else {
                    console.warn(`Room type ${targetRoomId} not found, using first available room`);
                    setSelectedRoom(hostelData.roomTypes[0]);
                }
            } else if (hostelData.roomTypes.length > 0) {
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

    // Step Navigation Handlers
    const handleProceedToStep2 = async () => {
        const isStep1Valid = await form.trigger([
            "studentName",
            "indexNumber",
            "ghanaCardNumber",
            "departmentName",
            "level",
            "phoneNumber",
            "email",
        ]);
        if (isStep1Valid) {
            setCurrentStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            toast({
                title: "Incomplete Details",
                description: "Please check the highlighted student fields before continuing.",
                variant: "destructive"
            });
        }
    };

    const handleSkipToStep3 = async () => {
        if (currentStep === 1) {
            const isStep1Valid = await form.trigger([
                "studentName",
                "indexNumber",
                "ghanaCardNumber",
                "departmentName",
                "level",
                "phoneNumber",
                "email",
            ]);
            if (!isStep1Valid) {
                toast({
                    title: "Incomplete Details",
                    description: "Please complete student details before proceeding to payment.",
                    variant: "destructive"
                });
                return;
            }
        }
        form.clearErrors(["guardianName", "guardianRelationship", "guardianPhoneNumber", "guardianEmail"]);
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleProceedToStep3 = async () => {
        const isStep2Valid = await form.trigger([
            "guardianName",
            "guardianRelationship",
            "guardianPhoneNumber",
            "guardianEmail",
        ]);
        if (isStep2Valid) {
            setCurrentStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!hostel || !selectedRoom || typeof hostelId !== 'string') return;
        
        // Runtime Sanction Enforcement: Reject submissions for restricted hostels
        if (isRestricted) {
            toast({
                title: "Action Denied",
                description: SANCTION_MESSAGES.ACTION_DENIED,
                variant: "destructive",
            });
            return;
        }

        if (isSoldOut) {
            toast({
                title: "Unit Sold Out",
                description: "This room type is currently at 100% capacity and cannot accept new bookings.",
                variant: "destructive",
            });
            return;
        }

        if (!auth.currentUser) {
            toast({
                title: "Login Required",
                description: "You need to be logged in with an active student account to secure a room.",
                variant: "destructive",
            });
            const redirectUrl = `/hostels/${hostelId}/secure${roomTypeId ? `?roomTypeId=${roomTypeId}` : ''}`;
            router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
            return;
        }

        if (userRole && userRole !== 'student') {
            toast({
                title: "Access Denied",
                description: "Only students can book hostels",
                variant: "destructive",
            });
            router.replace('/');
            return;
        }

        if (verificationStatus === 'pending') {
            toast({
                title: "Account Under Review",
                description: "Your student credentials are undergoing authentication by the HostelHQ Administration. You can browse hostels in preview mode while your verification is in progress.",
                variant: "destructive",
            });
            return;
        }

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
                guardianName: values.guardianName || "",
                guardianRelationship: values.guardianRelationship || "",
                guardianPhoneNumber: values.guardianPhoneNumber || "",
                guardianEmail: values.guardianEmail || "",
                roomTypeId: selectedRoom.id,
                roomTypeName: selectedRoom.name,
                roomPrice: selectedRoom.price,
                roomId,
                roomNumber: values.roomNumber || selectedRoomNumber || roomNumber || null,
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
                window.location.href = result.authorization_url;
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

    // Step progress percentage
    const stepProgress = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;
    const formValues = form.getValues();

    return (
        <div className="flex flex-col min-h-screen bg-[#fafafa] dark:bg-background text-foreground">
            <Header />

            <main className="flex-1 py-6 md:py-10 pb-28 md:pb-16">
                {/* Top Nav & Accreditation Badges */}
                <div className="mx-auto max-w-6xl px-4 md:px-6 mb-4 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (currentStep > 1) {
                                setCurrentStep((prev) => (prev - 1) as 1 | 2);
                            } else {
                                router.back();
                            }
                        }}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground -ml-2 text-xs md:text-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {currentStep === 1 ? "Back to room selection" : currentStep === 2 ? "Back to Student Details" : "Back to Guardian Details"}
                    </Button>

                    <div className="flex items-center gap-2">
                        {isRevoked ? (
                            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                Charter Revoked
                            </span>
                        ) : isSanctioned ? (
                            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                Under Sanction
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                University-Approved ✓
                            </span>
                        )}
                        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Shield className="h-3 w-3 mr-1" />
                            Escrow Protected
                        </span>
                    </div>
                </div>

                {/* Non-Dismissible Statutory Sanction Banner */}
                <div className="mx-auto max-w-6xl px-4 md:px-6 mb-4">
                    <SanctionBanner hostel={hostel} />
                </div>

                {/* Sold Out Banner */}
                {isSoldOut && (
                    <div className="mx-auto max-w-6xl px-4 md:px-6 mb-6">
                        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-5 text-rose-900 shadow-sm flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                                <Lock className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-rose-900">Inventory Locked — 100% Capacity Reached</h3>
                                    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 uppercase tracking-wider">
                                        Sold Out
                                    </span>
                                </div>
                                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                                    This room type is completely booked and cannot accept new reservations. You can still inspect all pricing, hostel specifications, and tenancy inclusions in read-only mode, but payment processing is disabled.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Collapsible Booking Summary Bar (<768px) */}
                <div className="md:hidden mx-auto max-w-6xl px-4 mb-4">
                    <div className="rounded-xl border border-border/80 bg-white dark:bg-card p-3 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/60">
                                    <Image
                                        src={selectedRoom.images?.[0] || hostel?.images?.[0] || '/placeholder.jpg'}
                                        alt={selectedRoom.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground truncate">{hostel?.name}</p>
                                    <h2 className="text-sm font-bold text-foreground truncate">{selectedRoom.name}</h2>
                                    <p className="text-xs font-semibold text-primary">
                                        GH₵{selectedRoom.price.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">/ academic year</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-primary font-medium shrink-0 ml-2">
                                <span>{mobileSummaryOpen ? "Hide" : "Details"}</span>
                                {mobileSummaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                        </button>

                        {mobileSummaryOpen && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Location</span>
                                    <span className="font-medium text-foreground">{hostel?.location}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Allocated Bed</span>
                                    <span className="font-medium text-foreground">
                                        {selectedRoomNumber || "Assigned upon check-in"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Room Price</span>
                                    <span className="font-medium text-foreground">GH₵{selectedRoom.price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Booking &amp; Escrow Fee</span>
                                    <span className="font-medium text-emerald-600 font-semibold">GH₵ 0.00 (Free)</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Digital Agreement</span>
                                    <span className="font-medium text-emerald-600 font-semibold">Included</span>
                                </div>
                                <div className="pt-2 border-t border-dashed flex justify-between font-bold text-sm text-foreground">
                                    <span>Total Due</span>
                                    <span className="text-primary">GH₵{selectedRoom.price.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Bar & Modern Stepper Indicator */}
                <div className="mx-auto max-w-6xl px-4 md:px-6 mb-6">
                    <div className="bg-white dark:bg-card border border-border/60 rounded-2xl p-4 md:p-5 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                                    Step {currentStep} of 3
                                </span>
                                <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                                    {currentStep === 1 && "Student Details & Bed Selection"}
                                    {currentStep === 2 && "Parent / Guardian Contact (Optional)"}
                                    {currentStep === 3 && "Review & Complete Booking"}
                                </h2>
                            </div>
                            <div className="text-xs text-muted-foreground md:text-right">
                                {currentStep === 1 && "Confirm your academic credentials & bed unit"}
                                {currentStep === 2 && "Optional emergency contact & agreement copy"}
                                {currentStep === 3 && "Verified bank-grade Paystack escrow payment"}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <Progress value={stepProgress} className="h-2 bg-muted rounded-full" />
                            <div className="grid grid-cols-3 text-xs gap-2 pt-1 font-medium">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className={cn(
                                        "flex items-center gap-1.5 transition-colors text-left",
                                        currentStep === 1 ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                                        currentStep > 1 ? "bg-emerald-500 text-white" : currentStep === 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        {currentStep > 1 ? "✓" : "1"}
                                    </span>
                                    <span className="truncate">1. Student Details</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (currentStep > 2 || form.formState.isValid) setCurrentStep(2);
                                    }}
                                    className={cn(
                                        "flex items-center gap-1.5 transition-colors text-left",
                                        currentStep === 2 ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                                        currentStep > 2 ? "bg-emerald-500 text-white" : currentStep === 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        {currentStep > 2 ? "✓" : "2"}
                                    </span>
                                    <span className="truncate">2. Guardian (Opt)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (currentStep === 3) return;
                                        handleSkipToStep3();
                                    }}
                                    className={cn(
                                        "flex items-center gap-1.5 transition-colors text-left",
                                        currentStep === 3 ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                                        currentStep === 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        3
                                    </span>
                                    <span className="truncate">3. Confirm &amp; Pay</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Two-Column Layout (Responsive Stacking) */}
                <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.2fr_0.8fr] md:px-6 items-start">
                    
                    {/* Left Column: Multi-Step Interactive Form */}
                    <div className="space-y-6">
                        <Card className="shadow-sm border border-border/60 bg-white dark:bg-card">
                            <CardContent className="p-5 md:p-7">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                        {/* ==================== STEP 1: STUDENT DETAILS & BED SELECTION ==================== */}
                                        {currentStep === 1 && (
                                            <div className="space-y-6 animate-in fade-in-50 duration-200">
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                                        <User className="h-5 w-5 text-primary" />
                                                        Student Identity &amp; Bed Allocation
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Please ensure your name, ID, and department match official university records for accreditation.
                                                    </p>
                                                </div>

                                                {/* Interactive Bed Selector Rack */}
                                                {inventorySummary && (
                                                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                                <BedDouble className="h-4 w-4 text-primary" />
                                                                Select Your Specific Bed / Room Unit
                                                            </span>
                                                            {selectedRoomNumber ? (
                                                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-[11px] px-2.5 py-0.5">
                                                                    Selected: {selectedRoomNumber} ✓
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground italic">
                                                                    Tap an open slot below
                                                                </span>
                                                            )}
                                                        </div>
                                                        <RoomCapacityRack
                                                            summary={inventorySummary}
                                                            interactive={true}
                                                            selectedRoomNumber={selectedRoomNumber}
                                                            onSelectRoom={(room) => {
                                                                if (room.status !== 'full') {
                                                                    setSelectedRoomNumber(room.roomNumber);
                                                                    form.setValue('roomNumber', room.roomNumber, { shouldValidate: true });
                                                                }
                                                            }}
                                                        />
                                                        {selectedRoomNumber && (
                                                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                                ✓ Bed allocation <strong className="font-bold">{selectedRoomNumber}</strong> will be locked in immediately upon payment confirmation.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="studentName"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Full Legal Name</FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                        <Input placeholder="e.g. Akua Mensah" className="pl-9 h-11" {...field} />
                                                                    </div>
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="indexNumber"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Student Index Number</FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                        <Input placeholder="e.g. AAMUSTED/22/0145" className="pl-9 h-11" {...field} />
                                                                    </div>
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="ghanaCardNumber"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Ghana Card Number</FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                        <Input placeholder="GHA-XXXXXXXXX-X" className="pl-9 h-11 uppercase" {...field} />
                                                                    </div>
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="departmentName"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Department / Programme</FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                        <Input placeholder="e.g. Information Technology" className="pl-9 h-11" {...field} />
                                                                    </div>
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="level"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Current Academic Level</FormLabel>
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-11">
                                                                            <SelectValue placeholder="Select level" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="100">Level 100 (Freshman)</SelectItem>
                                                                        <SelectItem value="200">Level 200 (Sophomore)</SelectItem>
                                                                        <SelectItem value="300">Level 300 (Junior)</SelectItem>
                                                                        <SelectItem value="400">Level 400 (Senior)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="phoneNumber"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Payment Phone Number</FormLabel>
                                                                <FormControl>
                                                                    <div className="relative">
                                                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                        <Input placeholder="0244123456 or +233..." className="pl-9 h-11" {...field} />
                                                                    </div>
                                                                </FormControl>
                                                                <FormDescription className="text-[11px]">
                                                                    Mobile money prompt will trigger on this phone number.
                                                                </FormDescription>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <FormField
                                                    control={form.control}
                                                    name="email"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-semibold">Student Email Address</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                                    <Input type="email" placeholder="student@example.com" className="pl-9 h-11" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription className="text-[11px]">
                                                                Your official tenancy agreement and digital receipt will be emailed here.
                                                            </FormDescription>
                                                            <FormMessage className="text-xs" />
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Step 1 Actions */}
                                                <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleSkipToStep3}
                                                        className="text-xs text-muted-foreground hover:text-foreground order-2 sm:order-1"
                                                    >
                                                        Skip Guardian &amp; Go to Payment →
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        onClick={handleProceedToStep2}
                                                        className="w-full sm:w-auto h-12 px-6 font-bold bg-[#800020] hover:bg-[#6b001a] text-white flex items-center justify-center gap-2 order-1 sm:order-2"
                                                    >
                                                        Continue to Guardian Details
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* ==================== STEP 2: GUARDIAN DETAILS (OPTIONAL) ==================== */}
                                        {currentStep === 2 && (
                                            <div className="space-y-6 animate-in fade-in-50 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                                            <Users className="h-5 w-5 text-primary" />
                                                            Parent / Guardian Contact
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Optional emergency contact for university records and safety.
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border/80">
                                                        Optional Step
                                                    </Badge>
                                                </div>

                                                <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/20 dark:border-blue-900/40 p-4 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
                                                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                                    <p className="leading-relaxed">
                                                        Providing guardian details is completely optional. If provided, a copy of the official digital tenancy agreement and payment receipt will be sent to them, giving peace of mind.
                                                    </p>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="guardianName"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Guardian Full Name (Optional)</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="e.g. Kofi Mensah" className="h-11" {...field} />
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="guardianRelationship"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Relationship</FormLabel>
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-11">
                                                                            <SelectValue placeholder="Select relationship" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="mother">Mother</SelectItem>
                                                                        <SelectItem value="father">Father</SelectItem>
                                                                        <SelectItem value="guardian">Legal Guardian</SelectItem>
                                                                        <SelectItem value="aunt">Aunt</SelectItem>
                                                                        <SelectItem value="uncle">Uncle</SelectItem>
                                                                        <SelectItem value="sibling">Sibling</SelectItem>
                                                                        <SelectItem value="other">Other Relative</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="guardianPhoneNumber"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Guardian Phone Number (Optional)</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="+233 XX XXX XXXX" className="h-11" {...field} />
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="guardianEmail"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold">Guardian Email Address (Optional)</FormLabel>
                                                                <FormControl>
                                                                    <Input type="email" placeholder="parent@example.com" className="h-11" {...field} />
                                                                </FormControl>
                                                                <FormMessage className="text-xs" />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                {/* Step 2 Actions */}
                                                <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setCurrentStep(1)}
                                                        className="text-xs text-muted-foreground hover:text-foreground order-3 sm:order-1"
                                                    >
                                                        ← Back to Student Details
                                                    </Button>

                                                    <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={handleSkipToStep3}
                                                            className="flex-1 sm:flex-initial h-12 text-xs font-medium"
                                                        >
                                                            Skip this step
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={handleProceedToStep3}
                                                            className="flex-1 sm:flex-initial h-12 px-6 font-bold bg-[#800020] hover:bg-[#6b001a] text-white flex items-center justify-center gap-2"
                                                        >
                                                            Review Payment &amp; Terms
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ==================== STEP 3: REVIEW & CONFIRM PAYMENT ==================== */}
                                        {currentStep === 3 && (
                                            <div className="space-y-6 animate-in fade-in-50 duration-200">
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                                        <Receipt className="h-5 w-5 text-primary" />
                                                        Review &amp; Complete Secure Booking
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Please review your details and finalize payment to issue your digital tenancy contract.
                                                    </p>
                                                </div>

                                                {/* Scannable Review Breakdown */}
                                                <div className="rounded-xl border border-border/70 divide-y divide-border/60 text-xs overflow-hidden">
                                                    {/* Student Recap */}
                                                    <div className="p-3.5 bg-muted/20 flex items-start justify-between">
                                                        <div>
                                                            <p className="font-bold text-foreground flex items-center gap-1.5">
                                                                <User className="h-3.5 w-3.5 text-primary" />
                                                                Student Profile
                                                            </p>
                                                            <p className="text-muted-foreground mt-1">
                                                                <strong className="text-foreground">{formValues.studentName || "N/A"}</strong> · Index: {formValues.indexNumber || "N/A"} · Ghana Card: {formValues.ghanaCardNumber || "N/A"}
                                                            </p>
                                                            <p className="text-muted-foreground mt-0.5">
                                                                {formValues.departmentName || "General"} · Level {formValues.level} · {formValues.phoneNumber}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setCurrentStep(1)}
                                                            className="h-7 text-xs text-primary hover:text-primary font-semibold"
                                                        >
                                                            Edit
                                                        </Button>
                                                    </div>

                                                    {/* Room & Bed Recap */}
                                                    <div className="p-3.5 bg-muted/20 flex items-start justify-between">
                                                        <div>
                                                            <p className="font-bold text-foreground flex items-center gap-1.5">
                                                                <BedDouble className="h-3.5 w-3.5 text-primary" />
                                                                Room &amp; Bed Assignment
                                                            </p>
                                                            <p className="text-muted-foreground mt-1">
                                                                <strong className="text-foreground">{hostel?.name}</strong> · {selectedRoom.name}
                                                            </p>
                                                            <p className="text-muted-foreground mt-0.5">
                                                                Allocated Unit: <strong className="text-foreground font-bold">{selectedRoomNumber || "Assigned at check-in"}</strong>
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setCurrentStep(1)}
                                                            className="h-7 text-xs text-primary hover:text-primary font-semibold"
                                                        >
                                                            Change
                                                        </Button>
                                                    </div>

                                                    {/* Guardian Recap */}
                                                    <div className="p-3.5 bg-muted/20 flex items-start justify-between">
                                                        <div>
                                                            <p className="font-bold text-foreground flex items-center gap-1.5">
                                                                <Users className="h-3.5 w-3.5 text-primary" />
                                                                Parent / Guardian Contact
                                                            </p>
                                                            <p className="text-muted-foreground mt-1">
                                                                {formValues.guardianName ? (
                                                                    <span>
                                                                        <strong className="text-foreground">{formValues.guardianName}</strong> ({formValues.guardianRelationship || "Guardian"}) · {formValues.guardianPhoneNumber || "No phone"}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic">None provided (Skipped)</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setCurrentStep(2)}
                                                            className="h-7 text-xs text-primary hover:text-primary font-semibold"
                                                        >
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Transparent Pricing Table */}
                                                <div className="rounded-xl border border-border/80 bg-muted/10 p-4 space-y-2.5 text-xs">
                                                    <p className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                                                        Price Breakdown (Ghanaian Cedis)
                                                    </p>
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Room Rent (1 Academic Year)</span>
                                                        <span className="font-medium text-foreground">GH₵{selectedRoom.price.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>HostelHQ Escrow Protection &amp; Booking Fee</span>
                                                        <span className="font-semibold text-emerald-600">GH₵ 0.00 (Waived)</span>
                                                    </div>
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Digital Tenancy Agreement Preparation</span>
                                                        <span className="font-semibold text-emerald-600">Included</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-border flex justify-between font-bold text-sm text-foreground">
                                                        <span>Total Due Now</span>
                                                        <span className="text-primary text-base">GH₵{selectedRoom.price.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                {/* Payment Gateway Box */}
                                                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-white dark:bg-card border flex items-center justify-center shrink-0">
                                                            <CreditCard className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">Mobile Money &amp; Card via Paystack</p>
                                                            <p className="text-[11px] text-muted-foreground">Supports MTN MoMo, Telecel Cash, AT Money, &amp; Visa/Mastercard</p>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                                        256-bit Encrypted
                                                    </Badge>
                                                </div>

                                                {/* Terms Agreement Checkbox */}
                                                <FormField
                                                    control={form.control}
                                                    name="termsAccepted"
                                                    render={({ field }) => (
                                                        <FormItem className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                                                            <div className="flex items-start space-x-3">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                        className="mt-0.5"
                                                                    />
                                                                </FormControl>
                                                                <div className="space-y-1 leading-none">
                                                                    <FormLabel className="text-xs font-semibold text-foreground cursor-pointer">
                                                                        I confirm my details are accurate and I agree to the HostelHQ Tenancy Agreement &amp; Refund Policy.
                                                                    </FormLabel>
                                                                    <p className="text-[11px] text-muted-foreground leading-normal">
                                                                        By checking this box, you authorize HostelHQ to process your booking and issue your legal tenancy contract.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <FormMessage className="text-xs" />
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Trust Badges */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground pt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                                                        <span>Bank-grade encryption</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                                                        <span>Instant digital agreement</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                                        <span>24/7 hostel support</span>
                                                    </div>
                                                </div>

                                                {/* Final Action Buttons */}
                                                <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setCurrentStep(2)}
                                                        className="text-xs text-muted-foreground hover:text-foreground order-2 sm:order-1"
                                                    >
                                                        ← Back to Guardian Details
                                                    </Button>

                                                    <Button
                                                        type="submit"
                                                        className={cn(
                                                            "w-full sm:w-auto h-12 px-8 font-bold text-base transition-all bg-[#800020] hover:bg-[#6b001a] text-white flex items-center justify-center gap-2 order-1 sm:order-2",
                                                            isRevoked && "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 cursor-not-allowed shadow-none",
                                                            isSanctioned && "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/10 cursor-not-allowed shadow-none",
                                                            isSoldOut && !isRestricted && "bg-slate-200 text-slate-500 hover:bg-slate-200 cursor-not-allowed border border-slate-300 shadow-none"
                                                        )}
                                                        disabled={isSubmitting || !selectedRoom || isSoldOut || isRestricted}
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                                Processing Payment...
                                                            </>
                                                        ) : isRevoked ? (
                                                            <>
                                                                <Ban className="mr-2 h-5 w-5 text-rose-600" />
                                                                Payment Disabled (Revoked)
                                                            </>
                                                        ) : isSanctioned ? (
                                                            <>
                                                                <AlertTriangle className="mr-2 h-5 w-5 text-amber-600" />
                                                                Bookings Paused
                                                            </>
                                                        ) : isSoldOut ? (
                                                            <>
                                                                <Lock className="mr-2 h-5 w-5 text-slate-500" />
                                                                Sold Out (100% Full)
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Lock className="mr-2 h-5 w-5" />
                                                                Complete Secure Booking · GH₵{selectedRoom?.price?.toLocaleString()}
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        {/* Collapsible AI Helper Section */}
                        <Card className="border border-border/60 bg-white dark:bg-card shadow-sm overflow-hidden">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="ai-helper" className="border-none">
                                    <AccordionTrigger className="px-5 py-4 hover:no-underline text-left">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                            <Sparkles className="h-4 w-4 text-accent" />
                                            <span>Need answers before booking? Ask AI Assistant</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-5 pb-5 pt-1 space-y-3 text-xs">
                                        <p className="text-muted-foreground">
                                            Get instant advice about this room type, quiet study suitability, pros &amp; cons, or comparison with other hostels.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="px-2.5 py-1 rounded-full border text-[11px] bg-muted/40 hover:bg-primary/10 transition-colors"
                                                onClick={() => {
                                                    const q = `Is the room "${selectedRoom?.name}" at ${hostel?.name} good for quiet study and focus?`;
                                                    setAiQuestion(q);
                                                    handleAskAi(q);
                                                }}
                                            >
                                                Quiet study suitability?
                                            </button>
                                            <button
                                                type="button"
                                                className="px-2.5 py-1 rounded-full border text-[11px] bg-muted/40 hover:bg-primary/10 transition-colors"
                                                onClick={() => {
                                                    const q = `What are the main pros and cons of choosing the room "${selectedRoom?.name}" at ${hostel?.name}?`;
                                                    setAiQuestion(q);
                                                    handleAskAi(q);
                                                }}
                                            >
                                                Pros &amp; cons summary?
                                            </button>
                                            <button
                                                type="button"
                                                className="px-2.5 py-1 rounded-full border text-[11px] bg-muted/40 hover:bg-primary/10 transition-colors"
                                                onClick={() => {
                                                    const q = `How does this room at ${hostel?.name} compare for price, distance and comfort?`;
                                                    setAiQuestion(q);
                                                    handleAskAi(q);
                                                }}
                                            >
                                                Compare with others?
                                            </button>
                                        </div>
                                        <div className="space-y-2 pt-1">
                                            <textarea
                                                placeholder="Type a custom question about this room or hostel..."
                                                className="w-full min-h-[64px] rounded-lg border border-border/80 bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                                                value={aiQuestion}
                                                onChange={(e) => setAiQuestion(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="w-full h-8 text-xs font-semibold bg-primary/90 hover:bg-primary text-white"
                                                disabled={aiLoading}
                                                onClick={() => handleAskAi(aiQuestion)}
                                            >
                                                {aiLoading ? 'Analyzing...' : 'Ask AI Helper'}
                                            </Button>
                                            {aiAnswer && (
                                                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-foreground leading-relaxed">
                                                    {aiAnswer}
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </Card>
                    </div>

                    {/* Right Column: Desktop Sticky Room Summary Card */}
                    <div className="hidden md:block sticky top-24 space-y-4">
                        <Card className="shadow-md border border-border/60 bg-white dark:bg-card overflow-hidden">
                            {/* Room / Hostel Photo */}
                            <div className="relative h-44 w-full bg-muted">
                                <Image
                                    src={selectedRoom.images?.[0] || hostel?.images?.[0] || '/placeholder.jpg'}
                                    alt={selectedRoom.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                                
                                <div className="absolute top-3 right-3">
                                    <Badge className="bg-white/95 text-foreground font-bold shadow-sm flex items-center gap-1 text-xs">
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        {hostel?.rating ? hostel.rating.toFixed(1) : "5.0"}
                                    </Badge>
                                </div>

                                <div className="absolute bottom-3 left-3 right-3 text-white">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        University-Approved Listing
                                    </p>
                                    <h3 className="font-bold text-lg leading-tight mt-0.5">{hostel?.name}</h3>
                                    <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                                        <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                                        <span className="truncate">{hostel?.location}</span>
                                    </p>
                                </div>
                            </div>

                            <CardContent className="p-5 space-y-4 text-xs">
                                {/* Room Title & Unit Allocation */}
                                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Selected Unit
                                        </span>
                                        {isSoldOut ? (
                                            <Badge variant="destructive" className="text-[10px] font-bold h-5">
                                                Sold Out
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold h-5">
                                                Available
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="font-bold text-sm text-foreground flex items-center justify-between">
                                        <span>{selectedRoom.name}</span>
                                        <span className="text-primary font-bold text-sm">
                                            GH₵{selectedRoom.price.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-muted-foreground flex items-center justify-between text-[11px] pt-0.5">
                                        <span>Capacity: {selectedRoom.capacity} in a room</span>
                                        {selectedRoomNumber ? (
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                Bed: {selectedRoomNumber} ✓
                                            </span>
                                        ) : (
                                            <span className="italic text-muted-foreground">Bed assigned upon check-in</span>
                                        )}
                                    </div>
                                </div>

                                {/* Transparent Price Breakdown */}
                                <div className="space-y-2 pt-1 border-t border-border/60">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Annual Room Rent</span>
                                        <span className="font-medium text-foreground">GH₵{selectedRoom.price.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>HostelHQ Escrow Fee</span>
                                        <span className="font-semibold text-emerald-600">GH₵ 0.00 (Waived)</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Tenancy Agreement Preparation</span>
                                        <span className="font-semibold text-emerald-600">Included</span>
                                    </div>
                                    <div className="pt-2 border-t border-dashed flex justify-between font-bold text-sm text-foreground">
                                        <span>Total Due Today</span>
                                        <span className="text-primary text-base font-bold">
                                            GH₵{selectedRoom.price.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Inclusions Checklist */}
                                <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5 space-y-2">
                                    <p className="font-bold text-[11px] uppercase tracking-wider text-primary">
                                        Booking Inclusions
                                    </p>
                                    <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                                        <li className="flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>Full 1 Academic Year Tenancy Period</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>Digital Tenancy Agreement with Official Stamp</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>100% Escrow Protection until check-in</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>HostelHQ 24/7 Student Concierge Support</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Support Contact */}
                                <div className="text-[11px] text-muted-foreground text-center pt-1">
                                    Need help? Call <span className="font-semibold text-foreground">+233 59 762 6090</span> or email <span className="font-semibold text-foreground">hostelhqghana@gmail.com</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Mobile Sticky Bottom Action Bar (<768px) */}
                <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-border/80 z-40 md:hidden shadow-lg">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Due</span>
                            <p className="text-base font-bold text-primary leading-tight">
                                GH₵{selectedRoom.price.toLocaleString()}
                            </p>
                        </div>

                        {currentStep === 1 && (
                            <Button
                                type="button"
                                onClick={handleProceedToStep2}
                                className="h-12 px-6 font-bold text-sm bg-[#800020] hover:bg-[#6b001a] text-white flex items-center gap-1.5 shrink-0"
                            >
                                Continue →
                            </Button>
                        )}

                        {currentStep === 2 && (
                            <Button
                                type="button"
                                onClick={handleProceedToStep3}
                                className="h-12 px-6 font-bold text-sm bg-[#800020] hover:bg-[#6b001a] text-white flex items-center gap-1.5 shrink-0"
                            >
                                Review Payment →
                            </Button>
                        )}

                        {currentStep === 3 && (
                            <Button
                                type="button"
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isSubmitting || isSoldOut || isRestricted}
                                className="h-12 px-6 font-bold text-sm bg-[#800020] hover:bg-[#6b001a] text-white flex items-center gap-1.5 shrink-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="h-4 w-4" />
                                        Pay GH₵{selectedRoom.price.toLocaleString()}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
