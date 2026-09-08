"use client";

import React from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { isHostelRevoked, isHostelSanctioned, SANCTION_MESSAGES, HostelSanctionFields } from "@/lib/sanctions";
import { cn } from "@/lib/utils";

interface SanctionBannerProps {
  hostel?: HostelSanctionFields | null;
  className?: string;
  showBadge?: boolean;
}

/**
 * Non-dismissible statutory warning and revocation banner for sanctioned properties.
 * Adheres to semantic utility classes:
 * - Amber for Executive Sanction
 * - Rose for Accreditation Revoked
 */
export function SanctionBanner({ hostel, className, showBadge = true }: SanctionBannerProps) {
  if (!hostel) return null;

  const revoked = isHostelRevoked(hostel);
  const sanctioned = isHostelSanctioned(hostel);

  if (!revoked && !sanctioned) return null;

  if (revoked) {
    return (
      <aside
        aria-label="Statutory Revocation Notice"
        className={cn(
          "w-full rounded-2xl border p-4 sm:p-5 shadow-sm transition-all animate-in fade-in-50 duration-200",
          "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200",
          className
        )}
      >
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5">
            <Ban className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-rose-950 dark:text-rose-100">
                University Charter Accreditation Revoked
              </span>
              {showBadge && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                  Gateways Locked
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium leading-relaxed">
              {SANCTION_MESSAGES.ACCREDITATION_REVOKED}
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Executive Notice"
      className={cn(
        "w-full rounded-2xl border p-4 sm:p-5 shadow-sm transition-all animate-in fade-in-50 duration-200",
        "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200",
        className
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-tight text-amber-950 dark:text-amber-100">
              Executive Notice: Welfare &amp; Regulatory Review
            </span>
            {showBadge && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                Bookings Paused
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-medium leading-relaxed">
            {SANCTION_MESSAGES.EXECUTIVE_SANCTION}
          </p>
        </div>
      </div>
    </aside>
  );
}
