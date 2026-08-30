"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Navigation,
  Building,
} from "lucide-react";
import { lookupGhanaPostGPSAction, GhanaPostLocationResult } from "@/app/actions/ghanapost";
import MapboxLocationPicker from "@/components/mapbox-location-picker";

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || "";

export interface HostelLocationData {
  lat: number | null;
  lng: number | null;
  address: string;
  digitalAddress?: string;
}

interface HostelLocationPickerProps {
  value: HostelLocationData;
  onChange: (location: {
    lat: number;
    lng: number;
    address: string;
    digitalAddress?: string;
  }) => void;
  disabled?: boolean;
}

export function HostelLocationPicker({
  value,
  onChange,
  disabled = false,
}: HostelLocationPickerProps) {
  const [digitalAddressInput, setDigitalAddressInput] = useState(value.digitalAddress || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedInfo, setResolvedInfo] = useState<GhanaPostLocationResult | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  // Map preview refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Sync internal digital address state with external changes
  useEffect(() => {
    if (value.digitalAddress && value.digitalAddress !== digitalAddressInput) {
      setDigitalAddressInput(value.digitalAddress);
    }
  }, [value.digitalAddress]);

  // Handle GhanaPostGPS digital address lookup
  const handleLookup = useCallback(
    async (codeToLookup?: string) => {
      const code = (codeToLookup || digitalAddressInput).trim().toUpperCase();
      if (!code) {
        setErrorMsg("Please enter a valid GhanaPostGPS code (e.g. AK-238-1489).");
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const result = await lookupGhanaPostGPSAction(code);

        if (!result.success || !result.data) {
          setErrorMsg(
            result.error ||
              "We couldn't find that address — check the code, or set your location manually below."
          );
          setIsLoading(false);
          return;
        }

        const data = result.data;
        setResolvedInfo(data);
        setDigitalAddressInput(data.digitalAddress);

        // Notify parent form of valid resolved coordinates
        onChange({
          lat: data.lat,
          lng: data.lng,
          address: data.formattedAddress,
          digitalAddress: data.digitalAddress,
        });
      } catch (err: any) {
        console.error("GhanaPostGPS lookup error:", err);
        setErrorMsg(
          "We couldn't reach the address service. Please check the code, or set your location manually below."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [digitalAddressInput, onChange]
  );

  // Initialize and update Mapbox live preview when lat/lng are set
  useEffect(() => {
    if (!value.lat || !value.lng || !mapContainerRef.current) return;

    const lat = value.lat;
    const lng = value.lng;

    if (!mapRef.current) {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 16,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        const marker = new mapboxgl.Marker({ color: "#059669" })
          .setLngLat([lng, lat])
          .addTo(map);
        markerRef.current = marker;
      });
    } else {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const marker = new mapboxgl.Marker({ color: "#059669" })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
        markerRef.current = marker;
      }
    }
  }, [value.lat, value.lng]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle manual Mapbox picker selection
  const handleManualLocationSelect = useCallback(
    (loc: { lat: number; lng: number; address: string }) => {
      onChange({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        digitalAddress: digitalAddressInput.trim() || undefined,
      });
      setErrorMsg(null);
    },
    [digitalAddressInput, onChange]
  );

  const hasValidCoordinates =
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    !isNaN(value.lat) &&
    !isNaN(value.lng) &&
    (value.lat !== 0 || value.lng !== 0);

  return (
    <div className="space-y-4">
      {/* Primary GhanaPostGPS Address Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ghanapost-input" className="text-sm font-semibold flex items-center gap-1.5">
            <Navigation className="h-4 w-4 text-primary" />
            GhanaPostGPS Digital Address *
          </Label>
          <span className="text-[11px] text-muted-foreground">Primary Location Method</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="ghanapost-input"
              placeholder="e.g., AK-238-1489"
              value={digitalAddressInput}
              onChange={(e) => {
                setDigitalAddressInput(e.target.value.toUpperCase());
                setErrorMsg(null);
              }}
              onBlur={() => {
                if (digitalAddressInput.trim() && !hasValidCoordinates) {
                  handleLookup();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLookup();
                }
              }}
              disabled={disabled || isLoading}
              className="font-mono text-base tracking-wider uppercase pr-8"
            />
            {hasValidCoordinates && !isLoading && (
              <CheckCircle2 className="absolute right-2.5 top-2.5 h-5 w-5 text-emerald-500" />
            )}
          </div>

          <Button
            type="button"
            onClick={() => handleLookup()}
            disabled={disabled || isLoading || !digitalAddressInput.trim()}
            className="px-5 font-bold shrink-0 bg-primary hover:bg-primary/90 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-1.5" />
                Locate
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Enter the official GhanaPostGPS digital address displayed on the hostel gate or building plaque.
        </p>
      </div>

      {/* Error / Not Found Message */}
      {errorMsg && (
        <Alert variant="destructive" className="rounded-xl border-rose-300 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs font-medium leading-relaxed">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton over Map Area */}
      {isLoading && (
        <div className="w-full h-[220px] sm:h-[250px] rounded-2xl bg-muted/60 border border-border flex flex-col items-center justify-center gap-3 animate-pulse">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">
            Querying GhanaPostGPS and loading map coordinates...
          </p>
        </div>
      )}

      {/* Live Map Preview & Address Confirmation */}
      {hasValidCoordinates && !isLoading && (
        <div className="space-y-3 animate-in fade-in-50 duration-300">
          {/* Compact Map Preview Container (~200–250px height) */}
          <div className="relative w-full h-[220px] sm:h-[250px] rounded-2xl overflow-hidden border border-border shadow-sm">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute top-2 left-2 z-10">
              <Badge className="bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                GPS Location Locked
              </Badge>
            </div>
            <div className="absolute bottom-2 right-2 z-10">
              <span className="text-[10px] bg-slate-950/80 text-white px-2 py-0.5 rounded font-mono">
                {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}
              </span>
            </div>
          </div>

          {/* Location Verification Text Box */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
              <MapPin className="h-3.5 w-3.5" />
              <span>Verified Location Details:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300 pt-1">
              <div>
                <span className="font-semibold text-muted-foreground">Digital Address: </span>
                <span className="font-mono font-bold text-foreground">
                  {value.digitalAddress || "Manual Pin"}
                </span>
              </div>
              {resolvedInfo?.street && (
                <div>
                  <span className="font-semibold text-muted-foreground">Street: </span>
                  <span>{resolvedInfo.street}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-muted-foreground">Area: </span>
                <span>{resolvedInfo?.area || value.address.split(",")[0] || "Near Campus"}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">District / Region: </span>
                <span>
                  {resolvedInfo
                    ? `${resolvedInfo.district || ""}, ${resolvedInfo.region || ""}`.replace(/^, |, $/g, "")
                    : "Kumasi, Ashanti"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
              <span className="font-medium text-foreground">Formatted Address: </span>
              {value.address}
            </p>
          </div>
        </div>
      )}

      {/* Manual Location Fallback Toggle */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowManualFallback((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {showManualFallback ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          <span>
            {showManualFallback
              ? "Hide manual map pin picker"
              : "Can't find your GhanaPostGPS code? Set location manually"}
          </span>
        </button>

        {showManualFallback && (
          <div className="mt-3 p-4 border border-dashed border-border rounded-2xl bg-muted/20 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                Manual Mapbox Pin Dropper
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Search by landmark or drag the pin on the map below to pinpoint your hostel's entrance.
            </p>
            <MapboxLocationPicker
              onLocationSelect={handleManualLocationSelect}
              initialLocation={
                value.lat && value.lng ? { lat: value.lat, lng: value.lng } : undefined
              }
              initialAddress={value.address}
            />
          </div>
        )}
      </div>
    </div>
  );
}
