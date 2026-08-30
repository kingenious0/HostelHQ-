"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/search-form";
import { ShieldCheck, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden min-h-[520px] lg:min-h-[580px] flex items-center justify-center py-16 sm:py-20">
      {/* Real Student Housing Background Photo */}
      <Image
        src="/hero-student-housing.jpg"
        alt="Modern university student hostel room and campus view"
        fill
        priority
        className="object-cover object-center z-0"
      />

      {/* Subtle Dark Gradient Overlay for Text Legibility (not a heavy dark scrim) */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/85 z-0 pointer-events-none" />

      {/* Hero Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-10 text-center flex flex-col items-center">
        {/* Official University Trust Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-950/60 px-4 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-md mb-5 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Official University Accommodation Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-headline font-extrabold tracking-tight text-white leading-[1.15] max-w-3xl mb-4">
          Find university-approved hostels.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
            Zero unauthorized fees.
          </span>
        </h1>

        {/* One-line Subtext */}
        <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed mb-6 max-w-2xl mx-auto font-normal">
          Connect directly with registered hostel managers under the oversight of USTED — verified rooms, free in-person visits, and audited prices.
        </p>

        {/* Single Primary CTA */}
        <div className="mb-8">
          <Button
            asChild
            size="lg"
            className="rounded-full h-11 sm:h-12 px-7 bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-xl shadow-primary/30 transition-all hover:scale-105"
          >
            <Link href="#all-hostels" className="flex items-center gap-2">
              <span>Explore Verified Hostels</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Integrated Search Bar */}
        <div className="w-full max-w-4xl">
          <div className="rounded-[2.5rem] p-1.5 sm:p-2 bg-slate-950/80 backdrop-blur-xl border border-white/20 shadow-2xl">
            <h2 className="sr-only">Find a hostel</h2>
            <SearchForm />
          </div>
        </div>
      </div>
    </section>
  );
}
