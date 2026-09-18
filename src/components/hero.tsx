"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden min-h-[460px] lg:min-h-[500px] flex items-center justify-center py-16 sm:py-24">
      {/* Real Student Housing Background Photo */}
      <Image
        src="/hero-student-housing.jpg"
        alt="Modern university student hostel room and campus view"
        fill
        priority
        className="object-cover object-center z-0"
      />

      {/* Subtle Dark Gradient Overlay for Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/90 z-0 pointer-events-none" />

      {/* Hero Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-10 text-center flex flex-col items-center">
        {/* Official University Trust Pill with Crest */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/50 bg-slate-950/80 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md mb-6 shadow-lg">
          <div className="relative h-5 w-5 shrink-0">
            <Image
              src="/usted logo.png"
              alt="USTED Crest"
              fill
              sizes="20px"
              className="object-contain"
              priority
            />
          </div>
          <span>University of Skills Training and Entrepreneurial Development (USTED)</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-headline font-extrabold tracking-tight text-white leading-[1.15] max-w-3xl mb-5">
          Find university-approved hostels.{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
            Direct & verified rates.
          </span>
        </h1>

        {/* Minimal Direct Subtext */}
        <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed mb-8 max-w-2xl mx-auto font-normal">
          Connect directly with registered hostel managers under the official oversight of the University of Skills Training and Entrepreneurial Development (USTED).
        </p>

        {/* Single Primary CTA Button */}
        <div>
          <Button
            asChild
            size="lg"
            className="rounded-full h-12 sm:h-13 px-8 bg-primary hover:bg-primary/90 text-white font-bold text-sm sm:text-base shadow-xl shadow-primary/30 transition-all hover:scale-105"
          >
            <Link href="#all-hostels" className="flex items-center gap-2">
              <span>Explore Verified Hostels</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
