
"use client";

import type { Hostel } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, DoorOpen, Clock, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState, useEffect } from 'react';

type HostelCardProps = {
  hostel: Hostel;
};

const availabilityInfo: Record<Hostel['availability'], { text: string, icon: React.ReactNode, className: string }> = {
    'Available': { text: 'Available', icon: <DoorOpen className="h-4 w-4"/>, className: 'bg-green-100 text-green-800 border-green-200'},
    'Limited': { text: 'Limited', icon: <Clock className="h-4 w-4"/>, className: 'bg-yellow-100 text-yellow-800 border-yellow-200'},
    'Full': { text: 'Full', icon: <Lock className="h-4 w-4"/>, className: 'bg-red-100 text-red-800 border-red-200'},
};

export function HostelCard({ hostel }: HostelCardProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
        setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const isStudent = currentUser && currentUser.email?.includes('student');
  const currentAvailability = availabilityInfo[hostel.availability || 'Full'];

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-lg duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col group">
        <Link href={`/hostels/${hostel.id}`} className="block flex flex-col flex-grow">
            <CardHeader className="p-0">
            <div className="relative h-48 w-full">
                <Image
                src={hostel.images[0]}
                alt={hostel.name}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint="hostel exterior"
                className="transition-transform duration-300 group-hover:scale-105"
                />
                {isStudent && hostel.availability && (
                    <Badge className={cn("absolute top-2 right-2 flex items-center gap-1.5", currentAvailability.className)}>
                        {currentAvailability.icon}
                        {currentAvailability.text}
                    </Badge>
                )}
            </div>
            </CardHeader>
            <CardContent className="p-4 flex-grow">
            <CardTitle className="text-lg font-bold font-headline truncate">{hostel.name}</CardTitle>
            <div className="flex items-center text-muted-foreground text-sm mt-1">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{hostel.location}</span>
            </div>
            <div className="flex items-center mt-2">
                <div className="flex items-center text-yellow-500">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-5 w-5 ${i < Math.round(hostel.rating) ? 'fill-current' : ''}`} />
                ))}
                </div>
                <span className="ml-2 text-sm text-muted-foreground">({hostel.reviews} reviews)</span>
            </div>
            </CardContent>
        </Link>
        <CardFooter className="p-4 pt-0 flex justify-between items-center mt-auto">
            <div>
            <span className="text-xl font-bold">GH₵{hostel.price.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">/year</span>
            </div>
            <Link href={`/hostels/${hostel.id}`}>
              <Button>View Details</Button>
            </Link>
        </CardFooter>
    </Card>
  );
}
