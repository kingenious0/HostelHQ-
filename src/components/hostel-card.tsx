
"use client";

import type { Hostel } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, DoorOpen, Clock, Lock, Users, Shield, ArrowLeft, ArrowRight, User, UserCircle2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';

type HostelCardProps = {
    hostel: Hostel;
    selectedRoomType?: string;
};

const availabilityInfo: Record<Hostel['availability'], { text: string, icon: React.ReactNode, className: string }> = {
    'Available': { text: 'Available', icon: <DoorOpen className="h-4 w-4" />, className: 'bg-green-100 text-green-800 border-green-200' },
    'Limited': { text: 'Limited', icon: <Clock className="h-4 w-4" />, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'Full': { text: 'Full', icon: <Lock className="h-4 w-4" />, className: 'bg-red-100 text-red-800 border-red-200' },
};

const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
};

const normalizeRoomTypeLabel = (value?: string) => value?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';

const deriveCapacityFromName = (name?: string) => {
    if (!name) return undefined;
    const numericMatch = name.match(/\d+/);
    if (numericMatch) {
        return Number(numericMatch[0]);
    }
    const firstWord = name.split(' ')[0]?.toLowerCase();
    return numberWords[firstWord ?? ''] ?? undefined;
};

export function HostelCard({ hostel, selectedRoomType }: HostelCardProps) {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const isStudent = currentUser && !currentUser.email?.endsWith('@agent.hostelhq.com') && !currentUser.email?.endsWith('@admin.hostelhq.com');
    const currentAvailability = availabilityInfo[hostel.availability || 'Full'];

    const normalizedSelection = normalizeRoomTypeLabel(selectedRoomType);
    const roomTypes = hostel.roomTypes ?? [];
    const activeRoomType =
        roomTypes.find((rt) => normalizeRoomTypeLabel(rt.name) === normalizedSelection) ?? roomTypes[0];
    const activeCapacity = activeRoomType?.capacity ?? deriveCapacityFromName(activeRoomType?.name);
    const activeOccupancy = activeRoomType?.occupancy ?? 0;

    // Calculate total rooms available (count of rooms with available spots)
    // For simplicity, we'll estimate based on room types and their availability
    const totalRoomsAvailable = roomTypes.reduce((total, rt) => {
        const capacity = rt.capacity ?? deriveCapacityFromName(rt.name) ?? 0;
        const occupancy = rt.occupancy ?? 0;
        // Estimate: if a room type has available spots, count it as having rooms
        if (capacity > occupancy && rt.availability !== 'Full') {
            // Rough estimate: assume each room type represents multiple rooms
            // For better accuracy, this could be improved with actual room count data
            return total + Math.max(1, Math.ceil((capacity - occupancy) / capacity));
        }
        return total;
    }, 0);

    // Calculate total capacity/occupancy by gender
    const hostelGender = hostel.gender?.toLowerCase() || 'mixed';
    let maleCapacity = 0;
    let femaleCapacity = 0;
    let maleOccupancy = 0;
    let femaleOccupancy = 0;

    roomTypes.forEach(rt => {
        const capacity = rt.capacity ?? deriveCapacityFromName(rt.name) ?? 0;
        const occupancy = rt.occupancy ?? 0;

        if (hostelGender === 'male') {
            maleCapacity += capacity;
            maleOccupancy += occupancy;
        } else if (hostelGender === 'female') {
            femaleCapacity += capacity;
            femaleOccupancy += occupancy;
        } else {
            // Mixed - distribute evenly
            const halfCapacity = Math.floor(capacity / 2);
            const halfOccupancy = Math.floor(occupancy / 2);
            maleCapacity += halfCapacity;
            femaleCapacity += capacity - halfCapacity;
            maleOccupancy += halfOccupancy;
            femaleOccupancy += occupancy - halfOccupancy;
        }
    });

    // Display total capacity (or occupancy if you prefer showing current occupancy)
    const displayMaleCount = maleCapacity || maleOccupancy;
    const displayFemaleCount = femaleCapacity || femaleOccupancy;

    const renderPrice = () => {
        const price = activeRoomType?.price ?? hostel.priceRange.min;
        return (
            <span className="flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-primary">GH₵</span>
                <span className="text-xl font-bold text-primary tracking-tight">{price.toLocaleString()}</span>
            </span>
        );
    };


    // Format distance from campus
    const distanceText = hostel.distanceToUniversity || 'N/A';

    return (
        <Card className="w-full overflow-hidden transition-all hover:shadow-2xl hover:shadow-primary/5 duration-500 ease-out transform hover:-translate-y-2 flex flex-col group border border-border/40 rounded-3xl bg-card shadow-sm">
            <Link href={`/hostels/${hostel.id}`} className="block flex flex-col flex-grow">
                {/* Image Section - Top Half */}
                <CardHeader className="p-0">
                    <div className="relative h-56 w-full overflow-hidden bg-background/40 px-3 pt-3">
                        <Carousel autoPlay={false} className="h-full rounded-2xl overflow-hidden shadow-inner">
                            <CarouselContent className="h-full">
                                {(hostel.images?.length ? hostel.images.slice(0, 4) : ['/placeholder.jpg']).map((image, index) => (
                                    <CarouselItem key={index} className="h-full">
                                        <div className="relative h-full w-full">
                                            <Image
                                                src={image}
                                                alt={`${hostel.name} preview ${index + 1}`}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                data-ai-hint="hostel exterior"
                                                priority={index === 0}
                                            />
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            {/* Navigation Arrows - Only visible on hover */}
                            <CarouselPrevious className="left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 border-0 h-8 w-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CarouselNext className="right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 border-0 h-8 w-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Carousel>

                        {/* Availability Badge Overlay */}
                        <div className="absolute top-5 right-5 z-10">
                            <Badge className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg border-white/20",
                                hostel.availability === 'Available' ? 'bg-green-500/80 text-white' :
                                    hostel.availability === 'Limited' ? 'bg-yellow-500/80 text-white' : 'bg-red-500/80 text-white')}>
                                {hostel.availability}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>

                {/* Information Section - Bottom Half */}
                <CardContent className="p-5 flex-grow bg-card">
                    {/* Rating & availability */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                            {hostel.rating.toFixed(1)}
                            {typeof hostel.numberOfReviews === "number" && (
                                <span className="text-xs font-normal text-muted-foreground">
                                    ({hostel.numberOfReviews} {hostel.numberOfReviews === 1 ? 'review' : 'reviews'})
                                </span>
                            )}
                        </div>
                        {isStudent && totalRoomsAvailable > 0 && (
                            <Badge variant="secondary" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest">
                                <DoorOpen className="h-3.5 w-3.5" />
                                {totalRoomsAvailable} {totalRoomsAvailable === 1 ? 'room' : 'rooms'} available
                            </Badge>
                        )}
                    </div>

                    {/* Hostel Name */}
                    <CardTitle className="text-xl font-bold font-headline text-foreground mb-2 leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {hostel.name}
                    </CardTitle>

                    {/* Location with Primary Map Pin */}
                    <div className="flex items-center text-muted-foreground/80 text-xs mb-3">
                        <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-primary" />
                        <span className="truncate font-medium">{hostel.location}</span>
                    </div>

                    <Separator className="my-3 opacity-50" />

                    {/* Distance from Campus with Primary Walking Person Icon */}
                    {distanceText !== 'N/A' && (
                        <div className="flex items-center text-muted-foreground text-sm mb-4">
                            <User className="h-4 w-4 mr-1.5 flex-shrink-0 text-primary" />
                            <span className="font-medium uppercase">{distanceText} FROM CAMPUS</span>
                        </div>
                    )}

                    {/* Occupancy by Gender - Male/Female Icons */}
                    <div className="flex items-center justify-between mb-4 mt-auto">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                                <User className="h-3.5 w-3.5 text-primary mr-1" strokeWidth={2.5} />
                                <span className="text-xs font-bold text-foreground">{displayMaleCount}</span>
                            </div>
                            <div className="flex items-center px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                                <UserCircle2 className="h-3.5 w-3.5 text-primary mr-1" strokeWidth={2.5} />
                                <span className="text-xs font-bold text-foreground">{displayFemaleCount}</span>
                            </div>
                        </div>
                        {renderPrice()}
                    </div>

                </CardContent>
            </Link>

            {/* View Detail Button */}
            <CardFooter className="p-4 sm:p-5 pt-0 bg-card">
                <Link href={`/hostels/${hostel.id}`} className="w-full">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2">
                        View Detail
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
}
