"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ShieldCheck,
  Search,
  CalendarCheck,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export function Hero() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-slate-950 text-white">
      {/* Background with Ambient Glow */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[140px] rounded-full"
        />
        <div
          className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full"
        />
      </div>

      {/* Main Hero Header */}
      <div className="relative z-10 container mx-auto px-4 pt-16 pb-12 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Official University Trust Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-400 backdrop-blur-md mb-6 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            <span>Official University Accommodation Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-headline font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Find university-approved hostels.{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Zero unauthorized fees.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
            Connect directly with registered hostel managers under the oversight of USTED.
            Explore verified rooms, request free in-person visits, and book safely with official tenancy agreements.
          </p>

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto pt-2 pb-4 text-center border-y border-white/10">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">100%</div>
              <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">University Approved</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">GH₵ 0</div>
              <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Middleman Markup</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">Verified</div>
              <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Student Access</div>
            </div>
          </div>
        </div>
      </div>

      {/* Student.com-style 3-Step "How It Works" Strip */}
      <div className="relative z-10 border-t border-white/10 bg-slate-900/60 backdrop-blur-md py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Step 1 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 text-primary flex items-center justify-center shrink-0 font-extrabold text-sm">
                1
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  Explore Registered Hostels
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Browse vetted properties filtered by campus, exact distance, and audited prices.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-sm">
                2
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Request a Free Visit
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Send your verified student profile to the manager and get directions to tour in person.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="h-10 w-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 font-extrabold text-sm">
                3
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                  Book with Oversight
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pay securely with tenancy agreement generation and direct university complaint channels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
