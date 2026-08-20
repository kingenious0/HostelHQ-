
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { MessageSquare, PhoneCall } from "lucide-react";

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
        <section className="relative w-full overflow-hidden bg-slate-900 min-h-[600px] flex items-center">
            {/* Immersive Video Background with Premium Glassmorphism Overlay */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <video
                    className="absolute inset-0 h-full w-full object-cover scale-105 animate-slow-zoom brightness-[0.5] contrast-[1.1]"
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src="/videos/building-tour.mp4" type="video/mp4" />
                </video>

                {/* Advanced Glassmorphism & Gradient Overlays */}
                <div className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[4px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-slate-900/10 to-background" />
                <div className="absolute inset-0 bg-black/10" /> {/* Slight extra tint for text contrast */}

                {/* Glow Effects */}
                <div
                    className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[130px] animate-pulse"
                    style={{ animationDuration: '10s' }}
                />
                <div
                    className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] animate-pulse"
                    style={{ animationDuration: '15s', animationDelay: '3s' }}
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-20 sm:px-6 lg:px-10">
                <div className="max-w-3xl reveal active">
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur-md mb-8 animate-float">
                        ✨ Trusted by 5,000+ students across Ghana
                    </span>
                    <h1 className="text-4xl font-headline font-extrabold text-white leading-[1.1] sm:text-6xl lg:text-7xl mb-8">
                        Your next home, <br />
                        <span className="text-accent underline decoration-primary/30 underline-offset-8">verified</span> & <span className="text-white/90">secure.</span>
                    </h1>
                    <p className="max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl mb-12">
                        HostelHQ is Ghana's most trusted platform for student housing. Find verified hostels with transparent pricing and instant booking.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-5">
                        <Button
                            asChild
                            size="lg"
                            className="h-16 px-10 w-full rounded-2xl bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 sm:w-auto transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Link href="/contact" className="flex items-center gap-3">
                                <PhoneCall className="h-5 w-5" />
                                Talk to an Advisor
                            </Link>
                        </Button>

                        {!loading && !user && (
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="h-16 px-10 w-full rounded-2xl border-white/10 bg-white/5 text-white backdrop-blur-md hover:bg-white/10 sm:w-auto transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Link href="/signup">Create Account</Link>
                            </Button>
                        )}

                        {!loading && user && (
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="h-16 px-10 w-full rounded-2xl border-white/10 bg-white/5 text-white backdrop-blur-md hover:bg-white/10 sm:w-auto transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Link href="/help-center" className="flex items-center gap-3">
                                    <MessageSquare className="h-5 w-5" />
                                    Help Center
                                </Link>
                            </Button>
                        )}
                    </div>

                    <div className="mt-12 flex items-center gap-8 text-white/40">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-white/80">100%</span>
                            <span className="text-[10px] uppercase tracking-widest">Verified Listings</span>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-white/80">0</span>
                            <span className="text-[10px] uppercase tracking-widest">Hidden Fees</span>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-white/80">24/7</span>
                            <span className="text-[10px] uppercase tracking-widest">Student Support</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
