"use client";

import type { Hostel } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  MapPin,
  DoorOpen,
  Clock,
  Lock,
  ArrowRight,
  ShieldCheck,
  Scale,
  Check,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { useShortlist } from '@/components/shortlist-context';

type HostelCardProps = {
  hostel: Hostel;
  selectedRoomType?: string;
};

const normalizeRoomTypeLabel = (value?: string) => value?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

const deriveCapacityFromName = (name?: string) => {
  if (!name) return undefined;
  const numericMatch = name.match(/\d+/);
  if (numericMatch) return Number(numericMatch[0]);
  const firstWord = name.split(' ')[0]?.toLowerCase();
  return numberWords[firstWord ?? ''] ?? undefined;
};

export function HostelCard({ hostel, selectedRoomType }: HostelCardProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const { isShortlisted, toggleShortlist } = useShortlist();
  const shortlisted = isShortlisted(hostel.id);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const normalizedSelection = normalizeRoomTypeLabel(selectedRoomType);
  const roomTypes = hostel.roomTypes ?? [];
  const activeRoomType =
    roomTypes.find((rt) => normalizeRoomTypeLabel(rt.name) === normalizedSelection) ?? roomTypes[0];

  // Sanitize and filter out bogus test/placeholder images
  const validImages = useMemo(() => {
    const defaultFallback = '/AAMUSTED-Full-shot.jpeg';
    if (!hostel.images || hostel.images.length === 0) {
      return [defaultFallback];
    }
    const filtered = hostel.images.filter((img) => {
      if (!img || typeof img !== 'string') return false;
      const lower = img.toLowerCase();
      // Filter out test graphics and placeholders noted in PRD Section 5c
      if (
        lower.includes('placeholder') ||
        lower.includes('org-chart') ||
        lower.includes('bouquet') ||
        lower.includes('test-logo') ||
        lower.includes('dummy')
      ) {
        return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered.slice(0, 4) : [defaultFallback];
  }, [hostel.images]);

  // Calculate price to display
  const displayPrice = activeRoomType?.price ?? hostel.priceRange?.min ?? 0;

  // Format distance
  const distanceText = hostel.distanceToUniversity || 'Near Campus';

  return (
    <Card className="w-full overflow-hidden flex flex-col group rounded-3xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      {/* Image & Overlay Badges */}
      <CardHeader className="p-0 relative">
        <div className="relative h-60 w-full overflow-hidden bg-muted">
          <Carousel autoPlay={false} className="h-full w-full">
            <CarouselContent className="h-full ml-0">
              {validImages.map((image, index) => (
                <CarouselItem key={index} className="h-full pl-0">
                  <div className="relative h-full w-full min-h-[240px]">
                    <Image
                      src={image}
                      alt={`${hostel.name} view ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      priority={index === 0}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {validImages.length > 1 && (
              <>
                <CarouselPrevious className="left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white border-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75" />
                <CarouselNext className="right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white border-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75" />
              </>
            )}
          </Carousel>

          {/* Top Overlays */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
            {/* Uniplaces-Style "University-Approved ✓" Badge */}
            <Badge className="bg-emerald-600/95 hover:bg-emerald-600 text-white border-0 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              University-Approved ✓
            </Badge>

            {/* Amber Student-Style Shortlist / Compare Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleShortlist(hostel);
              }}
              className={cn(
                "pointer-events-auto h-9 w-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md",
                shortlisted
                  ? "bg-primary text-white scale-105 ring-2 ring-white"
                  : "bg-black/50 text-white hover:bg-black/75 hover:scale-110"
              )}
              title={shortlisted ? "Remove from comparison" : "Add to shortlist to compare"}
            >
              {shortlisted ? (
                <Check className="h-4 w-4" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Availability Badge (Bottom Left of Image) */}
          <div className="absolute bottom-3 left-3 z-10">
            <Badge
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border",
                hostel.availability === 'Available'
                  ? 'bg-emerald-500/90 text-white border-emerald-400/40'
                  : hostel.availability === 'Limited'
                  ? 'bg-amber-500/90 text-white border-amber-400/40'
                  : 'bg-rose-500/90 text-white border-rose-400/40'
              )}
            >
              {hostel.availability}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* Content Section */}
      <CardContent className="p-5 flex-grow flex flex-col justify-between">
        <div>
          {/* Rating and Distance Line */}
          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
            {/* PRD Bug Fix: replace 0.0 with "No reviews yet" */}
            {hostel.rating > 0 && (hostel.numberOfReviews ?? 0) > 0 ? (
              <div className="inline-flex items-center gap-1 font-bold text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{hostel.rating.toFixed(1)}</span>
                <span className="text-muted-foreground font-normal">({hostel.numberOfReviews})</span>
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                No reviews yet
              </span>
            )}

            {/* Student.com-style: "X mins from campus" with Clock icon */}
            <div className="flex items-center text-[11px] font-bold text-primary tracking-wide">
              <Clock className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
              <span className="truncate">{distanceText}</span>
            </div>
          </div>

          {/* Hostel Name */}
          <Link href={`/hostels/${hostel.id}`} className="block">
            <CardTitle className="text-xl font-headline font-extrabold text-foreground mb-1 leading-snug group-hover:text-primary transition-colors line-clamp-1">
              {hostel.name}
            </CardTitle>
          </Link>

          {/* Location */}
          <div className="flex items-center text-xs text-muted-foreground mb-3">
            <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground/70 shrink-0" />
            <span className="truncate">{hostel.location}</span>
          </div>

          {/* Gender and Room Types Tag */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md border-border/80 text-foreground">
              <Users className="h-2.5 w-2.5 mr-1" />
              {hostel.gender || "Mixed"} Students
            </Badge>

            {roomTypes.slice(0, 2).map((rt, i) => (
              <span key={i} className="text-[10px] font-medium bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md border border-border/40">
                {rt.name}
              </span>
            ))}
            {roomTypes.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{roomTypes.length - 2} more
              </span>
            )}
          </div>
        </div>

        <div>
          <Separator className="my-3 opacity-60" />

          {/* Price & CTA */}
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                From
              </span>
              <span className="text-xl font-extrabold text-foreground tracking-tight">
                GH₵{displayPrice > 0 ? displayPrice.toLocaleString() : "Contact"}
              </span>
              <span className="text-[11px] text-muted-foreground font-normal"> / year</span>
            </div>

            <Button asChild size="sm" className="rounded-xl h-10 px-4 font-bold bg-primary text-white hover:bg-primary/90 text-xs shadow-sm gap-1">
              <Link href={`/hostels/${hostel.id}`}>
                View Details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
