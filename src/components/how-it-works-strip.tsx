import React from "react";
import { Search, CalendarCheck, ShieldCheck } from "lucide-react";

export function HowItWorksStrip() {
  return (
    <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-10">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-primary mb-2">
          Simple 3-Step Process
        </h3>
        <h2 className="text-2xl sm:text-3xl font-headline font-extrabold text-foreground tracking-tight">
          How HostelHQ Works
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Designed with university leadership to protect students from predatory agents and unverified listings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-5 rounded-3xl bg-card border border-border/70 shadow-sm hover:border-primary/40 transition-all">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 font-extrabold text-base">
            1
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Search className="h-4 w-4 text-primary" />
              Explore Registered Hostels
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Browse university-vetted properties filtered by campus, exact distance, and audited student prices.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-5 rounded-3xl bg-card border border-border/70 shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-base">
            2
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground mb-1 flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Request a Free Visit
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Send your verified student profile to the manager and get directions to tour the room in person.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-4 p-5 rounded-3xl bg-card border border-border/70 shadow-sm hover:border-teal-500/40 transition-all">
          <div className="h-11 w-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 font-extrabold text-base">
            3
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-foreground mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Book with Oversight
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Secure your room with automated tenancy agreement generation and direct Dean arbitration channels.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
