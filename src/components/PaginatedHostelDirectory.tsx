"use client";

import React, { useState, useMemo } from "react";
import type { Hostel } from "@/lib/data";
import { HostelCard } from "@/components/hostel-card";
import { ArrowRight, Filter } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function useDirectoryPagination<T>(items: T[], pageSize = 12) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return { currentPage, setCurrentPage, totalPages, paginatedItems };
}

interface PaginatedHostelDirectoryProps {
  hostels: (Hostel & {
    activeStudentsHoused?: number;
    totalBeds?: number;
    availableBeds?: number;
    occupancyRate?: number;
  })[];
}

export function PaginatedHostelDirectory({ hostels }: PaginatedHostelDirectoryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Hostels" },
    { id: "fresher", label: "🎓 Fresher-Friendly" },
    { id: "male", label: "👦 Male Only" },
    { id: "female", label: "👧 Female Only" },
    { id: "mixed", label: "👫 Mixed" },
    { id: "under_3000", label: "💰 Under GH₵3,000" },
  ];

  const filteredHostels = useMemo(() => {
    return hostels.filter((h) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "fresher") {
        return (
          h.tags?.some((t: string) => t.toLowerCase().includes("fresher")) ||
          h.description?.toLowerCase().includes("fresher") ||
          h.roomTypes?.some((r: any) => r.price <= 3500)
        );
      }
      if (selectedCategory === "male") {
        return (h.gender || "").toLowerCase() === "male";
      }
      if (selectedCategory === "female") {
        return (h.gender || "").toLowerCase() === "female";
      }
      if (selectedCategory === "mixed") {
        const g = (h.gender || "").toLowerCase();
        return g === "mixed" || g === "co-ed" || !g;
      }
      if (selectedCategory === "under_3000") {
        const minPrice = Math.min(...(h.roomTypes?.map((r) => r.price) || [h.price || 99999]));
        return minPrice <= 3000;
      }
      return true;
    });
  }, [hostels, selectedCategory]);

  const { currentPage, setCurrentPage, totalPages, paginatedItems } = useDirectoryPagination(
    filteredHostels,
    12
  );

  return (
    <div className="space-y-6">
      {/* Sticky / Horizontally Scrollable Filter Headers (PRD Section 6) */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-md -mx-4 px-4 py-2 border-b border-border/40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:border-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1 shrink-0">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setCurrentPage(1);
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border",
                selectedCategory === cat.id
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}

          <span className="text-[11px] font-medium text-muted-foreground ml-auto pl-2 shrink-0">
            Showing {filteredHostels.length} verified listings
          </span>
        </div>
      </div>

      {/* Hostels Grid: Mobile Compact Cards (< md) & Desktop Grid (>= md) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {paginatedItems.map((hostel) => (
          <HostelCard key={hostel.id} hostel={hostel as any} />
        ))}
      </div>

      {/* Empty State */}
      {filteredHostels.length === 0 && (
        <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed border-border/80">
          <p className="text-muted-foreground text-sm font-medium">
            No verified accommodation matching the selected filter was found.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setCurrentPage(1);
            }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <span>Reset filters and view all hostels</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Mobile-Responsive Pagination Bar UI (PRD Section 6) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4 border-t border-border/60 mt-6">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage((prev) => Math.max(prev - 1, 1));
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            className="px-3.5 py-1.5 text-xs font-bold bg-card border border-border rounded-xl text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs"
          >
            ← Prev
          </button>

          <span className="text-xs font-bold text-muted-foreground tracking-wide">
            Page <span className="text-foreground font-black">{currentPage}</span> of{" "}
            <span className="text-foreground font-black">{totalPages}</span>
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage((prev) => Math.min(prev + 1, totalPages));
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            className="px-3.5 py-1.5 text-xs font-bold bg-card border border-border rounded-xl text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
