

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User, ShieldCheck, Ticket, FileText, Share2, MessageCircle, Twitter, Facebook, Copy, Check, ArrowRight, Users as UsersIcon, Smartphone, CreditCard, ImagePlus, Receipt, AlertTriangle, ArrowLeft, Grid, CheckCircle2, ChevronRight, Eye, Sparkles, Building, Info, ShieldAlert, Compass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapboxMap } from '@/components/map';


const amenityIcons: { [key: string]: React.ReactNode } = {
    'wifi': <Wifi className="h-5 w-5" />,
    'parking': <ParkingSquare className="h-5 w-5" />,
    'kitchen': <Utensils className="h-5 w-5" />,
    'laundry': <Droplets className="h-5 w-5" />,
    'ac': <Snowflake className="h-5 w-5" />,
    'gym': <Dumbbell className="h-5 w-5" />,
    'study area': <BookOpen className="h-5 w-5" />,
};

const availabilityInfo: Record<Hostel['availability'], { text: string, icon: React.ReactNode, className: string }> = {
    'Available': { text: 'Rooms Available', icon: <DoorOpen />, className: 'bg-green-100 text-green-800 border-green-200' },
    'Limited': { text: 'Limited Rooms', icon: <Clock />, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'Full': { text: 'Hostel Full', icon: <Lock />, className: 'bg-red-100 text-red-800 border-red-200' },
};

interface AppUser {
    uid: string;
    email: string;
    fullName: string;
    role: 'student' | 'hostel_manager' | 'admin';
    profileImage?: string;
}

type Visit = {
    id: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    studentCompleted?: boolean;
}

type ExistingBooking = {
    id: string;
    status: string;
    roomTypeId?: string;
}

type RoomInventoryItem = {
    id: string;
    label: string;
    type: string;
    price: number;
    occupancy: number;
    capacity: number | null;
    gender: string;
    image: string;
};

function FullHostelDetails({ hostel, currentUser }: { hostel: Hostel, currentUser: AppUser | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const currentAvailability = availabilityInfo[hostel.availability || 'Full'];
    const [existingVisit, setExistingVisit] = useState<Visit | null | undefined>(undefined); // undefined: loading, null: not found
    const [existingBooking, setExistingBooking] = useState<ExistingBooking | null | undefined>(undefined); // undefined: loading, null: not found
    const [shareUrl, setShareUrl] = useState('');
    const [shareCopied, setShareCopied] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [roomsDialogOpen, setRoomsDialogOpen] = useState(false);
    const [selectedRating, setSelectedRating] = useState('5');
    const [draftReview, setDraftReview] = useState('');
    const [roomOccupancy, setRoomOccupancy] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!currentUser || !hostel.id) {
            setExistingVisit(null);
            setExistingBooking(null);
            return;
        }

        const checkExistingBooking = async () => {
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('studentId', '==', currentUser.uid),
                where('hostelId', '==', hostel.id),
                where('status', '==', 'confirmed')
            );

            const bookingSnapshot = await getDocs(bookingsQuery);
            if (!bookingSnapshot.empty) {
                const booking = bookingSnapshot.docs[0];
                setExistingBooking({
                    id: booking.id,
                    status: booking.data().status,
                    roomTypeId: booking.data().roomTypeId
                });
            } else {
                setExistingBooking(null);
            }
        };

        const checkExistingVisit = async () => {
            const visitsQuery = query(
                collection(db, 'visits'),
                where('studentId', '==', currentUser.uid),
                where('hostelId', '==', hostel.id)
            );

            const visitSnapshot = await getDocs(visitsQuery);
            if (!visitSnapshot.empty) {
                // Find a visit that is completed AND the student has marked as completed
                const completedVisit = visitSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        status: doc.data().status,
                        studentCompleted: doc.data().studentCompleted
                    } as Visit))
                    .find(visit => visit.status === 'completed' && visit.studentCompleted === true);

                // If no completed visit, find any non-cancelled visit
                const activeOrCompletedVisit = completedVisit || visitSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        status: doc.data().status,
                        studentCompleted: doc.data().studentCompleted
                    } as Visit))
                    .find(visit => visit.status !== 'cancelled');

                setExistingVisit(activeOrCompletedVisit || null);
            } else {
                setExistingVisit(null);
            }
        };

        // Check booking first (takes priority), then visit
        checkExistingBooking();
        checkExistingVisit();
    }, [currentUser, hostel.id]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setShareUrl(window.location.href);
        }
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (shareCopied) {
            timer = setTimeout(() => setShareCopied(false), 1800);
        }
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [shareCopied]);

    // Load current occupancy per roomType based on confirmed bookings
    useEffect(() => {
        const loadOccupancy = async () => {
            if (!hostel.id) return;
            try {
                const bookingsQuery = query(
                    collection(db, 'bookings'),
                    where('hostelId', '==', hostel.id),
                    where('status', '==', 'confirmed')
                );
                const snapshot = await getDocs(bookingsQuery);
                const counts: Record<string, number> = {};
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() as any;
                    const roomTypeId = data.roomTypeId || null;
                    const roomTypeName = data.roomTypeName || data.roomType || null;
                    if (roomTypeId) {
                        counts[String(roomTypeId)] = (counts[String(roomTypeId)] || 0) + 1;
                    }
                    if (roomTypeName) {
                        counts[String(roomTypeName)] = (counts[String(roomTypeName)] || 0) + 1;
                    }
                });
                setRoomOccupancy(counts);
            } catch (error) {
                console.error('Error loading room occupancy for hostel detail page:', error);
            }
        };

        loadOccupancy();
    }, [hostel.id]);

    const reviewStats = useMemo(() => {
        const reviews = Array.isArray(hostel.reviews) ? hostel.reviews : [];
        if (reviews.length === 0) {
            return {
                total: hostel.numberOfReviews || 0,
                average: hostel.rating || 0,
                breakdown: [5, 4, 3, 2, 1].map((star) => ({
                    star,
                    count: 0,
                    percentage: 0,
                })),
            };
        }

        const total = reviews.length;
        const sum = reviews.reduce((acc, review) => acc + (review.rating || 0), 0);
        const breakdown = [5, 4, 3, 2, 1].map((star) => {
            const count = reviews.filter((review) => Math.round(review.rating) === star).length;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return { star, count, percentage };
        });

        return {
            total,
            average: total > 0 ? sum / total : 0,
            breakdown,
        };
    }, [hostel.reviews, hostel.rating, hostel.numberOfReviews]);

    const reviewAverage = reviewStats.total > 0 ? reviewStats.average : hostel.rating || 0;
    const totalReviews = reviewStats.total > 0 ? reviewStats.total : hostel.numberOfReviews || 0;
    const roundedAverage = Math.round(reviewAverage);

    const parseCapacityFromName = (value?: string | null): number | null => {
        if (!value) return null;
        const match = value.match(/\d+/);
        if (!match) return null;
        const parsed = parseInt(match[0], 10);
        return Number.isNaN(parsed) ? null : parsed;
    };

    const primaryImages = hostel.images?.length ? hostel.images : ['/AAMUSTED-Full-shot.jpeg'];

    const roomInventory = useMemo<RoomInventoryItem[]>(() => {
        const rooms = (hostel as any)?.rooms;

        // If we have physical rooms, show them
        if (Array.isArray(rooms) && rooms.length > 0) {
            return rooms.map((room: any, index: number) => {
                // Find the matching room type to get price and other details
                const matchingType = hostel.roomTypes?.find(
                    (rt) => String(rt.id ?? '') === String(room.roomTypeId ?? '')
                );

                const capacity = room.capacity ?? matchingType?.capacity ?? parseCapacityFromName(matchingType?.name ?? room.roomType ?? room.type);
                const fallbackId = room.id ?? `room-${index}`;
                const typeName = matchingType?.name ?? room.roomType ?? room.type ?? hostel.roomTypes?.[0]?.name ?? 'Room';
                const occupancyFromBookings = roomOccupancy[fallbackId] ?? room.currentOccupancy ?? 0;

                return {
                    id: fallbackId,
                    label: room.roomNumber ?? room.number ?? room.name ?? `Room ${index + 1}`,
                    type: typeName,
                    price: matchingType?.price ?? room.price ?? hostel.priceRange?.min ?? 0,
                    occupancy: occupancyFromBookings,
                    capacity: capacity ?? null,
                    gender: room.gender ?? hostel.gender ?? 'Mixed',
                    image: room.image ?? room.imageUrl ?? primaryImages[index % primaryImages.length],
                };
            });
        }

        // Fallback: show room types as cards (for hostels without physical rooms)
        const types = hostel.roomTypes ?? [];
        if (types.length === 0) {
            return [];
        }

        return types.map((roomType, typeIndex) => {
            const capacity = roomType.capacity ?? parseCapacityFromName(roomType.name);
            const roomTypeId = roomType.id ?? `roomType-${typeIndex}`;
            const confirmedOccupants = roomOccupancy[roomTypeId] ?? roomOccupancy[roomType.name] ?? 0;

            return {
                id: roomTypeId,
                label: roomType.name,
                type: roomType.name,
                price: roomType.price,
                occupancy: confirmedOccupants,
                capacity,
                gender: hostel.gender ?? 'Mixed',
                image: primaryImages[typeIndex % primaryImages.length],
            };
        });
    }, [hostel, primaryImages, roomOccupancy]);

    type SharePlatform = 'whatsapp' | 'twitter' | 'facebook' | 'copy';

    const handleShare = (platform: SharePlatform) => {
        if (!shareUrl) return;
        const encodedUrl = encodeURIComponent(shareUrl);
        const message = encodeURIComponent(`Check out ${hostel.name} on HostelHQ`);

        if (platform === 'copy') {
            if (typeof navigator !== 'undefined' && navigator?.clipboard) {
                navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => setShareCopied(true))
                    .catch(() => toast({ title: 'Unable to copy link', variant: 'destructive' }));
            }
            return;
        }

        let url = '';
        switch (platform) {
            case 'whatsapp':
                url = `https://wa.me/?text=${message}%20${encodedUrl}`;
                break;
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${message}&url=${encodedUrl}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
        }

        if (url && typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const handleReviewCTA = () => {
        if (currentUser) {
            router.push(`/hostels/${hostel.id}/book/rating`);
        } else {
            router.push('/login');
        }
    };


    const getRoomAvailabilityVariant = (availability: RoomType['availability']) => {
        switch (availability) {
            case 'Available': return 'default';
            case 'Limited': return 'secondary';
            case 'Full': return 'destructive';
            default: return 'outline';
        }
    }

    const handleLoginRedirect = () => {
        toast({
            title: "Please Log In",
            description: "You need to be logged in as a student to request a visit or secure a room.",
            variant: "default",
        });
        router.push(`/login?redirect=/hostels/${hostel.id}`);
    };

    const getVisitButton = (room: RoomType) => {
        if (!currentUser) {
            return (
                <Button
                    variant="outline"
                    size="sm"
                    disabled={room.availability === 'Full'}
                    onClick={handleLoginRedirect}
                    className="rounded-xl text-xs font-semibold"
                >
                    Request Visit
                </Button>
            );
        }

        // If the hostel is marked Full by admin, block all room-level CTAs
        if (hostel.availability === 'Full') {
            return (
                <Button
                    size="sm"
                    className="bg-muted text-muted-foreground cursor-not-allowed w-full justify-center text-xs"
                    disabled
                >
                    Hostel Full
                </Button>
            );
        }

        // First check if hostel is already secured
        if (existingBooking !== undefined && existingBooking !== null) {
            const isSecuredRoom = existingBooking.roomTypeId === room.id;
            return (
                <Button
                    size="sm"
                    disabled
                    className="bg-emerald-600 hover:bg-emerald-600 text-white cursor-not-allowed text-xs"
                >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    {isSecuredRoom ? 'Hostel Secured' : 'Room Secured'}
                </Button>
            );
        }

        if (existingVisit === undefined) {
            return (
                <Button variant="outline" size="sm" disabled className="text-xs">
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking...
                </Button>
            );
        }

        if (existingVisit) {
            // Only show Secure Room if visit is completed AND student has marked it complete
            if (existingVisit.status === 'completed' && existingVisit.studentCompleted === true) {
                return (
                    <Button
                        size="sm"
                        disabled={room.availability === 'Full'}
                        onClick={() => router.push(`/hostels/${hostel.id}/secure?roomTypeId=${room.id}`)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-bold"
                    >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Secure Room
                    </Button>
                );
            }
            // If visit exists but not completed, show Track Visit
            if (existingVisit.status !== 'cancelled') {
                return (
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                    >
                        <Ticket className="mr-1.5 h-3.5 w-3.5" />
                        Track Visit
                    </Button>
                );
            }
        }

        return (
            <Button
                variant="outline"
                size="sm"
                disabled={room.availability === 'Full'}
                onClick={() => router.push(`/hostels/${hostel.id}/book?roomTypeId=${room.id}`)}
                className="rounded-xl text-xs font-semibold hover:bg-primary hover:text-white transition-colors"
            >
                Request Visit
            </Button>
        );
    };

    // Mobile Sticky Container
    const renderMobileStickyCTA = () => {
        const canSecure = existingVisit && existingVisit.status === 'completed' && existingVisit.studentCompleted === true;

        return (
            <div className="fixed bottom-0 left-0 right-0 z-40 p-4 lg:hidden bg-background/95 backdrop-blur-xl border-t border-border shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
                <div className="container mx-auto flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Starting from</span>
                        <div className="flex items-baseline gap-1 text-primary">
                            <span className="text-xs font-bold">GH₵</span>
                            <span className="text-xl font-bold">{(hostel.priceRange?.min || hostel.price || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">/yr</span>
                        </div>
                    </div>
                    <div>
                        {!currentUser ? (
                            <Button
                                onClick={handleLoginRedirect}
                                className="rounded-2xl px-6 bg-primary text-primary-foreground font-bold shadow-md text-xs h-11"
                            >
                                Request Free Visit
                            </Button>
                        ) : hostel.availability === 'Full' ? (
                            <Button disabled variant="secondary" className="rounded-2xl px-6 text-xs h-11">Hostel Full</Button>
                        ) : existingBooking ? (
                            <Button
                                onClick={() => router.push(`/my-bookings`)}
                                className="rounded-2xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md text-xs h-11"
                            >
                                Secured ✓
                            </Button>
                        ) : canSecure ? (
                            <Button
                                onClick={() => router.push(`/hostels/${hostel.id}/secure`)}
                                className="rounded-2xl px-6 bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-md text-xs h-11"
                            >
                                Secure Room
                            </Button>
                        ) : (existingVisit && existingVisit.status !== 'completed' && existingVisit.status !== 'cancelled') ? (
                            <Button
                                onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                                className="rounded-2xl px-6 bg-primary text-primary-foreground font-bold shadow-md text-xs h-11"
                            >
                                Track Visit
                            </Button>
                        ) : (
                            <Button
                                onClick={() => router.push(`/hostels/${hostel.id}/book`)}
                                className="rounded-2xl px-6 bg-primary text-primary-foreground font-bold shadow-md text-xs h-11"
                            >
                                Request Free Visit
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderPrice = () => {
        const priceStyle = "text-3xl font-extrabold";
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className={priceStyle}>GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>;
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
            return <span className={priceStyle}>GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
            <span className="text-2xl sm:text-3xl font-extrabold">
                GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
            </span>
        );
    };

    const getPrimaryCTA = () => {
        if (!currentUser) {
            return (
                <Button
                    size="lg"
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 rounded-2xl"
                    onClick={handleLoginRedirect}
                >
                    Log In to Request Free Visit
                </Button>
            );
        }

        // If the hostel is marked Full by admin, block all CTAs
        if (hostel.availability === 'Full') {
            return (
                <Button
                    size="lg"
                    className="w-full h-14 rounded-2xl"
                    variant="secondary"
                    disabled
                    title="This hostel is fully booked"
                >
                    Hostel Fully Booked
                </Button>
            );
        }

        // First check if hostel is already secured (takes priority)
        if (existingBooking !== undefined && existingBooking !== null) {
            return (
                <div className="space-y-3">
                    <Button
                        size="lg"
                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-600 text-white cursor-not-allowed rounded-2xl font-bold"
                        disabled
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Hostel Secured
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl text-xs"
                            onClick={() => router.push(`/invoice/${existingBooking.id}`)}
                        >
                            <FileText className="mr-1.5 h-4 w-4" />
                            Invoice
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl text-xs"
                            onClick={() => router.push(`/agreement/${existingBooking.id}`)}
                        >
                            <FileText className="mr-1.5 h-4 w-4" />
                            Agreement
                        </Button>
                    </div>
                </div>
            );
        }

        if (existingVisit === undefined) {
            return (
                <Button size="lg" className="w-full h-14 rounded-2xl" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking Status...
                </Button>
            );
        }

        if (existingVisit && existingVisit.status !== 'completed' && existingVisit.status !== 'cancelled') {
            return (
                <Button
                    size="lg"
                    className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold"
                    onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                >
                    <Ticket className="mr-2 h-5 w-5" />
                    Track Your Visit
                </Button>
            );
        }

        // After a fully completed visit, guide the student to secure a specific room
        if (existingVisit?.status === 'completed' && existingVisit?.studentCompleted === true) {
            const roomTypes = hostel.roomTypes || [];

            if (roomTypes.length === 1 && roomTypes[0]?.id) {
                return (
                    <Button
                        size="lg"
                        className="w-full h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl font-bold shadow-lg"
                        onClick={() => router.push(`/hostels/${hostel.id}/secure?roomTypeId=${roomTypes[0].id}`)}
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Secure This Room
                    </Button>
                );
            }

            if (roomTypes.length > 1) {
                return (
                    <Button
                        size="lg"
                        className="w-full h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl font-bold shadow-lg"
                        onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Select Room to Secure
                    </Button>
                );
            }

            return (
                <Button
                    size="lg"
                    className="w-full h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl font-bold shadow-lg"
                    onClick={() => router.push(`/hostels/${hostel.id}/secure`)}
                >
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Secure This Hostel
                </Button>
            );
        }

        return (
            <Button
                size="lg"
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20"
                onClick={() => router.push(`/hostels/${hostel.id}/book`)}
            >
                Request a Free Visit
            </Button>
        );
    };

    const renderAirbnbGallery = () => {
        const images = primaryImages.length > 0 ? primaryImages : ['/AAMUSTED-Full-shot.jpeg'];

        return (
            <>
                {/* Desktop Grid Layout (Airbnb Style) */}
                <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 gap-3 h-[420px] lg:h-[480px] rounded-3xl overflow-hidden relative group">
                    {/* Hero Image (Left 2 cols, 2 rows) */}
                    <div
                        className="col-span-2 row-span-2 relative cursor-pointer overflow-hidden bg-muted"
                        onClick={() => setRoomsDialogOpen(true)}
                    >
                        <Image
                            src={images[0]}
                            alt={`${hostel.name} main photo`}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            priority
                            sizes="(max-width: 1024px) 50vw, 50vw"
                        />
                    </div>

                    {/* 4 Thumbnails (Right 2 cols, 2x2) */}
                    {Array.from({ length: 4 }).map((_, i) => {
                        const img = images[i + 1] || images[0];
                        return (
                            <div
                                key={i}
                                className="relative cursor-pointer overflow-hidden bg-muted"
                                onClick={() => setRoomsDialogOpen(true)}
                            >
                                <Image
                                    src={img}
                                    alt={`${hostel.name} detail photo ${i + 2}`}
                                    fill
                                    className="object-cover transition-transform duration-700 hover:scale-110"
                                    sizes="(max-width: 1024px) 25vw, 25vw"
                                />
                            </div>
                        );
                    })}

                    {/* Show All Photos Floating Pill Button */}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRoomsDialogOpen(true)}
                        className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md hover:bg-background text-foreground shadow-lg border border-border/60 rounded-xl font-bold gap-2 px-4 py-2 text-xs"
                    >
                        <Grid className="h-4 w-4" />
                        Show all {images.length} photos
                    </Button>
                </div>

                {/* Mobile Gallery Layout */}
                <div className="md:hidden relative h-[280px] sm:h-[340px] rounded-2xl overflow-hidden group">
                    <Image
                        src={images[0]}
                        alt={hostel.name}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* Photo count indicator pill */}
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/20">
                        <ImagePlus className="h-3.5 w-3.5" />
                        <span>1 / {images.length} photos</span>
                    </div>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRoomsDialogOpen(true)}
                        className="absolute bottom-4 right-4 bg-white/90 text-black hover:bg-white text-xs font-bold rounded-xl shadow-md"
                    >
                        View Photos
                    </Button>
                </div>

                {/* Full Photos Dialog */}
                <Dialog open={roomsDialogOpen} onOpenChange={setRoomsDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl font-bold font-headline">{hostel.name} — Photo Gallery</DialogTitle>
                            <DialogDescription>
                                High resolution photos of bedrooms, common study rooms, and amenities.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {images.map((img, index) => (
                                <div key={index} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 bg-muted">
                                    <Image
                                        src={img}
                                        alt={`${hostel.name} photo ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md">
                                        Photo {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    };

    return (
        <div className="space-y-8 pb-32 lg:pb-16 relative">
            {/* Mobile Sticky CTA Bar */}
            {renderMobileStickyCTA()}

            {/* Back Button & Share Top Row */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-2 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors pr-4"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Hostels
                </Button>

                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-2 border-border/70 text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => setShareMenuOpen((open) => !open)}
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                    </Button>
                    {shareMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl z-50 p-2 border-border/60">
                            <button
                                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-xs font-semibold hover:bg-muted rounded-xl transition-colors"
                                onClick={() => { setShareMenuOpen(false); handleShare('whatsapp'); }}
                            >
                                <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                                    <MessageCircle className="h-4 w-4" />
                                </div>
                                <span>WhatsApp</span>
                            </button>
                            <button
                                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-xs font-semibold hover:bg-muted rounded-xl transition-colors"
                                onClick={() => { setShareMenuOpen(false); handleShare('twitter'); }}
                            >
                                <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <Twitter className="h-4 w-4" />
                                </div>
                                <span>Twitter</span>
                            </button>
                            <button
                                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-xs font-semibold hover:bg-muted rounded-xl transition-colors"
                                onClick={() => { setShareMenuOpen(false); handleShare('copy'); }}
                            >
                                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", shareCopied ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                                    {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </div>
                                <span>{shareCopied ? 'Copied!' : 'Copy Link'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Title + Key-Facts Row Directly Beneath Gallery (Full Width) */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-headline tracking-tight text-foreground">
                        {hostel.name}
                    </h1>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 px-3 py-1 text-xs gap-1.5 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" /> University-Approved ✓
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn("text-xs font-bold uppercase tracking-wider px-3 py-1", currentAvailability.className)}
                    >
                        {currentAvailability.text}
                    </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-foreground">
                            {reviewStats.total > 0 ? reviewAverage.toFixed(1) : "New"}
                        </span>
                        <span>
                            ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
                        </span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{hostel.location}</span>
                    </div>
                    {hostel.distanceToUniversity && (
                        <>
                            <span>•</span>
                            <div className="flex items-center gap-1.5 text-primary font-medium">
                                <Clock className="h-4 w-4" />
                                <span>{hostel.distanceToUniversity} from campus</span>
                            </div>
                        </>
                    )}
                    {hostel.institution && (
                        <>
                            <span>•</span>
                            <Badge variant="secondary" className="font-semibold text-xs">
                                {hostel.institution}
                            </Badge>
                        </>
                    )}
                    {hostel.gender && (
                        <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                                {hostel.gender} Students Only
                            </Badge>
                        </>
                    )}
                </div>
            </div>

            {/* Airbnb-style Photo Gallery */}
            {renderAirbnbGallery()}

            {/* Two-Column Body below the gallery */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-8 lg:gap-12 items-start mt-8">
                {/* Left Column (Scrollable content) */}
                <div className="space-y-10 min-w-0">
                    {/* 1. About Description */}
                    <div className="rounded-3xl p-6 sm:p-8 border border-border/70 bg-card/60 backdrop-blur-sm space-y-6">
                        <h3 className="text-xl font-extrabold font-headline flex items-center gap-2.5">
                            <BookOpen className="h-5 w-5 text-primary" />
                            About this Hostel
                        </h3>
                        <p className="text-base text-foreground/80 leading-relaxed font-normal">
                            {hostel.description}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                            {hostel.institution && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/40 rounded-xl border border-secondary/30 text-xs font-semibold text-secondary-foreground">
                                    <Building className="h-4 w-4" />
                                    <span>Affiliated with {hostel.institution}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 text-xs font-semibold text-primary">
                                <UsersIcon className="h-4 w-4" />
                                <span>{hostel.gender} Students Only</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* 2. Spotahome-style Room Types Mini-Listings */}
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                            <div>
                                <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                                    <Bed className="h-6 w-6 text-primary" />
                                    Available Room Types
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Individual layouts, amenities, and annual rates per room type.
                                </p>
                            </div>
                            {(hostel.roomTypes?.length ?? 0) > 1 && (
                                <Link
                                    href={`/hostels/${hostel.id}/rooms`}
                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
                                >
                                    Compare side-by-side <ChevronRight className="h-4 w-4" />
                                </Link>
                            )}
                        </div>

                        <div className="grid gap-5">
                            {(hostel.roomTypes && hostel.roomTypes.length > 0) ? (
                                hostel.roomTypes.map((room, idx) => {
                                    const roomImg = room.image || primaryImages[(idx + 1) % primaryImages.length] || primaryImages[0];
                                    return (
                                        <div
                                            key={room.id || idx}
                                            className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-sm p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
                                        >
                                            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center w-full md:w-auto">
                                                <div className="relative h-28 w-full sm:w-36 rounded-2xl overflow-hidden shrink-0 bg-muted">
                                                    <Image
                                                        src={roomImg}
                                                        alt={room.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <h4 className="text-lg font-bold text-foreground font-headline">{room.name}</h4>
                                                        <Badge
                                                            variant={getRoomAvailabilityVariant(room.availability)}
                                                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                                                        >
                                                            {room.availability}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                                                        {room.capacity && (
                                                            <span className="flex items-center gap-1">
                                                                <UsersIcon className="h-3.5 w-3.5 text-primary" /> {room.capacity} Student{room.capacity > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {room.beds && (
                                                            <span className="flex items-center gap-1">
                                                                <Bed className="h-3.5 w-3.5 text-primary" /> {room.beds} Bed{room.beds > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {room.bathrooms && (
                                                            <span className="flex items-center gap-1">
                                                                <Bath className="h-3.5 w-3.5 text-primary" /> {room.bathrooms} Bath
                                                            </span>
                                                        )}
                                                    </div>

                                                    {room.amenities && room.amenities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {room.amenities.slice(0, 3).map((am, i) => (
                                                                <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground font-medium">
                                                                    {am}
                                                                </span>
                                                            ))}
                                                            {room.amenities.length > 3 && (
                                                                <span className="text-[10px] text-muted-foreground font-medium self-center">
                                                                    +{room.amenities.length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full md:w-auto gap-3 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/50">
                                                <div className="text-left sm:text-right">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Annual Rate</p>
                                                    <p className="text-xl font-extrabold text-primary">GH₵{room.price.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    {getVisitButton(room)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 rounded-3xl border border-dashed text-center text-muted-foreground">
                                    <p>Contact manager for room specifications and current availability.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* 3. Amenities Icon Grid */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <Sparkles className="h-6 w-6 text-primary" />
                            Hostel Amenities
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                            {hostel.amenities.map((amenity: string) => {
                                const key = amenity.toLowerCase().replace(/\s+/g, '-');
                                const icon = amenityIcons[key] || <DoorOpen className="h-5 w-5" />;
                                return (
                                    <div
                                        key={amenity}
                                        className="flex items-center gap-3 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-colors"
                                    >
                                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                                            {icon}
                                        </div>
                                        <span className="text-xs font-semibold text-foreground leading-tight">
                                            {amenity}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* 4. Financial Breakdown */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <Receipt className="h-6 w-6 text-primary" />
                            Bills & Utilities Included
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-5 bg-emerald-500/10 dark:bg-emerald-950/20 rounded-3xl border border-emerald-500/20 space-y-3">
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Included in Rent
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {hostel.billsIncluded && hostel.billsIncluded.length > 0 ? (
                                        hostel.billsIncluded.map((bill) => (
                                            <Badge key={bill} variant="outline" className="bg-background/80 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs py-1">
                                                {bill}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Water & regular waste sanitation included</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-5 bg-amber-500/10 dark:bg-amber-950/20 rounded-3xl border border-amber-500/20 space-y-3">
                                <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Extra / Pay-As-You-Go
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {hostel.billsExcluded && hostel.billsExcluded.length > 0 ? (
                                        hostel.billsExcluded.map((bill) => (
                                            <Badge key={bill} variant="outline" className="bg-background/80 border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs py-1">
                                                {bill}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Electricity prepaid meter per room</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                            HostelHQ operates with 100% transparent pricing — zero hidden middleman fees or viewing charges.
                        </p>
                    </div>

                    <Separator />

                    {/* 5. Security & Safety */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            Security & Building Safety
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {(hostel.securityAndSafety && hostel.securityAndSafety.length > 0
                                ? hostel.securityAndSafety
                                : ['24/7 Security Personnel', 'Gated Perimeter Fence', 'Fire Extinguishers on Each Floor', 'Emergency Contact Access']
                            ).map((item) => (
                                <div key={item} className="flex items-center gap-3 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
                                    <div className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                                    <span className="text-xs font-semibold text-foreground/90">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* 6. Location & Campus Proximity Map */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                                <MapPin className="h-6 w-6 text-primary" />
                                Location & Campus Proximity
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {hostel.location} {hostel.distanceToUniversity ? `• ${hostel.distanceToUniversity} from campus` : ''}
                            </p>
                        </div>

                        <div className="h-[360px] sm:h-[420px] rounded-3xl overflow-hidden border border-border/70 shadow-sm relative">
                            <MapboxMap hostelLocation={hostel} />
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl border border-border/40">
                                <Compass className="h-4 w-4 text-primary" />
                                <span>Walking distance to university faculties & shuttle stop</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl border border-border/40">
                                <Building className="h-4 w-4 text-primary" />
                                <span>Surrounded by student cafeterias, marts, and study centers</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* 7. Student Reviews Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-2xl font-extrabold font-headline tracking-tight">Student Feedback & Reviews</h3>
                                <p className="text-sm text-muted-foreground">Authentic reviews from verified students who inspected or stayed at this hostel.</p>
                            </div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'} collected
                            </span>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                            <Card className="border border-border/60 shadow-sm rounded-3xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xl font-headline">Review Summary</CardTitle>
                                    <CardDescription>Verified HostelHQ student evaluations</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="text-center sm:text-left space-y-2">
                                            <div className="text-5xl font-extrabold text-foreground">
                                                {reviewStats.total > 0 ? reviewAverage.toFixed(1) : "—"}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                                            </p>
                                            <div className="flex justify-center sm:justify-start gap-1 text-amber-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-5 w-5 ${i < roundedAverage ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            {reviewStats.breakdown.map((row) => (
                                                <div key={row.star} className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground min-w-[32px]">
                                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                        {row.star}
                                                    </div>
                                                    <Progress value={row.percentage} className="h-2 flex-1 bg-muted" />
                                                    <span className="w-10 text-right text-xs text-muted-foreground">{row.percentage}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-[minmax(0,150px)_1fr]">
                                        <Select value={selectedRating} onValueChange={setSelectedRating}>
                                            <SelectTrigger className="bg-background rounded-xl">
                                                <SelectValue placeholder="Rating" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[5, 4, 3, 2, 1].map(value => (
                                                    <SelectItem key={value} value={value.toString()}>
                                                        {value} Star{value === 1 ? '' : 's'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Textarea
                                            value={draftReview}
                                            onChange={(event) => setDraftReview(event.target.value)}
                                            placeholder="Share your experience inspecting or staying here..."
                                            className="min-h-[90px] rounded-xl"
                                        />
                                    </div>
                                    <Button className="w-full justify-between rounded-xl" onClick={handleReviewCTA}>
                                        {currentUser ? 'Continue to review submission' : 'Login to post review'}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="border border-primary/20 bg-primary/5 shadow-sm rounded-3xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-semibold text-primary">Price starts at</CardTitle>
                                    <CardDescription>Direct approved rates guaranteed</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div>
                                        <p className="text-3xl font-extrabold text-primary">
                                            {hostel.priceRange?.min
                                                ? `GH₵${hostel.priceRange.min.toLocaleString()}`
                                                : hostel.price
                                                    ? `GH₵${hostel.price.toLocaleString()}`
                                                    : 'Contact for rates'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1 text-amber-400">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={`price-rating-${i}`}
                                                    className={`h-4 w-4 ${i < roundedAverage ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                                                />
                                            ))}
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {reviewStats.total > 0 ? `${reviewAverage.toFixed(1)} / 5.0` : 'No ratings yet'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="rounded-xl border border-primary/20 bg-background/80 p-3">
                                            <p className="uppercase tracking-wide text-[10px] text-primary/80 font-bold">Payments</p>
                                            <p className="font-semibold text-primary mt-1">Mobile Money, Card</p>
                                        </div>
                                        <div className="rounded-xl border border-primary/20 bg-background/80 p-3">
                                            <p className="uppercase tracking-wide text-[10px] text-primary/80 font-bold">Support</p>
                                            <p className="font-semibold text-primary mt-1">University Helpdesk</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-base font-bold">Latest Reviews</h4>
                            {(hostel.reviews && hostel.reviews.length > 0) ? (
                                <div className="space-y-4">
                                    {hostel.reviews.map((review) => (
                                        <div key={review.id} className="flex gap-4 rounded-2xl border border-border/50 bg-background/80 p-4">
                                            <Avatar>
                                                {review.userProfileImage ? (
                                                    <AvatarImage src={review.userProfileImage} alt={review.studentName} />
                                                ) : (
                                                    <AvatarFallback>{review.studentName.charAt(0)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-sm">{review.studentName}</p>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(review.createdAt), 'PP')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={`${review.id}-${i}`}
                                                            className={`h-3.5 w-3.5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                                                        />
                                                    ))}
                                                </div>
                                                <p className="text-sm leading-relaxed text-foreground/80">{review.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No reviews yet. Be the first to share your experience staying at {hostel.name}.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column (Desktop Sticky Booking & Pricing Card) */}
                <div className="hidden lg:block sticky top-24 self-start space-y-6">
                    <div className="rounded-[2.5rem] p-7 border border-border/70 bg-card/90 backdrop-blur-xl shadow-xl space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Starting from</span>
                                <div className="flex items-baseline gap-1 text-foreground">
                                    {renderPrice()}
                                    <span className="text-xs font-bold text-muted-foreground">/ yr</span>
                                </div>
                            </div>
                            <Badge
                                variant="outline"
                                className={cn("text-[10px] font-bold uppercase tracking-wider px-3 py-1", currentAvailability.className)}
                            >
                                {currentAvailability.text}
                            </Badge>
                        </div>

                        <Separator />

                        {/* Primary Action Button */}
                        <div className="space-y-3">
                            {getPrimaryCTA()}
                            {(hostel.roomTypes?.length ?? 0) > 1 && (
                                <Button
                                    variant="outline"
                                    className="w-full h-12 rounded-2xl font-bold text-xs"
                                    onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                                >
                                    Compare All {hostel.roomTypes?.length} Room Options
                                </Button>
                            )}
                        </div>

                        {/* University Oversight & Direct Booking Guarantees */}
                        <div className="rounded-2xl bg-muted/50 border border-border/60 p-4 space-y-3">
                            <div className="flex items-start gap-2.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-foreground">University-Approved Listing</p>
                                    <p className="text-[11px] text-muted-foreground">Inspected and certified for student safety and standard accommodation.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-foreground">Zero Middleman Viewing Fees</p>
                                    <p className="text-[11px] text-muted-foreground">In-person inspections are 100% free with direct manager scheduling.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <Lock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-foreground">Payment Protection Escrow</p>
                                    <p className="text-[11px] text-muted-foreground">Payments via Mobile Money & Card are verified with official university invoice.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span className="flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-primary" /> MoMo / Card Accepted
                            </span>
                            <button
                                onClick={() => handleShare('copy')}
                                className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                            >
                                {shareCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
                                {shareCopied ? 'Copied Link' : 'Share'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LimitedHostelDetails({ hostel }: { hostel: Hostel }) {
    const { toast } = useToast();

    const handleLoginRedirect = () => {
        toast({
            title: "Please Log In",
            description: "You need to be logged in as a student to secure a hostel.",
            variant: "default",
        });
        router.push('/login');
    };

    const renderPrice = () => {
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className="text-4xl font-bold text-destructive">GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
            return <span className="text-4xl font-bold text-destructive">GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
            <span className="text-4xl font-bold text-destructive">
                GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
            </span>
        );
    };

    return (
        <div className="grid lg:grid-cols-[1fr_0.42fr] gap-8 lg:gap-16 relative">
            <div className="order-2 lg:order-1 space-y-12">
                <div className="relative group h-[350px] sm:h-[450px] lg:h-[550px] w-full overflow-hidden rounded-[2.5rem] shadow-2xl">
                    <Image
                        src={hostel.images?.[0] || '/AAMUSTED-Full-shot.jpeg'}
                        alt={hostel.name}
                        fill
                        className="object-cover transition-transform duration-1000 group-hover:scale-105"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-10 left-10 right-10 flex flex-col items-start">
                        <Badge className="bg-accent text-accent-foreground mb-4 font-bold border-0">Limited Preview</Badge>
                        <h1 className="text-white text-4xl sm:text-5xl font-extrabold font-headline mb-4 drop-shadow-xl">{hostel.name}</h1>
                        <div className="flex items-center text-white/90 gap-4 mb-6">
                            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-bold">{hostel.rating.toFixed(1)}</span>
                                <span className="text-xs opacity-70">({hostel.numberOfReviews} reviews)</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                <MapPin className="h-4 w-4" />
                                <span className="text-sm font-medium">{hostel.location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-premium rounded-[2.5rem] p-10 border border-white/40 shadow-premium">
                    <h3 className="text-2xl font-extrabold font-headline mb-6 tracking-tight flex items-center gap-3">
                        <div className="h-8 w-1.5 bg-primary rounded-full" />
                        Hostel Highlights
                    </h3>
                    <p className="text-lg text-foreground/80 leading-relaxed font-medium mb-10">
                        {hostel.description}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {(hostel.amenities ?? []).slice(0, 4).map((amenity: string) => (
                            <div key={amenity} className="flex flex-col items-center p-6 bg-secondary/10 rounded-[2rem] border border-secondary/20">
                                <div className="p-3 bg-secondary/20 rounded-2xl mb-3 text-secondary-foreground">
                                    {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <DoorOpen className="h-6 w-6" />}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-center text-secondary-foreground">{amenity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="rounded-[2.5rem] border-primary/20 bg-primary/5 overflow-hidden border-2 border-dashed">
                    <CardContent className="p-10 flex flex-col items-center text-center">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <Lock className="h-8 w-8 text-primary" />
                        </div>
                        <h4 className="text-2xl font-bold mb-3">Unlock Restricted Content</h4>
                        <p className="text-muted-foreground mb-8 max-w-md">
                            Join thousands of students on HostelHQ. Get access to detailed room prices, high-quality photo galleries, and direct booking options.
                        </p>
                        <Button
                            className="bg-primary text-white h-14 px-10 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                            onClick={handleLoginRedirect}
                        >
                            Log In as Student
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col lg:sticky lg:top-32 h-fit space-y-6">
                <div className="glass-premium p-8 rounded-[2.5rem] border border-white/40 shadow-2xl space-y-8">
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground">Investment</p>
                        <div className="flex items-baseline gap-2">
                            {renderPrice()}
                            <span className="text-muted-foreground">/per year</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100 text-green-800">
                            <ShieldCheck className="h-5 w-5" />
                            <span className="text-sm font-bold">Verified Hostel Listing</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800">
                            <Badge className="bg-blue-600 text-white border-0 h-5 w-5 flex items-center justify-center p-0 rounded-full">✓</Badge>
                            <span className="text-sm font-bold">Safe & Secure Booking</span>
                        </div>
                    </div>

                    {hostel.availability === 'Full' ? (
                        <Button
                            size="lg"
                            className="w-full h-16 rounded-[1.25rem] text-lg font-bold"
                            variant="secondary"
                            disabled
                        >
                            Currently Full
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            className="w-full h-16 rounded-[1.25rem] text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-xl shadow-accent/10"
                            onClick={handleLoginRedirect}
                        >
                            Secure My Place
                        </Button>
                    )}

                    <Separator className="opacity-50" />

                    <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                        <p className="text-xs text-center text-muted-foreground font-medium">
                            Need help? <Link href="/help-center" className="text-primary font-bold hover:underline">Contact Support</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default function HostelDetailPage() {
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [loading, setLoading] = useState(true);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const routeParams = useParams();
    const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;

    useEffect(() => {
        const fetchHostelData = async () => {
            if (id) {
                const hostelData = await getHostel(id);
                if (hostelData) {
                    setHostel(hostelData);
                } else {
                    notFound();
                }
            }
            setLoading(false);
        };
        fetchHostelData();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setAppUser({
                        uid: user.uid,
                        email: user.email!,
                        fullName: userData.fullName,
                        role: userData.role,
                        profileImage: userData.profileImage, // Fetch profile image
                    });
                } else {
                    // If user not in 'users', check 'pendingUsers'
                    const pendingUserDocRef = doc(db, "pendingUsers", user.uid);
                    const pendingUserDocSnap = await getDoc(pendingUserDocRef);
                    if (pendingUserDocSnap.exists()) {
                        const userData = pendingUserDocSnap.data();
                        setAppUser({
                            uid: user.uid,
                            email: user.email!,
                            fullName: userData.fullName,
                            role: userData.role,
                            profileImage: userData.profileImage, // Fetch profile image
                        });
                    } else {
                        setAppUser(null);
                    }
                }
            } else {
                setAppUser(null);
            }
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, [id]);


    if (loading || !authChecked) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </main>
            </div>
        )
    }

    if (!hostel) {
        notFound();
    }

    const isStudent = appUser?.role === 'student';

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 py-6 lg:py-8">
                <FullHostelDetails hostel={hostel} currentUser={appUser} />
            </main>
        </div>
    );
}
