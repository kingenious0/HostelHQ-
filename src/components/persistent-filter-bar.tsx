"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  SlidersHorizontal,
  RotateCcw,
  X,
  ChevronDown,
  DollarSign,
  DoorOpen,
  Clock,
  Users,
  Building,
  Check,
} from "lucide-react";

export function PersistentFilterBar({ totalCount }: { totalCount?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local filter states initialized from URL
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [institution, setInstitution] = useState(searchParams.get("institution") || "");
  const [roomType, setRoomType] = useState(searchParams.get("roomType") || "");
  const [gender, setGender] = useState(searchParams.get("gender") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [distance, setDistance] = useState(searchParams.get("distance") || "");
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Sync state with URL when searchParams change
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setInstitution(searchParams.get("institution") || "");
    setRoomType(searchParams.get("roomType") || "");
    setGender(searchParams.get("gender") || "");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
    setDistance(searchParams.get("distance") || "");
  }, [searchParams]);

  const updateFilters = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 on filter changes
      params.delete("page");

      const combined = {
        search,
        institution,
        roomType,
        gender,
        minPrice,
        maxPrice,
        distance,
        ...overrides,
      };

      Object.entries(combined).forEach(([key, val]) => {
        if (val && val.trim() !== "") {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      });

      router.push(`/?${params.toString()}#all-hostels`, { scroll: false });
    },
    [router, searchParams, search, institution, roomType, gender, minPrice, maxPrice, distance]
  );

  const clearAll = () => {
    setSearch("");
    setInstitution("");
    setRoomType("");
    setGender("");
    setMinPrice("");
    setMaxPrice("");
    setDistance("");
    router.push("/#all-hostels", { scroll: false });
  };

  // Active filter count
  const activeCount = [
    institution,
    roomType,
    gender,
    minPrice,
    maxPrice,
    distance,
    search,
  ].filter(Boolean).length;

  return (
    <div className="sticky top-16 z-30 w-full bg-background/80 backdrop-blur-xl border-y border-border/50 py-3 transition-all duration-300 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Quick Filter Controls (HousingAnywhere-style desktop pills) */}
          <div className="hidden lg:flex items-center gap-2 flex-wrap">
            {/* Price Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`rounded-full h-9 px-4 text-xs font-semibold gap-1.5 transition-all ${
                    minPrice || maxPrice
                      ? "bg-primary/10 border-primary text-primary"
                      : "hover:border-foreground/30 text-foreground"
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>
                    {minPrice || maxPrice
                      ? `GH₵${minPrice || "0"} - ${maxPrice ? `GH₵${maxPrice}` : "Any"}`
                      : "Price Range"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl bg-card border-border">
                <div className="space-y-3">
                  <div className="font-bold text-sm text-foreground">Price per Academic Year</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Min (GH₵)</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Max (GH₵)</label>
                      <Input
                        type="number"
                        placeholder="10,000"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Preset Price Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[
                      { label: "Under 3K", min: "", max: "3000" },
                      { label: "3K - 5K", min: "3000", max: "5000" },
                      { label: "5K+", min: "5000", max: "" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinPrice(preset.min);
                          setMaxPrice(preset.max);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-medium transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        updateFilters({ minPrice: "", maxPrice: "" });
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs rounded-xl font-bold bg-primary text-white"
                      onClick={() => updateFilters({ minPrice, maxPrice })}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Room Type Select */}
            <Select
              value={roomType || "ALL"}
              onValueChange={(val) => {
                const next = val === "ALL" ? "" : val;
                setRoomType(next);
                updateFilters({ roomType: next });
              }}
            >
              <SelectTrigger
                className={`rounded-full h-9 px-4 text-xs font-semibold gap-1.5 border ${
                  roomType
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:border-foreground/30 text-foreground"
                }`}
              >
                <DoorOpen className="h-3.5 w-3.5" />
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="ALL">All Room Types</SelectItem>
                <SelectItem value="1 IN A ROOM">1 in a Room</SelectItem>
                <SelectItem value="2 IN A ROOM">2 in a Room</SelectItem>
                <SelectItem value="3 IN A ROOM">3 in a Room</SelectItem>
                <SelectItem value="4 IN A ROOM">4 in a Room</SelectItem>
              </SelectContent>
            </Select>

            {/* Distance from Campus Select */}
            <Select
              value={distance || "ALL"}
              onValueChange={(val) => {
                const next = val === "ALL" ? "" : val;
                setDistance(next);
                updateFilters({ distance: next });
              }}
            >
              <SelectTrigger
                className={`rounded-full h-9 px-4 text-xs font-semibold gap-1.5 border ${
                  distance
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:border-foreground/30 text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <SelectValue placeholder="Distance from Campus" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="ALL">Any Distance</SelectItem>
                <SelectItem value="5">Under 5 mins walk</SelectItem>
                <SelectItem value="10">Under 10 mins walk</SelectItem>
                <SelectItem value="15">Under 15 mins</SelectItem>
              </SelectContent>
            </Select>

            {/* Institution Select */}
            <Select
              value={institution || "ALL"}
              onValueChange={(val) => {
                const next = val === "ALL" ? "" : val;
                setInstitution(next);
                updateFilters({ institution: next });
              }}
            >
              <SelectTrigger
                className={`rounded-full h-9 px-4 text-xs font-semibold gap-1.5 border ${
                  institution
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:border-foreground/30 text-foreground"
                }`}
              >
                <Building className="h-3.5 w-3.5" />
                <SelectValue placeholder="Campus" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="ALL">All Campuses</SelectItem>
                <SelectItem value="KNUST KUMASI CAMPUS">KNUST Kumasi</SelectItem>
                <SelectItem value="A A M U S T E D">AAMUSTED</SelectItem>
                <SelectItem value="UNIVERSITY OF GHANA (UG)">UG Legon</SelectItem>
                <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KsTU</SelectItem>
              </SelectContent>
            </Select>

            {/* Gender Select */}
            <Select
              value={gender || "ALL"}
              onValueChange={(val) => {
                const next = val === "ALL" ? "" : val;
                setGender(next);
                updateFilters({ gender: next });
              }}
            >
              <SelectTrigger
                className={`rounded-full h-9 px-4 text-xs font-semibold gap-1.5 border ${
                  gender
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:border-foreground/30 text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-xl">
                <SelectItem value="ALL">All Genders</SelectItem>
                <SelectItem value="Mixed">Mixed Hostels</SelectItem>
                <SelectItem value="Male">Male Students Only</SelectItem>
                <SelectItem value="Female">Female Students Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear All Desktop */}
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="rounded-full h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Mobile Filter Button & Count Badge */}
          <div className="flex items-center gap-2 lg:hidden w-full">
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-2xl h-11 px-4 text-xs font-bold gap-2 flex-1 justify-between bg-card border-border shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <span>Filters & Preferences</span>
                  </span>
                  {activeCount > 0 && (
                    <Badge className="bg-primary text-white font-extrabold h-5 px-2 text-[10px] rounded-full">
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>

              <SheetContent side="bottom" className="rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto bg-background border-border">
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle className="text-xl font-headline font-extrabold text-foreground">
                    Filter Hostels
                  </SheetTitle>
                </SheetHeader>

                <div className="space-y-5 py-2">
                  {/* Campus / Institution */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Campus</label>
                    <Select value={institution || "ALL"} onValueChange={(val) => setInstitution(val === "ALL" ? "" : val)}>
                      <SelectTrigger className="w-full h-12 rounded-xl text-xs">
                        <SelectValue placeholder="Select Campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Campuses</SelectItem>
                        <SelectItem value="KNUST KUMASI CAMPUS">KNUST Kumasi</SelectItem>
                        <SelectItem value="A A M U S T E D">AAMUSTED</SelectItem>
                        <SelectItem value="UNIVERSITY OF GHANA (UG)">University of Ghana</SelectItem>
                        <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KsTU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">Price Range (GH₵/year)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Min GH₵"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="h-11 rounded-xl text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Max GH₵"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="h-11 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {/* Room Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Room Type</label>
                    <Select value={roomType || "ALL"} onValueChange={(val) => setRoomType(val === "ALL" ? "" : val)}>
                      <SelectTrigger className="w-full h-12 rounded-xl text-xs">
                        <SelectValue placeholder="Any Room Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Any Room Type</SelectItem>
                        <SelectItem value="1 IN A ROOM">1 in a Room</SelectItem>
                        <SelectItem value="2 IN A ROOM">2 in a Room</SelectItem>
                        <SelectItem value="3 IN A ROOM">3 in a Room</SelectItem>
                        <SelectItem value="4 IN A ROOM">4 in a Room</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Gender Preference</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Mixed", "Male", "Female"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(gender === g ? "" : g)}
                          className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                            gender === g
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distance */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Maximum Distance</label>
                    <Select value={distance || "ALL"} onValueChange={(val) => setDistance(val === "ALL" ? "" : val)}>
                      <SelectTrigger className="w-full h-12 rounded-xl text-xs">
                        <SelectValue placeholder="Any Distance" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Any Distance</SelectItem>
                        <SelectItem value="5">Under 5 mins walk</SelectItem>
                        <SelectItem value="10">Under 10 mins walk</SelectItem>
                        <SelectItem value="15">Under 15 mins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SheetFooter className="mt-6 flex flex-row gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearAll();
                      setIsMobileSheetOpen(false);
                    }}
                    className="flex-1 h-12 rounded-2xl text-xs font-bold"
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={() => {
                      updateFilters({
                        institution,
                        roomType,
                        gender,
                        minPrice,
                        maxPrice,
                        distance,
                      });
                      setIsMobileSheetOpen(false);
                    }}
                    className="flex-1 h-12 rounded-2xl text-xs font-bold bg-primary text-white"
                  >
                    Show Results
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAll}
                className="h-11 w-11 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
                title="Clear all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Right: Results Count Indicator */}
          {typeof totalCount === "number" && (
            <div className="text-xs font-bold text-muted-foreground shrink-0 hidden sm:block">
              <span className="text-foreground">{totalCount}</span> {totalCount === 1 ? "listing" : "listings"} found
            </div>
          )}
        </div>

        {/* Active Filter Chips Row */}
        {activeCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
              Active:
            </span>

            {institution && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
                {institution}
                <button type="button" onClick={() => updateFilters({ institution: "" })}>
                  <X className="h-3 w-3 hover:text-primary/70" />
                </button>
              </span>
            )}

            {roomType && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
                {roomType}
                <button type="button" onClick={() => updateFilters({ roomType: "" })}>
                  <X className="h-3 w-3 hover:text-primary/70" />
                </button>
              </span>
            )}

            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
                GH₵{minPrice || "0"} - {maxPrice ? `GH₵${maxPrice}` : "Any"}
                <button type="button" onClick={() => updateFilters({ minPrice: "", maxPrice: "" })}>
                  <X className="h-3 w-3 hover:text-primary/70" />
                </button>
              </span>
            )}

            {gender && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
                {gender} Students
                <button type="button" onClick={() => updateFilters({ gender: "" })}>
                  <X className="h-3 w-3 hover:text-primary/70" />
                </button>
              </span>
            )}

            {distance && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
                Within {distance} mins
                <button type="button" onClick={() => updateFilters({ distance: "" })}>
                  <X className="h-3 w-3 hover:text-primary/70" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
