"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CAMPUS_IMAGES = [
  {
    src: "/images/usted/campus-1.jpg",
    alt: "USTED Campus Walkway and Student Residences",
  },
  {
    src: "/images/usted/campus-2.jpg",
    alt: "USTED Main Campus Quad and Aerial Facilities",
  },
  {
    src: "/images/usted/campus-3.jpg",
    alt: "USTED University Campus Complex and Administration",
  },
];

export function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-rotating background carousel (5.5s interval with 1000ms cross-fade)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % CAMPUS_IMAGES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full overflow-hidden min-h-[480px] lg:min-h-[520px] flex items-center justify-center py-16 sm:py-24">
      {/* Background Campus Photo Carousel with Smooth Cross-Fade */}
      {CAMPUS_IMAGES.map((img, index) => (
        <div
          key={img.src}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out z-0",
            index === currentImageIndex ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <Image
            src={img.src}
            alt={img.alt}
            fill
            priority={index === 0}
            className="object-cover object-center"
          />
        </div>
      ))}

      {/* Unified Brand Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#6B1D2F]/90 via-[#6B1D2F]/75 to-black/80 z-0 pointer-events-none" />

      {/* Hero Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-10 text-center flex flex-col items-center">
        {/* Official University Trust Pill with Crest */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/50 bg-black/50 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md mb-6 shadow-lg">
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

        {/* Directorate Subtext */}
        <p className="text-sm sm:text-base text-slate-100/90 leading-relaxed mb-8 max-w-2xl mx-auto font-normal">
          Connect directly with registered hostel managers under the official oversight of the Directorate of Student Affairs.
        </p>

        {/* Single Primary CTA Button */}
        <div>
          <Button
            asChild
            size="lg"
            className="rounded-full h-12 sm:h-13 px-8 bg-[#6B1D2F] hover:bg-[#6B1D2F]/90 text-white font-bold text-sm sm:text-base shadow-xl shadow-black/40 border border-white/20 transition-all hover:scale-105"
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
