"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShortlist } from "@/components/shortlist-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Scale,
  X,
  MapPin,
  Clock,
  Users,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export function HostelCompareDrawer() {
  const { shortlist, removeFromShortlist, clearShortlist } = useShortlist();
  const [isOpen, setIsOpen] = useState(false);

  if (!shortlist || shortlist.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Bar (Amber Student-style) */}
      <aside
        aria-label="Hostel comparison drawer"
        className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-slate-950/95 text-white backdrop-blur-xl border border-white/15 rounded-3xl p-3 sm:p-4 shadow-2xl shadow-black/40 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-6 duration-300"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center -space-x-3 shrink-0">
            {shortlist.map((hostel) => (
              <div
                key={hostel.id}
                className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl overflow-hidden border-2 border-slate-900 shadow-md bg-slate-800"
              >
                <Image
                  src={
                    hostel.images?.[0] && !hostel.images[0].includes("placeholder")
                      ? hostel.images[0]
                      : "/AAMUSTED-Full-shot.jpeg"
                  }
                  alt={hostel.name}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                {shortlist.length === 1
                  ? shortlist[0].name
                  : `${shortlist.length} Hostels Shortlisted`}
              </span>
              <span className="text-[10px] bg-primary/20 text-primary-foreground font-semibold px-2 py-0.5 rounded-full border border-primary/30 shrink-0">
                {shortlist.length}/3
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {shortlist.length < 2
                ? "Add at least 1 more hostel to compare side-by-side"
                : "Ready to compare prices, distance & amenities"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearShortlist}
            className="text-slate-400 hover:text-white text-xs px-2 h-9 rounded-xl hidden sm:inline-flex"
          >
            Clear
          </Button>

          <Button
            size="sm"
            onClick={() => setIsOpen(true)}
            disabled={shortlist.length < 2}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm shadow-lg shadow-primary/25 flex items-center gap-2"
          >
            <Scale className="h-4 w-4" />
            <span>Compare {shortlist.length > 1 ? `(${shortlist.length})` : ""}</span>
          </Button>
        </div>
      </aside>

      {/* Side-by-Side Comparison Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-8 rounded-[2rem] bg-background border-border shadow-2xl">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
              <Sparkles className="h-4 w-4" />
              Side-by-Side Comparison
            </div>
            <DialogTitle className="text-2xl sm:text-3xl font-headline font-extrabold text-foreground">
              Compare Your Shortlisted Hostels
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Review verified prices, distance to campus, room options, and security features side by side.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-2">
            {shortlist.map((hostel) => {
              const minPrice = hostel.priceRange?.min || (hostel.roomTypes?.[0]?.price ?? 0);
              const maxPrice = hostel.priceRange?.max || minPrice;

              return (
                <div
                  key={hostel.id}
                  className="rounded-3xl border border-border bg-card p-4 sm:p-5 flex flex-col relative group hover:border-primary/40 transition-all shadow-sm"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromShortlist(hostel.id)}
                    className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80"
                    title="Remove from comparison"
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  {/* Image & Verified Badge */}
                  <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-4 bg-muted">
                    <Image
                      src={
                        hostel.images?.[0] && !hostel.images[0].includes("placeholder")
                          ? hostel.images[0]
                          : "/AAMUSTED-Full-shot.jpeg"
                      }
                      alt={hostel.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-emerald-600/95 text-white border-0 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        University-Approved ✓
                      </Badge>
                    </div>
                  </div>

                  {/* Hostel Details */}
                  <h4 className="text-xl font-headline font-extrabold text-foreground mb-1 leading-tight">
                    {hostel.name}
                  </h4>
                  <div className="flex items-center text-xs text-muted-foreground mb-4 truncate">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                    <span className="truncate">{hostel.location}</span>
                  </div>

                  {/* Key Metrics Comparison Block */}
                  <div className="space-y-3 py-3 border-y border-border/60 text-xs mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Price / Academic Year:</span>
                      <span className="font-extrabold text-primary text-sm">
                        GH₵{minPrice.toLocaleString()}{" "}
                        {maxPrice > minPrice ? `- ${maxPrice.toLocaleString()}` : ""}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Distance to Campus:
                      </span>
                      <span className="font-semibold text-foreground">
                        {hostel.distanceToUniversity || "Near Campus"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Gender:
                      </span>
                      <Badge variant="outline" className="font-semibold rounded-lg text-[10px]">
                        {hostel.gender || "Mixed"} Students
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Availability:</span>
                      <Badge
                        className={`text-[10px] font-bold rounded-lg ${
                          hostel.availability === "Available"
                            ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400"
                            : hostel.availability === "Limited"
                            ? "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400"
                            : "bg-rose-500/15 text-rose-700 border-rose-300 dark:text-rose-400"
                        }`}
                        variant="outline"
                      >
                        {hostel.availability}
                      </Badge>
                    </div>
                  </div>

                  {/* Room Types Available */}
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Room Types
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(hostel.roomTypes || []).slice(0, 4).map((rt, i) => (
                        <span
                          key={i}
                          className="bg-muted/70 text-foreground text-[10px] font-medium px-2 py-0.5 rounded-md border border-border/50"
                        >
                          {rt.name} (GH₵{rt.price?.toLocaleString()})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Key Amenities */}
                  <div className="mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Top Amenities
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                      {(hostel.amenities || []).slice(0, 6).map((amenity, i) => (
                        <span key={i} className="flex items-center gap-1 truncate">
                          <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{amenity}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Direct Action Button */}
                  <Button asChild className="w-full mt-auto rounded-2xl h-11 bg-primary text-white font-bold text-xs gap-2">
                    <Link href={`/hostels/${hostel.id}`}>
                      View Details & Request Visit
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
