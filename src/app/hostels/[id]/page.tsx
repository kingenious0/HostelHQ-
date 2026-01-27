

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/header';
import { getHostel, Hostel, RoomType, Review } from '@/lib/data';
import { notFound, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Wifi, ParkingSquare, Utensils, Droplets, Snowflake, Dumbbell, Star, MapPin, BookOpen, Lock, DoorOpen, Clock, Bed, Bath, User, ShieldCheck, Ticket, FileText, Share2, MessageCircle, Twitter, Facebook, Copy, Check, ArrowRight, Users as UsersIcon, Smartphone, CreditCard } from 'lucide-react';
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

    const primaryImages = hostel.images?.length ? hostel.images : ['/placeholder.jpg'];

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
            <div className="fixed bottom-16 left-0 z-40 w-full p-4 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="glass-dark rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-4 border border-white/20">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Starting from</span>
                        <div className="flex items-baseline gap-1 text-white">
                            <span className="text-xs font-bold">GH₵</span>
                            <span className="text-xl font-bold">{(hostel.priceRange?.min || hostel.price || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    {hostel.availability === 'Full' ? (
                        <Button disabled variant="secondary" className="rounded-2xl px-6">Full</Button>
                    ) : (
                        <Button
                            onClick={() => router.push(`/hostels/${hostel.id}/book`)}
                            className="rounded-2xl px-8 bg-accent text-accent-foreground font-bold shadow-lg shadow-accent/20"
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
        <div className="grid lg:grid-cols-[1fr_0.4fr] gap-8 lg:gap-12 relative pb-32 md:pb-0">
            {renderMobileStickyCTA()}
            <div className="order-2 lg:order-1 space-y-10">
                <Carousel className="w-full relative group" autoPlay autoPlayInterval={4500}>
                    <CarouselContent>
                        {hostel.images.map((img: string, index: number) => (
                            <CarouselItem key={index}>
                                <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] w-full overflow-hidden rounded-[2.5rem] shadow-2xl">
                                    <Image
                                        src={img}
                                        alt={`${hostel.name} image ${index + 1}`}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-1000"
                                        data-ai-hint="hostel interior"
                                        priority={index === 0}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CarouselNext className="right-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Carousel>

                <div className="mt-8 space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold font-headline mb-4">Description</h3>
                        <p className="mt-2 text-foreground/80 leading-relaxed">{hostel.description}</p>
                        {(hostel.nearbyLandmarks || hostel.distanceToUniversity) && (
                            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                                {hostel.nearbyLandmarks && (
                                    <p>
                                        {/aamusted/i.test(hostel.nearbyLandmarks)
                                            ? 'Near AAMUSTED University'
                                            : `Nearby: ${hostel.nearbyLandmarks}`}
                                    </p>
                                )}
                                {hostel.distanceToUniversity && (
                                    <p>Distance to AAMUSTED University: {hostel.distanceToUniversity}</p>
                                )}
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold font-headline flex items-center gap-2"><FileText className="h-5 w-5 text-muted-foreground" />Student Bills</h3>
                        {hostel.billsIncluded && hostel.billsIncluded.length > 0 && (
                            <div>
                                <p className="font-medium">Hostel Bills included:</p>
                                <p className="text-muted-foreground">{hostel.billsIncluded.join(', ')}.</p>
                            </div>
                        )}
                        {hostel.billsExcluded && hostel.billsExcluded.length > 0 && (
                            <div>
                                <p className="font-medium">Hostel Bills Excludes:</p>
                                <p className="text-muted-foreground">{hostel.billsExcluded.join(', ')}.</p>
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold font-headline flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground" />Security & Safety</h3>
                        {hostel.securityAndSafety && hostel.securityAndSafety.length > 0 && (
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                {hostel.securityAndSafety.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        )}
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-xl font-semibold font-headline mb-4">Amenities</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {hostel.amenities.map((amenity: string) => (
                                <div key={amenity} className="flex items-center gap-3">
                                    <div className="p-2 bg-secondary rounded-md">
                                        {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <div className="h-5 w-5" />}
                                    </div>
                                    <span className="text-sm font-medium capitalize">{amenity}</span>
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
            <div className="flex flex-col order-1 lg:order-2 lg:sticky lg:top-32 h-fit">
                <div className="glass-dark dark:glass p-6 sm:p-8 rounded-[2rem] border border-border/40 shadow-xl space-y-6">
                    <Badge
                        variant="outline"
                        className={cn("text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full w-fit", currentAvailability.className)}
                    >
                        {currentAvailability.text}
                    </Badge>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-headline">{hostel.name}</h1>
                    <div className="flex items-center text-muted-foreground mt-2">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        <span className="text-sm sm:text-base">{hostel.location}</span>
                    </div>
                    {(hostel.nearbyLandmarks || hostel.distanceToUniversity) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {hostel.nearbyLandmarks && (
                                <Badge variant="outline" className="text-xs sm:text-sm rounded-full border-primary/30 bg-primary/5 text-primary">
                                    {/aamusted/i.test(hostel.nearbyLandmarks)
                                        ? 'Near AAMUSTED University'
                                        : `Nearby: ${hostel.nearbyLandmarks}`}
                                </Badge>
                            )}
                            {hostel.distanceToUniversity && (
                                <Badge variant="outline" className="text-xs sm:text-sm rounded-full border-primary/30 bg-primary/5 text-primary">
                                    Distance: {hostel.distanceToUniversity}
                                </Badge>
                            )}
                        </div>
                    )}
                    <div className="mt-4 flex justify-between items-center text-xs sm:text-sm text-muted-foreground">
                        <span className="uppercase tracking-wide font-semibold">Share</span>
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                                onClick={() => setShareMenuOpen((open) => !open)}
                            >
                                <Share2 className="h-4 w-4" />
                            </Button>
                            {shareMenuOpen && (
                                <div className="absolute right-0 mt-2 w-40 rounded-md border bg-popover shadow-lg z-20">
                                    <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent"
                                        onClick={() => { setShareMenuOpen(false); handleShare('whatsapp'); }}
                                    >
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        <span>WhatsApp</span>
                                    </button>
                                    <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent"
                                        onClick={() => { setShareMenuOpen(false); handleShare('twitter'); }}
                                    >
                                        <Twitter className="h-3.5 w-3.5" />
                                        <span>Twitter</span>
                                    </button>
                                    <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent"
                                        onClick={() => { setShareMenuOpen(false); handleShare('facebook'); }}
                                    >
                                        <Facebook className="h-3.5 w-3.5" />
                                        <span>Facebook</span>
                                    </button>
                                    <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent"
                                        onClick={() => { setShareMenuOpen(false); handleShare('copy'); }}
                                    >
                                        {shareCopied ? (
                                            <Check className="h-3.5 w-3.5 text-green-600" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                        <span>{shareCopied ? 'Link copied' : 'Copy link'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center mt-4">
                        <div className="flex items-center text-yellow-500">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 ${i < roundedAverage ? 'fill-current' : 'text-muted-foreground/30'}`} />
                            ))}
                        </div>
                        <span className="ml-2 sm:ml-3 text-sm sm:text-base lg:text-lg text-muted-foreground">({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})</span>
                    </div>

                    <div className="mt-6 sm:mt-8 flex items-baseline gap-2">
                        {renderPrice()}
                        <span className="text-sm sm:text-base text-muted-foreground">/year</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Badge variant="outline" className="gap-2 rounded-full border-primary/30 bg-primary/5 text-primary">
                            <Smartphone className="h-4 w-4" />
                            Mobile Money
                        </Badge>
                        <Badge variant="outline" className="gap-2 rounded-full border-primary/30 bg-primary/5 text-primary">
                            <CreditCard className="h-4 w-4" />
                            Visa & Mastercard
                        </Badge>
                    </div>

                    {getPrimaryCTA()}

                    {(hostel.roomTypes?.length ?? 0) > 1 && (
                        <Button
                            variant="outline"
                            className="w-full mt-3 border-primary/40 text-primary hover:bg-primary/5"
                            onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                        >
                            View all room options
                        </Button>
                    )}

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm bg-background/70 border border-primary/10 rounded-xl p-3 sm:p-4">
                        <div className="flex items-start gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <p className="font-semibold text-foreground">Trusted agents</p>
                                <p className="text-[11px] sm:text-xs text-muted-foreground">Only verified agents and admins can list hostels.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <CreditCard className="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <p className="font-semibold text-foreground">Secure payments</p>
                                <p className="text-[11px] sm:text-xs text-muted-foreground">Pay via trusted mobile money and card providers.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Smartphone className="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <p className="font-semibold text-foreground">Student-first support</p>
                                <p className="text-[11px] sm:text-xs text-muted-foreground">Track visits and bookings from your HostelHQ account.</p>
                            </div>
                        </div>
                    </div>

                    {(hostel.roomTypes?.length ?? 0) === 1 && (
                        <Card className="mt-6 sm:mt-8 shadow-md">
                            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardTitle className="text-lg sm:text-xl">Room Type & Pricing</CardTitle>
                                    <CardDescription className="text-sm">This hostel offers a single room type. Review the details and proceed to book a visit or secure it.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs sm:text-sm">Room Type</TableHead>
                                                <TableHead className="text-xs sm:text-sm">Availability</TableHead>
                                                <TableHead className="text-xs sm:text-sm">Price/Year</TableHead>
                                                <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hostel.roomTypes?.map((room) => (
                                                <TableRow key={room.id}>
                                                    <TableCell>
                                                        <p className="font-medium text-sm sm:text-base">{room.name}</p>
                                                        <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-1">
                                                            {room.beds && (
                                                                <span className="flex items-center gap-1">
                                                                    <Bed className="h-3 w-3" /> {room.beds} Beds
                                                                </span>
                                                            )}
                                                            {room.bathrooms && (
                                                                <span className="flex items-center gap-1">
                                                                    <Bath className="h-3 w-3" /> {room.bathrooms}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={getRoomAvailabilityVariant(room.availability)}
                                                            className="text-xs"
                                                        >
                                                            {hostel.availability === 'Full' ? 'Full' : room.availability}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-sm sm:text-base">
                                                        GH₵{room.price.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right space-y-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full justify-center mb-1"
                                                            onClick={() => router.push(`/hostels/${hostel.id}/rooms`)}
                                                        >
                                                            View Rooms
                                                        </Button>
                                                        {getVisitButton(room)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                </div>
            </div>
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
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
                <Carousel className="w-full" autoPlay autoPlayInterval={4500}>
                    <CarouselContent>
                        {(hostel.images ?? ['/placeholder.jpg']).map((img: string, index: number) => (
                            <CarouselItem key={index}>
                                <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-2xl">
                                    <Image
                                        src={img}
                                        alt={`${hostel.name} image ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        data-ai-hint="hostel exterior"
                                        priority={index === 0}
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 hidden md:flex" />
                    <CarouselNext className="right-4 hidden md:flex" />
                </Carousel>
                <div className="mt-8">
                    <h3 className="text-xl font-semibold font-headline mb-4">Description</h3>
                    <p className="mt-2 text-foreground/80 leading-relaxed line-clamp-5">{hostel.description}</p>
                </div>
            </div>
            <div className="flex flex-col">
                <h1 className="text-4xl font-bold font-headline">{hostel.name}</h1>
                <div className="flex items-center text-muted-foreground mt-2">
                    <MapPin className="h-5 w-5 mr-2" />
                    <span>{hostel.location}</span>
                </div>
                <div className="flex items-center mt-4">
                    <div className="flex items-center text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-6 w-6 ${i < Math.round(hostel.rating) ? 'fill-current' : ''}`} />
                        ))}
                    </div>
                    <span className="ml-3 text-lg text-muted-foreground">({hostel.numberOfReviews} {hostel.numberOfReviews === 1 ? 'review' : 'reviews'})</span>
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-semibold font-headline mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-3">
                        {(hostel.amenities ?? []).slice(0, 4).map((amenity: string) => (
                            <Badge key={amenity} variant="outline" className="text-sm p-2 flex items-center gap-2">
                                {amenityIcons[amenity.toLowerCase().replace(' ', '-')] || <div className="h-5 w-5" />}
                                <span className="font-medium capitalize">{amenity}</span>
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex items-baseline gap-2">
                    {renderPrice()}
                    <span className="text-base text-muted-foreground">/year</span>
                </div>

                {hostel.availability === 'Full' ? (
                    <Button
                        size="lg"
                        className="w-full mt-6 text-lg h-14"
                        variant="secondary"
                        disabled
                        title="This hostel is fully booked"
                    >
                        Hostel Fully Booked
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 text-lg h-14"
                        onClick={handleLoginRedirect}
                    >
                        Apply to Secure Hostel
                    </Button>
                )}

                <Card className="mt-8 bg-muted/30">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5 text-muted-foreground" /> Log in for full details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Create a free student account to see all photos, room types, and book a visit.
                        </p>
                    </CardContent>
                </Card>
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
