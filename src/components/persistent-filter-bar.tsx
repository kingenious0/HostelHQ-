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
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Sparkles,
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
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);

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
    <div className="sticky top-16 z-30 w-full bg-background/85 backdrop-blur-xl border-y border-border/60 py-2.5 transition-all duration-300 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          
          {/* ========================================================================= */}
          {/* DESKTOP & LAPTOP VIEW: Sleek horizontal pill toolbar (Airbnb / Student.com) */}
          {/* ========================================================================= */}
          <div className="hidden md:flex items-center justify-between gap-3 w-full">
            {/* Scrollable pill container so it never wraps awkwardly */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
              
              {/* 1. All Filters Comprehensive Modal Button */}
              <Dialog open={isDesktopModalOpen} onOpenChange={setIsDesktopModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-bold gap-2 border transition-all ${
                      activeCount > 0
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/80 bg-card hover:bg-accent/40 text-foreground hover:border-foreground/30"
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    <span>All Filters</span>
                    {activeCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1.5 text-[10px] bg-primary text-white font-extrabold rounded-full">
                        {activeCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-background border-border">
                  <DialogHeader className="mb-2 text-left">
                    <DialogTitle className="text-xl font-headline font-extrabold text-foreground flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-primary" />
                      Filter & Refine Hostels
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6 py-2">
                    {/* Campus Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Campus / University</label>
                      <Select
                        value={institution || "ALL"}
                        onValueChange={(val) => setInstitution(val === "ALL" ? "" : val)}
                      >
                        <SelectTrigger className="w-full h-11 rounded-xl text-xs">
                          <SelectValue placeholder="Select Campus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Campuses</SelectItem>
                          <SelectItem value="KNUST KUMASI CAMPUS">KNUST Kumasi</SelectItem>
                          <SelectItem value="A A M U S T E D">AAMUSTED</SelectItem>
                          <SelectItem value="UNIVERSITY OF GHANA (UG)">University of Ghana (UG)</SelectItem>
                          <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KsTU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Price per Academic Year (GH₵)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="number"
                          placeholder="Min GH₵ (e.g. 2000)"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          className="h-11 rounded-xl text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Max GH₵ (e.g. 8000)"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          className="h-11 rounded-xl text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { label: "Under 3K", min: "", max: "3000" },
                          { label: "3K - 5K", min: "3000", max: "5000" },
                          { label: "5K - 8K", min: "5000", max: "8000" },
                          { label: "8K+", min: "8000", max: "" },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setMinPrice(preset.min);
                              setMaxPrice(preset.max);
                            }}
                            className="text-[11px] px-3 py-1 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground font-medium transition"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Room Type */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Room Type</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {["1 IN A ROOM", "2 IN A ROOM", "3 IN A ROOM", "4 IN A ROOM"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setRoomType(roomType === type ? "" : type)}
                            className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                              roomType === type
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gender Preference */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Gender Accommodation</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Mixed", "Male", "Female"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(gender === g ? "" : g)}
                            className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                              gender === g
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                            }`}
                          >
                            {g === "Mixed" ? "Mixed" : `${g} Only`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Maximum Walking Distance</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Under 5 mins", val: "5" },
                          { label: "Under 10 mins", val: "10" },
                          { label: "Under 15 mins", val: "15" },
                        ].map((d) => (
                          <button
                            key={d.val}
                            type="button"
                            onClick={() => setDistance(distance === d.val ? "" : d.val)}
                            className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                              distance === d.val
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="mt-6 flex flex-row gap-2 pt-3 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        clearAll();
                        setIsDesktopModalOpen(false);
                      }}
                      className="flex-1 h-11 rounded-xl text-xs font-bold"
                    >
                      Reset All
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        updateFilters({
                          institution,
                          roomType,
                          gender,
                          minPrice,
                          maxPrice,
                          distance,
                        });
                        setIsDesktopModalOpen(false);
                      }}
                      className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-white"
                    >
                      Show Results
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="h-5 w-px bg-border/80 shrink-0 mx-0.5" />

              {/* 2. Campus Quick Dropdown Pill */}
              <div className="shrink-0">
                <Select
                  value={institution || "ALL"}
                  onValueChange={(val) => {
                    const next = val === "ALL" ? "" : val;
                    setInstitution(next);
                    updateFilters({ institution: next });
                  }}
                >
                  <SelectTrigger
                    className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-semibold gap-1.5 border transition-all ${
                      institution
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-card border-border/80 text-foreground hover:border-foreground/30 hover:bg-accent/40"
                    }`}
                  >
                    <Building className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate max-w-[130px]">
                      {institution ? (institution === "KNUST KUMASI CAMPUS" ? "KNUST" : institution === "A A M U S T E D" ? "AAMUSTED" : institution === "UNIVERSITY OF GHANA (UG)" ? "UG Legon" : institution) : "All Campuses"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl">
                    <SelectItem value="ALL">All Campuses</SelectItem>
                    <SelectItem value="KNUST KUMASI CAMPUS">KNUST Kumasi</SelectItem>
                    <SelectItem value="A A M U S T E D">AAMUSTED</SelectItem>
                    <SelectItem value="UNIVERSITY OF GHANA (UG)">UG Legon</SelectItem>
                    <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">KsTU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Price Filter Popover Pill */}
              <div className="shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-semibold gap-1.5 border transition-all ${
                        minPrice || maxPrice
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                          : "bg-card border-border/80 text-foreground hover:border-foreground/30 hover:bg-accent/40"
                      }`}
                    >
                      <DollarSign className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span>
                        {minPrice || maxPrice
                          ? `GH₵${minPrice || "0"} - ${maxPrice ? `GH₵${maxPrice}` : "Any"}`
                          : "Price Range"}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
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
              </div>

              {/* 4. Room Type Select Pill */}
              <div className="shrink-0">
                <Select
                  value={roomType || "ALL"}
                  onValueChange={(val) => {
                    const next = val === "ALL" ? "" : val;
                    setRoomType(next);
                    updateFilters({ roomType: next });
                  }}
                >
                  <SelectTrigger
                    className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-semibold gap-1.5 border transition-all ${
                      roomType
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-card border-border/80 text-foreground hover:border-foreground/30 hover:bg-accent/40"
                    }`}
                  >
                    <DoorOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate max-w-[120px]">
                      {roomType || "Room Type"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl">
                    <SelectItem value="ALL">All Room Types</SelectItem>
                    <SelectItem value="1 IN A ROOM">1 in a Room</SelectItem>
                    <SelectItem value="2 IN A ROOM">2 in a Room</SelectItem>
                    <SelectItem value="3 IN A ROOM">3 in a Room</SelectItem>
                    <SelectItem value="4 IN A ROOM">4 in a Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Distance Select Pill */}
              <div className="shrink-0">
                <Select
                  value={distance || "ALL"}
                  onValueChange={(val) => {
                    const next = val === "ALL" ? "" : val;
                    setDistance(next);
                    updateFilters({ distance: next });
                  }}
                >
                  <SelectTrigger
                    className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-semibold gap-1.5 border transition-all ${
                      distance
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-card border-border/80 text-foreground hover:border-foreground/30 hover:bg-accent/40"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate max-w-[120px]">
                      {distance ? `≤ ${distance} mins` : "Distance"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl">
                    <SelectItem value="ALL">Any Distance</SelectItem>
                    <SelectItem value="5">Under 5 mins walk</SelectItem>
                    <SelectItem value="10">Under 10 mins walk</SelectItem>
                    <SelectItem value="15">Under 15 mins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 6. Gender Select Pill */}
              <div className="shrink-0">
                <Select
                  value={gender || "ALL"}
                  onValueChange={(val) => {
                    const next = val === "ALL" ? "" : val;
                    setGender(next);
                    updateFilters({ gender: next });
                  }}
                >
                  <SelectTrigger
                    className={`!w-auto shrink-0 h-9.5 rounded-full px-3.5 text-xs font-semibold gap-1.5 border transition-all ${
                      gender
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-card border-border/80 text-foreground hover:border-foreground/30 hover:bg-accent/40"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate max-w-[110px]">
                      {gender || "Gender"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-xl">
                    <SelectItem value="ALL">All Genders</SelectItem>
                    <SelectItem value="Mixed">Mixed Hostels</SelectItem>
                    <SelectItem value="Male">Male Students Only</SelectItem>
                    <SelectItem value="Female">Female Students Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right: Results Count & Clear All */}
            <div className="flex items-center gap-2 shrink-0 pl-2">
              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="rounded-full h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1 font-semibold transition-all"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear</span>
                </Button>
              )}

              {typeof totalCount === "number" && (
                <div className="text-xs font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/40 shrink-0">
                  <span className="text-foreground font-extrabold">{totalCount}</span> {totalCount === 1 ? "Hostel" : "Hostels"}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE VIEW: Bottom Sheet Drawer (Kept exactly as the user loves it)       */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-2 md:hidden w-full">
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
        </div>

        {/* Active Filter Chips Row (Below pills) */}
        {activeCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Active:
            </span>

            {institution && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 border border-primary/20">
                <span>Campus: {institution === "KNUST KUMASI CAMPUS" ? "KNUST" : institution === "A A M U S T E D" ? "AAMUSTED" : institution}</span>
                <button type="button" onClick={() => updateFilters({ institution: "" })} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {roomType && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 border border-primary/20">
                <span>Room: {roomType}</span>
                <button type="button" onClick={() => updateFilters({ roomType: "" })} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 border border-primary/20">
                <span>Price: GH₵{minPrice || "0"} - {maxPrice ? `GH₵${maxPrice}` : "Any"}</span>
                <button type="button" onClick={() => updateFilters({ minPrice: "", maxPrice: "" })} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {gender && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 border border-primary/20">
                <span>Gender: {gender}</span>
                <button type="button" onClick={() => updateFilters({ gender: "" })} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {distance && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 border border-primary/20">
                <span>Distance: ≤ {distance} mins</span>
                <button type="button" onClick={() => updateFilters({ distance: "" })} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground ml-2 shrink-0 underline underline-offset-2"
            >
              Reset all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
