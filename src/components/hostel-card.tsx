
import type { Hostel } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HostelCardProps = {
  hostel: Hostel;
};

export function HostelCard({ hostel }: HostelCardProps) {
  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-lg duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col">
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
            </div>
            </CardHeader>
            <CardContent className="p-4 flex-grow">
            <Badge variant="secondary" className="mb-2 capitalize">{hostel.amenities[0]}</Badge>
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
            <span className="text-xl font-bold">GH₵{hostel.price}</span>
            <span className="text-sm text-muted-foreground">/year</span>
            </div>
            <Link href={`/hostels/${hostel.id}`}>
              <Button>View Details</Button>
            </Link>
        </CardFooter>
    </Card>
  );
}
