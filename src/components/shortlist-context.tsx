"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Hostel } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

type ShortlistContextType = {
  shortlist: Hostel[];
  isShortlisted: (id: string) => boolean;
  toggleShortlist: (hostel: Hostel) => void;
  removeFromShortlist: (id: string) => void;
  clearShortlist: () => void;
};

const ShortlistContext = createContext<ShortlistContextType | undefined>(undefined);

const STORAGE_KEY = "hostelhq_shortlist_v1";
const MAX_SHORTLIST = 3;

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [shortlist, setShortlist] = useState<Hostel[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setShortlist(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load shortlist from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist));
      } catch (e) {
        console.warn("Failed to save shortlist to localStorage", e);
      }
    }
  }, [shortlist, isLoaded]);

  const isShortlisted = useCallback(
    (id: string) => shortlist.some((item) => item.id === id),
    [shortlist]
  );

  const toggleShortlist = useCallback(
    (hostel: Hostel) => {
      setShortlist((prev) => {
        const exists = prev.some((item) => item.id === hostel.id);
        if (exists) {
          toast({
            title: "Removed from Shortlist",
            description: `${hostel.name} has been removed from your comparison list.`,
          });
          return prev.filter((item) => item.id !== hostel.id);
        }

        if (prev.length >= MAX_SHORTLIST) {
          toast({
            title: "Shortlist Limit Reached",
            description: `You can compare up to ${MAX_SHORTLIST} hostels. Remove one to add this hostel.`,
            variant: "destructive",
          });
          return prev;
        }

        toast({
          title: "Added to Shortlist ✓",
          description: `${hostel.name} added! Click Compare at the bottom to view side-by-side.`,
        });
        return [...prev, hostel];
      });
    },
    [toast]
  );

  const removeFromShortlist = useCallback((id: string) => {
    setShortlist((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearShortlist = useCallback(() => {
    setShortlist([]);
  }, []);

  return (
    <ShortlistContext.Provider
      value={{
        shortlist,
        isShortlisted,
        toggleShortlist,
        removeFromShortlist,
        clearShortlist,
      }}
    >
      {children}
    </ShortlistContext.Provider>
  );
}

const defaultContext: ShortlistContextType = {
  shortlist: [],
  isShortlisted: () => false,
  toggleShortlist: () => {},
  removeFromShortlist: () => {},
  clearShortlist: () => {},
};

export function useShortlist() {
  const context = useContext(ShortlistContext);
  return context || defaultContext;
}
