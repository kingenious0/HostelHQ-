

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User, ShieldCheck, Ticket, FileText, Share2, MessageCircle, Twitter, Facebook, Copy, Check, ArrowRight, Users as UsersIcon, Smartphone, CreditCard, ImagePlus, Receipt, AlertTriangle, ArrowLeft } from 'lucide-react';
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
    role: 'student' | 'agent' | 'admin';
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

    const getVisitButton = (room: RoomType) => {
        // If the hostel is marked Full by admin, block all room-level CTAs
        if (hostel.availability === 'Full') {
            return (
                <Button
                    size="sm"
                    className="bg-muted text-muted-foreground cursor-not-allowed w-full justify-center"
                    disabled
                >
                    Hostel Fully Booked
                </Button>
            );
        }

        // First check if hostel is already secured
        if (existingBooking !== undefined && existingBooking !== null) {
            // Check if this room type matches the secured room
            const isSecuredRoom = existingBooking.roomTypeId === room.id;
            return (
                <Button
                    size="sm"
                    disabled
                    className="bg-green-600 hover:bg-green-600 text-white cursor-not-allowed"
                >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {isSecuredRoom ? 'Hostel Secured' : 'Room Secured'}
                </Button>
            );
        }

        if (existingVisit === undefined) {
            return <Button variant="outline" size="sm" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</Button>;
        }

        if (existingVisit) {
            // Only show Secure Room if visit is completed AND student has marked it complete
            if (existingVisit.status === 'completed' && existingVisit.studentCompleted === true) {
                return (
                    <Button
                        size="sm"
                        disabled={room.availability === 'Full'}
                        onClick={() => router.push(`/hostels/${hostel.id}/secure?roomTypeId=${room.id}`)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                        <ShieldCheck className="mr-2 h-4 w-4" />
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
                        onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                    >
                        <Ticket className="mr-2 h-4 w-4" />
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
                className="rounded-xl"
            >
                Book Visit
            </Button>
        );
    }

    // Mobile Sticky Container
    const renderMobileStickyCTA = () => {
        return (
            <div className="fixed bottom-20 left-0 z-40 w-full p-4 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="glass-premium rounded-[2.5rem] p-4 shadow-2xl flex items-center justify-between gap-4 border border-white/80">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Starting from</span>
                        <div className="flex items-baseline gap-1 text-primary">
                            <span className="text-xs font-bold">GH₵</span>
                            <span className="text-xl font-bold">{(hostel.priceRange?.min || hostel.price || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    {hostel.availability === 'Full' ? (
                        <Button disabled variant="secondary" className="rounded-2xl px-6">Full</Button>
                    ) : existingBooking ? (
                        <Button
                            onClick={() => router.push(`/my-bookings`)}
                            className="rounded-2xl px-8 bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20"
                        >
                            Secured
                        </Button>
                    ) : (existingVisit && existingVisit.status !== 'completed' && existingVisit.status !== 'cancelled') ? (
                        <Button
                            onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}
                            className="rounded-2xl px-8 bg-primary text-white font-bold shadow-lg shadow-primary/20"
                        >
                            Track Visit
                        </Button>
                    ) : (
                        <Button
                            onClick={() => router.push(`/hostels/${hostel.id}/book`)}
                            className="rounded-2xl px-8 bg-primary text-white font-bold shadow-lg shadow-primary/20"
                        >
                            Book Visit
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    const renderPrice = () => {
        const priceStyle = "text-4xl font-bold";
        if (!hostel.priceRange || hostel.priceRange.min === 0) {
            return <span className={priceStyle}>GH₵{hostel.price?.toLocaleString() || 'N/A'}</span>
        }
        if (hostel.priceRange.min === hostel.priceRange.max) {
            return <span className={priceStyle}>GH₵{hostel.priceRange.min.toLocaleString()}</span>;
        }
        return (
            <span className="text-3xl font-bold">
                GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
            </span>
        );
    };

    const getPrimaryCTA = () => {
        // If the hostel is marked Full by admin, block all CTAs
        if (hostel.availability === 'Full') {
            return (
                <Button
                    size="lg"
                    className="w-full mt-6 h-14"
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
                <div className="space-y-3 mt-6">
                    <Button
                        size="lg"
                        className="w-full h-14 bg-green-600 hover:bg-green-600 text-white cursor-not-allowed"
                        disabled
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Hostel Secured
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push(`/invoice/${existingBooking.id}`)}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            View Invoice
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push(`/agreement/${existingBooking.id}`)}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            View Agreement
                        </Button>
                    </div>
                </div>
            );
        }

        if (existingVisit === undefined) {
            return <Button size="lg" className="w-full mt-6 h-14" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking Status...</Button>;
        }

        if (existingVisit && existingVisit.status !== 'completed' && existingVisit.status !== 'cancelled') {
            return (
                <Button size="lg" className="w-full mt-6 h-14 bg-primary text-primary-foreground" onClick={() => router.push(`/hostels/${hostel.id}/book/tracking?visitId=${existingVisit.id}`)}>
                    <Ticket className="mr-2 h-5 w-5" />
                    Track Your Visit
                </Button>
            );
        }

        // After a fully completed visit, guide the student to secure a specific room
        if (existingVisit?.status === 'completed' && existingVisit?.studentCompleted === true) {
            const roomTypes = hostel.roomTypes || [];

            if (roomTypes.length === 1 && roomTypes[0]?.id) {
                // Single room type: secure that specific room directly
                return (
                    <Button
                        size="lg"
                        className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={() => router.push(`/hostels/${hostel.id}/secure?roomTypeId=${roomTypes[0].id}`)}
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Secure This Room
                    </Button>
                );
            }

            if (roomTypes.length > 1) {
                // Multiple room types: nudge them to view and pick a room to secure
                return (
                    <Button
                        size="lg"
                        className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                    >
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        View available rooms to secure your space
                    </Button>
                );
            }

            // Fallback: if we can't see room types, keep the old hostel-level secure CTA
            return (
                <Button
                    size="lg"
                    className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground"
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
                className="w-full mt-6 h-14 bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => router.push(`/hostels/${hostel.id}/book`)}
            >
                Book a Visit
            </Button>
        );
    };

    return (
        <div className="grid lg:grid-cols-[1fr_0.42fr] gap-8 lg:gap-16 relative pb-32 md:pb-0">
            {renderMobileStickyCTA()}
            <div className="lg:col-span-2 mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-2 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors pr-6"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Hostels
                </Button>
            </div>
            <div className="order-2 lg:order-1 space-y-12">
                {/* Immersive Gallery Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[350px] sm:h-[450px] lg:h-[550px]">
                    <div className="md:col-span-3 relative group overflow-hidden rounded-[2.5rem] shadow-2xl">
                        <Image
                            src={primaryImages[0]}
                            alt={`${hostel.name} main`}
                            fill
                            className="object-cover transition-transform duration-1000 group-hover:scale-105"
                            priority
                        />
                        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-80" />
                        <div className="absolute bottom-8 left-8">
                            <Badge className="bg-white/20 backdrop-blur-md border-white/30 text-white mb-3">Main View</Badge>
                            <h2 className="text-white text-3xl font-bold font-headline drop-shadow-lg">{hostel.name}</h2>
                        </div>
                    </div>
                    <div className="hidden md:grid grid-rows-2 gap-4">
                        {primaryImages.slice(1, 3).map((img, idx) => (
                            <div key={idx} className="relative group overflow-hidden rounded-[2rem] shadow-xl border border-white/20">
                                <Image
                                    src={img}
                                    alt={`${hostel.name} detail ${idx + 1}`}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                {idx === 1 && primaryImages.length > 3 && (
                                    <div
                                        className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer hover:bg-black/50 transition-colors"
                                        onClick={() => setRoomsDialogOpen(true)}
                                    >
                                        <div className="p-3 rounded-full bg-white/20 border border-white/40 mb-2">
                                            <ImagePlus className="text-white h-6 w-6" />
                                        </div>
                                        <span className="text-white font-bold text-sm">+{primaryImages.length - 3} Photos</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 space-y-10">
                    <div className="glass-premium rounded-[2.5rem] p-10 border border-white/40 shadow-premium overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <BookOpen className="h-40 w-40 text-primary" />
                        </div>
                        <h3 className="text-2xl font-extrabold font-headline mb-6 tracking-tight flex items-center gap-3">
                            <div className="h-8 w-1.5 bg-primary rounded-full" />
                            About this Hostel
                        </h3>
                        <p className="text-lg text-foreground/80 leading-relaxed font-medium mb-8 max-w-3xl">
                            {hostel.description}
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {hostel.institution && (
                                <div className="flex items-center gap-3 px-6 py-3 bg-secondary/30 rounded-2xl border border-secondary/20 transition-all hover:bg-secondary/40">
                                    <User className="h-5 w-5 text-secondary-foreground" />
                                    <span className="text-sm font-bold text-secondary-foreground">{hostel.institution}</span>
                                </div>
                            )}
                            {hostel.distanceToUniversity && (
                                <div className="flex items-center gap-3 px-6 py-3 bg-accent/10 rounded-2xl border border-accent/20 transition-all hover:bg-accent/20">
                                    <Clock className="h-5 w-5 text-accent-foreground" />
                                    <span className="text-sm font-bold text-accent-foreground">{hostel.distanceToUniversity} from Campus</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 transition-all hover:bg-primary/10">
                                <UsersIcon className="h-5 w-5 text-primary" />
                                <span className="text-sm font-bold text-primary">{hostel.gender} Students Only</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <Receipt className="h-6 w-6 text-primary" />
                            Financial Breakdown
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-6">
                            {hostel.billsIncluded && hostel.billsIncluded.length > 0 && (
                                <div className="p-6 bg-green-50/50 rounded-3xl border border-green-100">
                                    <p className="font-bold text-green-800 mb-3 flex items-center gap-2 uppercase text-xs tracking-widest">
                                        <Check className="h-4 w-4" /> Included in Rent
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {hostel.billsIncluded.map(bill => (
                                            <Badge key={bill} variant="outline" className="bg-white border-green-200 text-green-700 rounded-lg">{bill}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hostel.billsExcluded && hostel.billsExcluded.length > 0 && (
                                <div className="p-6 bg-red-50/50 rounded-3xl border border-red-100">
                                    <p className="font-bold text-red-800 mb-3 flex items-center gap-2 uppercase text-xs tracking-widest">
                                        <AlertTriangle className="h-4 w-4" /> Excluded / Extra
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {hostel.billsExcluded.map(bill => (
                                            <Badge key={bill} variant="outline" className="bg-white border-red-200 text-red-700 rounded-lg">{bill}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            Security & Safety
                        </h3>
                        {hostel.securityAndSafety && hostel.securityAndSafety.length > 0 && (
                            <div className="grid sm:grid-cols-2 gap-3">
                                {hostel.securityAndSafety.map(item => (
                                    <div key={item} className="flex items-center gap-3 p-4 bg-white/40 rounded-2xl border border-white/20">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        <span className="text-sm font-semibold text-foreground/80">{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <h3 className="text-2xl font-extrabold font-headline flex items-center gap-3 tracking-tight">
                            <Wifi className="h-6 w-6 text-primary" />
                            Premium Amenities
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {hostel.amenities.map((amenity: string) => (
                                <div key={amenity} className="flex flex-col items-center justify-center p-6 bg-white/40 rounded-[2rem] border border-white/20 hover:border-primary/30 transition-all group/amenity">
                                    <div className="p-3 bg-primary/5 rounded-2xl mb-3 group-hover/amenity:bg-primary group-hover/amenity:text-white transition-colors">
                                        {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <DoorOpen className="h-6 w-6" />}
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-center">{amenity}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-xl font-semibold font-headline">What students are saying</h3>
                                <p className="text-sm text-muted-foreground">Transparent feedback helps you decide faster.</p>
                            </div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'} collected
                            </span>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                            <Card className="border border-border/60 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-2xl font-headline">Customer Review</CardTitle>
                                    <CardDescription>From verified HostelHQ students</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="text-center sm:text-left space-y-2">
                                            <div className="text-5xl font-bold text-foreground">
                                                {reviewAverage.toFixed(1)}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                                            </p>
                                            <div className="flex justify-center sm:justify-start gap-1 text-yellow-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-5 w-5 ${i < roundedAverage ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            {reviewStats.breakdown.map((row) => (
                                                <div key={row.star} className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground min-w-[32px]">
                                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
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
                                            <SelectTrigger className="bg-background">
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
                                            placeholder="Share your experience staying here..."
                                            className="min-h-[110px]"
                                        />
                                    </div>
                                    <Button className="justify-between" onClick={handleReviewCTA}>
                                        {currentUser ? 'Continue to review form' : 'Login to post review'}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                            <Card className="border border-primary/30 bg-primary/5 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-semibold text-primary">Price starts at</CardTitle>
                                    <CardDescription>Best rates guaranteed for trusted students</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div>
                                        <p className="text-3xl font-bold text-primary">
                                            {hostel.priceRange?.min
                                                ? `GH₵${hostel.priceRange.min.toLocaleString()}`
                                                : hostel.price
                                                    ? `GH₵${hostel.price.toLocaleString()}`
                                                    : 'Contact for pricing'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1 text-yellow-400">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={`price-rating-${i}`}
                                                    className={`h-4 w-4 ${i < roundedAverage ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                                                />
                                            ))}
                                            <span className="ml-2 text-xs text-muted-foreground">{reviewAverage.toFixed(1)} / 5.0</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                                        <div className="rounded-lg border border-primary/20 bg-background/80 p-3">
                                            <p className="uppercase tracking-wide text-xs text-primary/80">Payments</p>
                                            <p className="font-semibold text-primary mt-1">Mobile Money, Card</p>
                                        </div>
                                        <div className="rounded-lg border border-primary/20 bg-background/80 p-3">
                                            <p className="uppercase tracking-wide text-xs text-primary/80">Support</p>
                                            <p className="font-semibold text-primary mt-1">24/7 Student Desk</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold">Latest reviews</h4>
                            {(hostel.reviews && hostel.reviews.length > 0) ? (
                                <div className="space-y-6">
                                    {hostel.reviews.map((review) => (
                                        <div key={review.id} className="flex gap-4 rounded-xl border border-border/40 bg-background/80 p-4">
                                            <Avatar>
                                                {review.userProfileImage ? (
                                                    <AvatarImage src={review.userProfileImage} alt={review.studentName} />
                                                ) : (
                                                    <AvatarFallback>{review.studentName.charAt(0)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold">{review.studentName}</p>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(review.createdAt), 'PP')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={`${review.id}-${i}`}
                                                            className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
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
            </div>
            <div className="flex flex-col order-1 lg:order-2 lg:sticky lg:top-32 h-fit space-y-8">
                <div className="glass-premium p-8 rounded-[3rem] border border-white shadow-2xl space-y-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                    <div className="flex items-center justify-between">
                        <Badge
                            variant="outline"
                            className={cn("text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full", currentAvailability.className)}
                        >
                            {currentAvailability.text}
                        </Badge>
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-all"
                                onClick={() => setShareMenuOpen((open) => !open)}
                            >
                                <Share2 className="h-4 w-4" />
                            </Button>
                            {shareMenuOpen && (
                                <div className="absolute right-0 mt-3 w-48 rounded-2xl border bg-white/95 backdrop-blur-xl shadow-2xl z-50 p-2 border-white/40">
                                    <button
                                        className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-primary/5 rounded-xl transition-colors"
                                        onClick={() => { setShareMenuOpen(false); handleShare('whatsapp'); }}
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                                            <MessageCircle className="h-4 w-4" />
                                        </div>
                                        <span>WhatsApp</span>
                                    </button>
                                    <button
                                        className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-primary/5 rounded-xl transition-colors"
                                        onClick={() => { setShareMenuOpen(false); handleShare('twitter'); }}
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-400">
                                            <Twitter className="h-4 w-4" />
                                        </div>
                                        <span>Twitter</span>
                                    </button>
                                    <button
                                        className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-primary/5 rounded-xl transition-colors"
                                        onClick={() => { setShareMenuOpen(false); handleShare('copy'); }}
                                    >
                                        <div className={`h-8 w-8 rounded-lg ${shareCopied ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-600'} flex items-center justify-center`}>
                                            {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </div>
                                        <span>{shareCopied ? 'Copied!' : 'Copy Link'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-extrabold font-headline leading-tight tracking-tight text-gradient">{hostel.name}</h1>
                        <div className="flex items-center text-muted-foreground/80">
                            <MapPin className="h-4 w-4 mr-2 text-primary/60" />
                            <span className="text-sm font-medium">{hostel.location}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-2">
                            <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`h-4 w-4 ${i < roundedAverage ? 'fill-current' : 'text-muted-foreground/30'}`} />
                                ))}
                            </div>
                            <span className="text-sm font-bold">{reviewAverage.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium underline underline-offset-4 cursor-pointer">
                            {totalReviews} Student Reviews
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Starting from</p>
                                {renderPrice()}
                            </div>
                            <span className="text-sm font-bold text-muted-foreground pb-1">/ year</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-secondary/20 rounded-xl border border-secondary/30 flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-secondary-foreground" />
                                <span className="text-[10px] font-bold text-secondary-foreground uppercase">MoMo</span>
                            </div>
                            <div className="p-3 bg-secondary/20 rounded-xl border border-secondary/30 flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-secondary-foreground" />
                                <span className="text-[10px] font-bold text-secondary-foreground uppercase">Card</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-primary/5">
                        {getPrimaryCTA()}

                        {(hostel.roomTypes?.length ?? 0) > 1 && (
                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 font-bold group"
                                onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                            >
                                Compare Room Options
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        )}
                    </div>

                    <div className="bg-background/80 backdrop-blur-sm rounded-[1.5rem] border border-primary/5 p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold">Verified Agent</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">This property has been physically inspected by our team.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Lock className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold">Encrypted Payments</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">Your data and payments are secured with end-to-end encryption.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {(hostel.roomTypes?.length ?? 0) === 1 && (
                <div className="mt-8 space-y-4">
                    <h4 className="text-lg font-bold font-headline flex items-center gap-2">
                        <Bed className="h-5 w-5 text-primary" />
                        Room Specification
                    </h4>
                    {hostel.roomTypes?.map((room) => (
                        <div key={room.id} className="glass-card rounded-3xl p-6 border-primary/10 hover:border-primary/30 shadow-sm group">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h5 className="text-xl font-bold">{room.name}</h5>
                                    <div className="flex items-center gap-4 mt-2">
                                        {room.beds && (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                                <Bed className="h-3.5 w-3.5 text-primary" /> {room.beds} Beds
                                            </span>
                                        )}
                                        {room.bathrooms && (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                                <Bath className="h-3.5 w-3.5 text-primary" /> {room.bathrooms}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Badge variant={getRoomAvailabilityVariant(room.availability)} className="px-3 py-1 rounded-full uppercase tracking-tighter text-[10px] font-bold">
                                    {room.availability}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Annual Rate</p>
                                    <p className="text-xl font-extrabold text-primary">GH₵{room.price.toLocaleString()}</p>
                                </div>
                                {getVisitButton(room)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}

function LimitedHostelDetails({ hostel }: { hostel: Hostel }) {
    const router = useRouter();
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
            <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
                {isStudent ? <FullHostelDetails hostel={hostel} currentUser={appUser} /> : <LimitedHostelDetails hostel={hostel} />}
            </main>
        </div>
    );
}
