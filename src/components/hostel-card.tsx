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
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { useShortlist } from '@/components/shortlist-context';
import { isHostelSoldOut } from '@/lib/room-capacity';
import { isHostelRevoked, isHostelSanctioned } from '@/lib/sanctions';

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
  const cleanId = (hostel.originalId || hostel.id || "")
    .replace(/^HOSTEL#/i, "")
    .replace(/^PENDING_HOSTEL#/i, "")
    .replace(/^HOSTEL#/i, "")
    .replace(/^PENDING_HOSTEL#/i, "")
    .trim();
  const { isShortlisted, toggleShortlist } = useShortlist();
  const shortlisted = isShortlisted(cleanId || hostel.id);
  const isSoldOut = isHostelSoldOut(hostel);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
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

  // Live Occupancy & Bed Placement Calculation
  const totalBeds = useMemo(() => {
    if (hostel.totalBeds && Number(hostel.totalBeds) > 0) return Number(hostel.totalBeds);
    if (roomTypes.length > 0) {
      return roomTypes.reduce((acc, rt) => {
        const cap = Number(rt.capacity || deriveCapacityFromName(rt.name) || 1);
        const count = Number(rt.numberOfRooms || (rt.roomNumbers ? rt.roomNumbers.length : 1));
        return acc + cap * count;
      }, 0);
    }
    return 0;
  }, [hostel.totalBeds, roomTypes]);

  const activeStudentsHoused = Number(
    hostel.activeStudentsHoused ??
      hostel.occupiedBeds ??
      roomTypes.reduce((acc, rt) => acc + (Number(rt.occupancy) || 0), 0)
  );

  const availableBeds = Math.max(0, totalBeds - activeStudentsHoused);

  return (
    <>
      {/* Compact Responsive Mobile Card (< md / 768px) */}
      <div className="md:hidden w-full flex items-center gap-3 p-3 bg-white dark:bg-[#1A1215] border border-stone-200/70 dark:border-stone-800 shadow-sm rounded-xl hover:shadow-md hover:border-[#6B1D2F]/40 transition-all relative overflow-hidden">
        {/* Left Thumbnail (Fixed w-28 h-28) */}
        <Link href={`/hostels/${cleanId}`} className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden bg-muted block">
          <Image
            src={validImages[0]}
            alt={hostel.name}
            fill
            sizes="112px"
            className="object-cover"
          />
          {/* Availability Badge Overlay */}
          <div className="absolute bottom-1.5 left-1.5 z-10">
            {isSoldOut ? (
              <span className="bg-rose-600/95 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> Sold Out
              </span>
            ) : (
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase",
                hostel.availability === 'Available' ? "bg-emerald-500/90 text-white" : "bg-amber-500/90 text-white"
              )}>
                {hostel.availability}
              </span>
            )}
          </div>
        </Link>

        {/* Right Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            {/* Accreditation / Sanction / Approval Badge & Shortlist */}
            <div className="flex items-center justify-between gap-1 mb-1">
              {isHostelRevoked(hostel) ? (
                <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Revoked
                </span>
              ) : isHostelSanctioned(hostel) ? (
                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Sanctioned
                </span>
              ) : (
                <span className="text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-700 dark:text-emerald-400" /> University Approved ✓
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleShortlist(hostel);
                }}
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] transition-all",
                  shortlisted ? "bg-[#6B1D2F] text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                title={shortlisted ? "Remove from comparison" : "Shortlist to compare"}
              >
                {shortlisted ? <Check className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
              </button>
            </div>

            {/* Property Name */}
            <Link href={`/hostels/${cleanId}`} className="block">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-1 hover:text-[#6B1D2F] dark:hover:text-amber-400 transition-colors">
                {hostel.name}
              </h3>
            </Link>

            {/* Location */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              <MapPin className="h-3 w-3 mr-1 shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="truncate">{hostel.location}</span>
            </div>

            {/* Verified beds count / Occupancy */}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {availableBeds > 0 ? `${availableBeds} beds free` : "Full"}
              </span>
              <span className="text-gray-400 dark:text-gray-600">•</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
                {hostel.gender || "Mixed"}
              </span>
            </div>
          </div>

          {/* Price & Compact Scout / Visit Button */}
          <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-stone-200/70 dark:border-stone-800">
            <div>
              <span className="text-xs text-gray-900 dark:text-amber-400 font-bold">
                GH₵{displayPrice > 0 ? displayPrice.toLocaleString() : "Contact"}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">/yr</span>
            </div>

            <Button
              asChild
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-lg shadow-2xs gap-1 transition-colors",
                isSoldOut
                  ? "bg-slate-800 text-white"
                  : "bg-[#6B1D2F] hover:bg-[#521422] text-white"
              )}
            >
              <Link href={`/hostels/${cleanId}`}>
                {isSoldOut ? "View" : "View Details"}
                {!isSoldOut && <ArrowRight className="h-2.5 w-2.5" />}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Rich Card (>= md / 768px) */}
      <Card className="hidden md:flex w-full overflow-hidden flex-col group bg-white dark:bg-[#1A1215] border border-stone-200/70 dark:border-stone-800 shadow-sm rounded-xl hover:shadow-md hover:border-[#6B1D2F]/40 transition-all duration-300">
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
            {/* Accreditation / Sanction / Approval Badge */}
            {isHostelRevoked(hostel) ? (
              <Badge className="bg-rose-600/95 hover:bg-rose-600 text-white border-0 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1">
                <Ban className="h-3.5 w-3.5" />
                Accreditation Revoked
              </Badge>
            ) : isHostelSanctioned(hostel) ? (
              <Badge className="bg-amber-600/95 hover:bg-amber-600 text-white border-0 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Executive Sanction
              </Badge>
            ) : (
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                University Approved ✓
              </Badge>
            )}

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
                  ? "bg-[#6B1D2F] text-white scale-105 ring-2 ring-white"
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
            {isSoldOut ? (
              <Badge className="bg-rose-600/95 hover:bg-rose-600 text-white border-0 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md backdrop-blur-md flex items-center gap-1 uppercase tracking-wider">
                <Lock className="h-3 w-3" />
                Sold Out
              </Badge>
            ) : (
              <Badge
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border",
                  hostel.availability === 'Available'
                    ? 'bg-emerald-500/90 text-white border-emerald-400/40'
                    : 'bg-amber-500/90 text-white border-amber-400/40'
                )}
              >
                {hostel.availability}
              </Badge>
            )}
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
              <div className="inline-flex items-center gap-1 font-bold text-gray-900 dark:text-gray-100">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{hostel.rating.toFixed(1)}</span>
                <span className="text-gray-500 dark:text-gray-400 font-normal">({hostel.numberOfReviews})</span>
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-stone-100 dark:bg-stone-800/80 px-2 py-0.5 rounded-full">
                No reviews yet
              </span>
            )}

            {/* Student.com-style: "X mins from campus" with Clock icon */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 font-bold tracking-wide">
              <Clock className="h-3.5 w-3.5 mr-1 text-[#6B1D2F] dark:text-rose-400 shrink-0" />
              <span className="truncate">{distanceText}</span>
            </div>
          </div>

          {/* Hostel Name */}
          <Link href={`/hostels/${cleanId}`} className="block">
            <CardTitle className="text-xl font-headline font-bold text-gray-900 dark:text-gray-100 mb-1 leading-snug group-hover:text-[#6B1D2F] dark:group-hover:text-amber-400 transition-colors line-clamp-1">
              {hostel.name}
            </CardTitle>
          </Link>

          {/* Location */}
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
            <MapPin className="h-3.5 w-3.5 mr-1 text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="truncate">{hostel.location}</span>
          </div>

          {/* Gender and Room Types Tag */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-md border-0 bg-stone-100 dark:bg-stone-800/80 text-gray-700 dark:text-gray-300">
              <Users className="h-2.5 w-2.5 mr-1" />
              {hostel.gender || "Mixed"} Students
            </Badge>

            {roomTypes.slice(0, 2).map((rt, i) => (
              <span key={i} className="text-[10px] font-medium bg-stone-100 dark:bg-stone-800/80 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md">
                {rt.name}
              </span>
            ))}
            {roomTypes.length > 2 && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                +{roomTypes.length - 2} more
              </span>
            )}
          </div>

          {/* Student-Facing Live Availability Feed */}
          {totalBeds > 0 && (
            <div className="mt-2 mb-1 flex items-center justify-between text-xs px-2.5 py-1.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50 shadow-2xs">
              <span className="px-2 py-0.5 bg-blue-100/70 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-md font-medium text-[11px]">
                👥 {activeStudentsHoused} Students Housed
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                {availableBeds} Beds Available
              </span>
            </div>
          )}
        </div>

        <div>
          <Separator className="my-3 opacity-60 dark:border-stone-800" />

          {/* Price & CTA */}
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                From
              </span>
              <span className="text-xl text-gray-900 dark:text-amber-400 font-bold tracking-tight">
                GH₵{displayPrice > 0 ? displayPrice.toLocaleString() : "Contact"}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs font-normal"> / year</span>
            </div>

            <Button
              asChild
              size="sm"
              className={cn(
                "rounded-lg px-4 py-2 font-medium text-xs shadow-sm gap-1 transition-colors",
                isSoldOut
                  ? "bg-slate-800 hover:bg-slate-900 text-white border border-slate-700"
                  : "bg-[#6B1D2F] hover:bg-[#521422] text-white"
              )}
            >
              <Link href={`/hostels/${cleanId}`}>
                {isSoldOut ? (
                  <>
                    <Lock className="h-3.5 w-3.5 text-rose-400" />
                    <span>View (Sold Out)</span>
                  </>
                ) : (
                  <>
                    <span>View Details</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
      </Card>
    </>
  );
}
