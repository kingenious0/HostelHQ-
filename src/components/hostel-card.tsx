
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
        <Card className="w-full overflow-hidden flex flex-col group glass-card rounded-[2rem] border-0">
            <Link href={`/hostels/${hostel.id}`} className="block flex flex-col flex-grow">
                {/* Image Section - Top Half */}
                <CardHeader className="p-0">
                    <div className="relative h-64 w-full overflow-hidden">
                        <Carousel autoPlay={false} className="h-full w-full">
                            <CarouselContent className="h-full ml-0">
                                {(hostel.images?.length ? hostel.images.slice(0, 4) : ['/AAMUSTED-Full-shot.jpeg']).map((image, index) => (
                                    <CarouselItem key={index} className="h-full">
                                        <div className="relative h-full w-full min-h-[256px]">
                                            <Image
                                                src={image}
                                                alt={`${hostel.name} preview ${index + 1}`}
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                                priority={index === 0}
                                            />
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md border-0 h-9 w-9 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/50" />
                            <CarouselNext className="right-4 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md border-0 h-9 w-9 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/50" />
                        </Carousel>

                        {/* Availability Badge Overlay */}
                        <div className="absolute top-4 right-4 z-10">
                            <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-xl shadow-lg border-white/40",
                                hostel.availability === 'Available' ? 'bg-green-500/90 text-white' :
                                    hostel.availability === 'Limited' ? 'bg-yellow-500/90 text-white' : 'bg-red-500/90 text-white')}>
                                {hostel.availability}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>

                {/* Information Section - Bottom Half */}
                <CardContent className="p-6 flex-grow">
                    {/* Rating & availability */}
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 rounded-full bg-secondary/30 px-3 py-1 text-xs font-bold text-secondary-foreground border border-secondary/20">
                            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                            {hostel.rating.toFixed(1)}
                            {typeof hostel.numberOfReviews === "number" && (
                                <span className="opacity-60 font-normal">({hostel.numberOfReviews})</span>
                            )}
                        </div>
                        {isStudent && totalRoomsAvailable > 0 && (
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                {totalRoomsAvailable} {totalRoomsAvailable === 1 ? 'room' : 'rooms'} left
                            </span>
                        )}
                    </div>

                    {/* Hostel Name */}
                    <CardTitle className="text-2xl font-extrabold font-headline mb-2 leading-tight tracking-tight group-hover:text-primary transition-colors duration-300">
                        {hostel.name}
                    </CardTitle>

                    {/* Location & Distance */}
                    <div className="space-y-1.5 mb-6">
                        <div className="flex items-center text-muted-foreground text-xs">
                            <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                            <span className="truncate">{hostel.location}</span>
                        </div>
                        {distanceText !== 'N/A' && (
                            <div className="flex items-center text-primary/80 text-[10px] font-bold uppercase tracking-widest">
                                <User className="h-3 w-3 mr-1.5" />
                                {distanceText} FROM CAMPUS
                            </div>
                        )}
                    </div>

                    <Separator className="mb-4 opacity-30" />

                    {/* Occupancy & Price */}
                    <div className="flex items-center justify-between mt-auto">
                        <div className="flex -space-x-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center" title="Male Occupants">
                                <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="h-8 w-8 rounded-full bg-accent/10 border-2 border-background flex items-center justify-center" title="Female Occupants">
                                <UserCircle2 className="h-3.5 w-3.5 text-accent" />
                            </div>
                            <div className="pl-3.5 flex flex-col justify-center">
                                <span className="text-[10px] font-bold leading-none">{displayMaleCount + displayFemaleCount}</span>
                                <span className="text-[9px] text-muted-foreground uppercase">capacity</span>
                            </div>
                        </div>
                        {renderPrice()}
                    </div>
                </CardContent>
            </Link>

            {/* Optimized CTA Padding */}
            <CardFooter className="p-6 pt-0">
                <Link href={`/hostels/${hostel.id}`} className="w-full">
                    <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/10 group/btn overflow-hidden relative">
                        <span className="relative z-10 flex items-center gap-2">
                            View Details
                            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
}
