
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

  const isStudent = currentUser && !currentUser.email?.endsWith('@agent.hostelhq.com') && !currentUser.email?.endsWith('@admin.hostelhq.com');
  const currentAvailability = availabilityInfo[hostel.availability || 'Full'];

  const renderPrice = () => {
    const priceStyle = "text-xl font-bold text-primary";
    if (hostel.priceRange.min === 0 && hostel.price) {
       return <span className={priceStyle}>GH₵{hostel.price.toLocaleString()}</span>
    }
    if (hostel.priceRange.min === hostel.priceRange.max) {
      return <span className={priceStyle}>GH₵{hostel.priceRange.min.toLocaleString()}</span>;
    }
    return (
      <span className="text-lg font-bold text-primary">
        GH₵{hostel.priceRange.min.toLocaleString()} - {hostel.priceRange.max.toLocaleString()}
      </span>
    );
  };

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-xl duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col group border-0 rounded-xl">
        <Link href={`/hostels/${hostel.id}`} className="block flex flex-col flex-grow">
            <CardHeader className="p-0">
            <div className="relative h-48 w-full">
                <Image
                src={hostel.images[0]}
                alt={hostel.name}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint="hostel exterior"
                className="transition-transform duration-500 group-hover:scale-110 rounded-t-xl"
                />
                {isStudent && hostel.availability && (
                    <Badge className={cn("absolute top-3 right-3 flex items-center gap-1.5 shadow-md", currentAvailability.className)}>
                        {currentAvailability.icon}
                        {currentAvailability.text}
                    </Badge>
                )}
            </div>
            </CardHeader>
            <CardContent className="p-4 flex-grow bg-card rounded-b-xl">
            <CardTitle className="text-lg font-bold font-headline truncate">{hostel.name}</CardTitle>
            <div className="flex items-center text-muted-foreground text-sm mt-1">
                <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">{hostel.location}</span>
            </div>
            <div className="flex items-center mt-3">
                <div className="flex items-center text-yellow-400">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-5 w-5 ${i < Math.round(hostel.rating) ? 'fill-current' : ''}`} />
                ))}
                </div>
                <span className="ml-2 text-sm text-muted-foreground">({hostel.reviews} reviews)</span>
            </div>
            </CardContent>
        </Link>
        <CardFooter className="p-4 pt-0 flex justify-between items-center mt-auto bg-card rounded-b-xl">
            <div>
              {renderPrice()}
              <span className="text-sm text-muted-foreground">/yr</span>
            </div>
            <Link href={`/hostels/${hostel.id}`}>
              <Button>View Details</Button>
            </Link>
        </CardFooter>
    </Card>
  );
}
