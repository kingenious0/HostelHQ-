"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  CheckCircle2,
  XCircle,
  MapPin,
  Bed,
  ShieldCheck,
  Droplets,
  Zap,
  Video,
  ImageIcon,
  Phone,
  Mail,
  User,
  ExternalLink,
  AlertTriangle,
  Check,
  Loader2,
  Shield,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Scale,
  CreditCard,
  Layers,
  FileText,
  AlertCircle,
} from "lucide-react";
import { getHostelPhotos, getHostelVideos, getCoverPhoto } from "@/lib/media-helpers";
import { getStatutoryTariffCeiling } from "@/lib/tariff-limits";
import { approveHostelAccreditationAction, rejectHostelAccreditationAction } from "@/app/actions/db";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface HostelInspectionModalProps {
  hostel: any | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
  } | null;
  onDecisionComplete?: (updatedHostel: any, action: "approve" | "reject") => void;
}

export function HostelInspectionModal({
  hostel,
  isOpen,
  onClose,
  currentUser,
  onDecisionComplete,
}: HostelInspectionModalProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("gallery");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isRejectMode, setIsRejectMode] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manager Bank/MoMo Accounts State
  const [payoutAccounts, setPayoutAccounts] = useState<any[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState<boolean>(false);

  // Normalize media collections
  const photos = useMemo(() => (hostel ? getHostelPhotos(hostel) : []), [hostel]);
  const videos = useMemo(() => (hostel ? getHostelVideos(hostel) : []), [hostel]);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setActiveTab("gallery");
      setSelectedPhotoIndex(null);
      setIsRejectMode(false);
      setRejectionReason("");
    }
  }, [isOpen, hostel?.id]);

  // Fetch verified MoMo / Bank accounts for the manager
  useEffect(() => {
    let isMounted = true;
    const fetchManagerPayouts = async () => {
      if (!hostel?.managerId) return;
      setLoadingPayouts(true);
      try {
        const q = query(
          collection(db, "bank_accounts"),
          where("userId", "==", hostel.managerId)
        );
        const snap = await getDocs(q);
        if (isMounted) {
          const accounts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setPayoutAccounts(accounts);
        }
      } catch (err) {
        console.warn("Could not query manager payout accounts:", err);
      } finally {
        if (isMounted) setLoadingPayouts(false);
      }
    };

    if (isOpen && hostel?.managerId) {
      fetchManagerPayouts();
    }
  }, [isOpen, hostel?.managerId]);

  if (!hostel) return null;

  // Calculate total bed capacity
  const roomTypes = hostel.roomTypes || hostel.rooms || [];
  const totalBeds = roomTypes.reduce((acc: number, rt: any) => {
    const numRooms = Number(rt.numberOfRooms) || 1;
    const capacity = Number(rt.capacity) || 1;
    return acc + numRooms * capacity;
  }, 0);

  // Location Coordinates
  const lat = hostel.latitude ?? hostel.lat ?? hostel.coordinates?.lat ?? null;
  const lng = hostel.longitude ?? hostel.lng ?? hostel.coordinates?.lng ?? null;
  const googleMapsUrl =
    lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  // Backup utilities check from amenities & security
  const allAmenities = [
    ...(Array.isArray(hostel.amenities) ? hostel.amenities : []),
    ...(Array.isArray(hostel.roomAmenities) ? hostel.roomAmenities : []),
  ].map((a) => (typeof a === "string" ? a.toLowerCase() : ""));

  const hasBorehole = allAmenities.some((a) => a.includes("borehole") || a.includes("water tank") || a.includes("poly tank") || a.includes("reservoir"));
  const hasGenerator = allAmenities.some((a) => a.includes("generator") || a.includes("standby") || a.includes("solar") || a.includes("inverter"));
  const hasCCTV = allAmenities.some((a) => a.includes("cctv") || a.includes("camera"));
  const hasSecurityGuard = allAmenities.some((a) => a.includes("guard") || a.includes("security") || a.includes("fenced"));

  // Undertaking & Manager Info
  const undertaking = hostel.statutoryUndertaking;
  const managerName =
    undertaking?.declarantName ||
    hostel.managerName ||
    hostel.createdBy?.fullName ||
    "Property Manager";
  const managerPhone =
    hostel.managerPhone ||
    hostel.contactPhone ||
    hostel.phone ||
    undertaking?.declarantPhone ||
    "Not provided";
  const managerEmail =
    hostel.managerEmail ||
    hostel.createdBy?.email ||
    "Not provided";

  // Handle Accreditation Approval
  const handleApprove = async () => {
    setIsSubmitting(true);
    toast({
      title: "Accrediting Property...",
      description: `Finalizing institutional approval for "${hostel.name}".`,
    });

    try {
      const res = await approveHostelAccreditationAction({
        hostelId: hostel.id,
        reviewerId: currentUser?.uid,
        reviewerName: currentUser?.displayName || currentUser?.email || "Accreditation Inspector",
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to accredit property");
      }

      toast({
        title: "Property Accredited!",
        description: `"${hostel.name}" is now live and published on HostelHQ. Approval SMS dispatched to manager.`,
      });

      if (onDecisionComplete) {
        onDecisionComplete(res.data, "approve");
      }
      onClose();
    } catch (err: any) {
      console.error("Accreditation approval error:", err);
      toast({
        title: "Approval Error",
        description: err.message || "Failed to approve hostel accreditation.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Decline / Request Changes
  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 8) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide actionable feedback (at least 8 characters) to explain what the manager needs to rectify.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    toast({
      title: "Declining Property Filing...",
      description: `Recording feedback notes for "${hostel.name}".`,
    });

    try {
      const res = await rejectHostelAccreditationAction({
        hostelId: hostel.id,
        reasonText: rejectionReason.trim(),
        reviewerId: currentUser?.uid,
        reviewerName: currentUser?.displayName || currentUser?.email || "Accreditation Inspector",
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to decline property");
      }

      toast({
        title: "Filing Declined with Notes",
        description: `Landlord has been notified via SMS to rectify their filing: "${rejectionReason.trim()}"`,
      });

      if (onDecisionComplete) {
        onDecisionComplete(res.data, "reject");
      }
      onClose();
    } catch (err: any) {
      console.error("Accreditation rejection error:", err);
      toast({
        title: "Rejection Error",
        description: err.message || "Failed to record property decline.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl">
        {/* MODAL HEADER */}
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                  Inspection & Audit
                </Badge>
                <Badge variant="outline" className="text-[11px] font-medium">
                  {hostel.institution || "University Campus Zone"}
                </Badge>
                {undertaking?.ghanaCardNumber && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Ghana Card: {undertaking.ghanaCardNumber}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                {hostel.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{hostel.location || hostel.address || "Location pending"}</span>
                {hostel.digitalAddress && (
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
                    GPS: {hostel.digitalAddress}
                  </span>
                )}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Total Bed Capacity
                </p>
                <p className="text-xl font-black text-primary flex items-center justify-end gap-1">
                  <Bed className="h-4 w-4" />
                  {totalBeds > 0 ? `${totalBeds} Beds` : "Specification Pending"}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* MODAL BODY TABS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-4 bg-muted/40 p-1 rounded-xl">
              <TabsTrigger value="gallery" className="flex items-center gap-1.5 text-xs font-semibold">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Media & Videos</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  {photos.length + videos.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="specs" className="flex items-center gap-1.5 text-xs font-semibold">
                <Building className="h-3.5 w-3.5" />
                <span>Specifications</span>
              </TabsTrigger>
              <TabsTrigger value="manager" className="flex items-center gap-1.5 text-xs font-semibold">
                <User className="h-3.5 w-3.5" />
                <span>Manager & Payout</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: MEDIA & ROOM VIDEOS */}
            <TabsContent value="gallery" className="space-y-6 mt-0">
              {/* Photo Gallery Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Property & Room Photography ({photos.length})
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Click photo to zoom</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className="group relative aspect-video rounded-xl overflow-hidden border border-border/80 bg-slate-900 cursor-pointer hover:border-primary transition-all shadow-sm"
                    >
                      <Image
                        src={url}
                        alt={`${hostel.name} inspection preview ${idx + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="h-5 w-5 text-white" />
                      </div>
                      {idx === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded shadow">
                          Cover Photo
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Walkthrough Videos */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Video className="h-4 w-4 text-primary" />
                    Room Walkthrough Videos ({videos.length})
                  </h4>
                  {videos.length === 0 && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/20">
                      Zero Walkthrough Videos Uploaded
                    </Badge>
                  )}
                </div>

                {videos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {videos.map((vUrl, vIdx) => (
                      <div
                        key={vIdx}
                        className="rounded-2xl overflow-hidden border border-border bg-black/90 p-2 space-y-2 shadow-sm"
                      >
                        <video
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full aspect-video rounded-xl object-contain bg-black"
                          src={vUrl}
                        >
                          Your browser does not support HTML5 video streaming.
                        </video>
                        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Walkthrough Tour #{vIdx + 1}
                          </span>
                          <a
                            href={vUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            Open Raw <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-border text-center bg-muted/10 space-y-2">
                    <Video className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                    <p className="text-sm font-semibold text-foreground">No Room Videos Provided</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      The manager has not uploaded 360-degree walkthrough videos. You may approve based on high-resolution photography or request changes.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: SPECIFICATIONS & TARIFFS */}
            <TabsContent value="specs" className="space-y-6 mt-0">
              {/* Location Verification & Utilities Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location Specs */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    Location & Geographic Audit
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span className="text-muted-foreground">Coordinates:</span>
                      <span className="font-mono font-semibold">
                        {lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Pending GPS Lock"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span className="text-muted-foreground">Digital Address (GPS):</span>
                      <span className="font-mono font-semibold">{hostel.digitalAddress || "Unregistered"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <span className="text-muted-foreground">Distance to Campus:</span>
                      <span className="font-semibold">{hostel.distanceToUniversity || "Near campus"}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-muted-foreground">Nearby Landmarks:</span>
                      <span className="font-semibold text-right max-w-[200px] truncate">
                        {hostel.nearbyLandmarks || "Main gate vicinity"}
                      </span>
                    </div>
                  </div>

                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pt-1"
                    >
                      Verify Coordinates on Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Backup Utilities Matrix */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Utility & Safety Infrastructure
                  </h4>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl border border-border/60 bg-background flex items-center gap-2">
                      <Droplets className={`h-4 w-4 ${hasBorehole ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-bold text-foreground">Borehole / Tanks</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasBorehole ? "Installed & active" : "Mains GWCL only"}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-border/60 bg-background flex items-center gap-2">
                      <Zap className={`h-4 w-4 ${hasGenerator ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-bold text-foreground">Standby Power</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasGenerator ? "Gen / Solar present" : "Grid power only"}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-border/60 bg-background flex items-center gap-2">
                      <Shield className={`h-4 w-4 ${hasCCTV ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-bold text-foreground">CCTV Surveillance</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasCCTV ? "Cameras recorded" : "Not documented"}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-border/60 bg-background flex items-center gap-2">
                      <ShieldCheck className={`h-4 w-4 ${hasSecurityGuard ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-bold text-foreground">Guard / Perimeter</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasSecurityGuard ? "Gated / Guarded" : "Standard perimeter"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Configurations vs Statutory Rent Cap */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Room Configurations & Statutory Tariff Compliance
                </h4>

                {roomTypes.length > 0 ? (
                  <div className="border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60 bg-card">
                    {roomTypes.map((rt: any, idx: number) => {
                      const capacity = Number(rt.capacity) || 1;
                      const price = Number(rt.price) || 0;
                      const ceiling = getStatutoryTariffCeiling(rt.name, capacity);
                      const tariffLimit = ceiling.maxPrice;
                      const isOverCap = price > tariffLimit;
                      const excess = price - tariffLimit;

                      return (
                        <div key={idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">
                                {rt.name || `Room Type #${idx + 1}`}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {capacity} In a Room
                              </Badge>
                              {rt.numberOfRooms && (
                                <span className="text-muted-foreground text-[11px]">
                                  ({rt.numberOfRooms} rooms available)
                                </span>
                              )}
                            </div>
                            {Array.isArray(rt.roomAmenities) && rt.roomAmenities.length > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Amenities: {rt.roomAmenities.join(", ")}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-black text-foreground">
                                GH₵{price.toLocaleString()}
                                <span className="text-[10px] font-normal text-muted-foreground"> / academic year</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Statutory Cap: GH₵{tariffLimit.toLocaleString()}
                              </p>
                            </div>

                            {isOverCap ? (
                              <Badge variant="destructive" className="flex items-center gap-1 text-[10px] py-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Exceeds Cap (+GH₵{excess.toLocaleString()})</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1 text-[10px] py-1">
                                <Check className="h-3 w-3" />
                                <span>Compliant</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic p-3 border rounded-xl">
                    No physical room configurations specified on this listing.
                  </p>
                )}
              </div>

              {/* Act 389 Statutory Undertaking Sworn Statement */}
              {undertaking && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <Scale className="h-4 w-4 shrink-0" />
                    <span>Act 389 Statutory Undertaking Sworn Verification</span>
                  </div>
                  <p className="text-muted-foreground">
                    Sworn by <strong className="text-foreground">{undertaking.declarantName}</strong> on{" "}
                    {new Date(undertaking.declaredAt || Date.now()).toLocaleDateString("en-GB")}. The declarant formally
                    undertakes under penalty of statutory sanction to adhere to statutory tariff ceilings, fire safety codes, and student welfare standards.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: MANAGER & PAYOUT AUDIT */}
            <TabsContent value="manager" className="space-y-5 mt-0">
              {/* Linked Manager Identity */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  Linked Property Manager Identity
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Full Name / Declarant:</p>
                    <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      {managerName}
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground">Contact Phone (SMS Destination):</p>
                    <p className="font-mono font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {managerPhone}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground">Notification Email:</p>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {managerEmail}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground">Manager ID / User Ref:</p>
                    <p className="font-mono text-muted-foreground text-[11px] truncate">
                      {hostel.managerId || "Direct Registration"}
                    </p>
                  </div>
                </div>
              </div>

              {/* MoMo & Bank Payout Audit */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Disbursement & MoMo Payout Verification
                  </h4>
                  {loadingPayouts && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                </div>

                {payoutAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {payoutAccounts.map((acc, aIdx) => (
                      <div
                        key={aIdx}
                        className="p-3 rounded-xl border border-border/60 bg-background flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">
                            {acc.accountName || acc.account_name || managerName}
                          </p>
                          <p className="text-muted-foreground font-mono">
                            {acc.bankName || acc.bank_name || "Mobile Money"} ••••••
                            {(acc.accountNumber || acc.account_number || "").slice(-4)}
                          </p>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px]">
                          Verified Payout Account
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-border/60 bg-background text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-foreground font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Direct In-App MoMo / Bank Channel</span>
                    </div>
                    <p className="text-muted-foreground">
                      Manager has verified payment routing via statutory declaration (Phone: {managerPhone}).
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* REJECTION NOTES DRAWER (Mandatory When Rejecting) */}
          {isRejectMode && (
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  Mandatory Rejection / Remediation Notice
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRejectMode(false)}
                  className="h-6 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel Decline
                </Button>
              </div>

              <Textarea
                placeholder="Provide explicit, actionable feedback to the landlord (e.g. 'Room 3 price of GH₵4,200 exceeds the statutory university ceiling of GH₵3,800. Please adjust price or attach statutory variance permit.')..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="text-xs bg-background border-border"
              />
              <p className="text-[11px] text-muted-foreground">
                This exact note will be dispatched to the landlord via SMS:{" "}
                <span className="font-mono text-[10px] text-foreground">
                  [HostelHQ] Notice: Filing for &quot;{hostel.name}&quot; was declined. Reason: {rejectionReason || "..."}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* MODAL FOOTER / DECISION CONTROLS */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs text-muted-foreground"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {!isRejectMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectMode(true)}
                  disabled={isSubmitting}
                  className="text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Decline / Request Changes
                </Button>

                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Approve & Accredit
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting || !rejectionReason.trim()}
                className="text-xs font-bold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Confirm Decline & Send Notice
              </Button>
            )}
          </div>
        </DialogFooter>

        {/* LIGHTBOX FOR HIGH-RES PHOTO INSPECTION */}
        {selectedPhotoIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            <div
              className="relative max-w-4xl max-h-[85vh] w-full h-[70vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={photos[selectedPhotoIndex]}
                alt="Inspection Zoom"
                fill
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(null)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600"
              >
                ✕
              </button>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPhotoIndex(
                        (selectedPhotoIndex - 1 + photos.length) % photos.length
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-primary"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPhotoIndex((selectedPhotoIndex + 1) % photos.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-primary"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-mono">
                {selectedPhotoIndex + 1} / {photos.length}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
