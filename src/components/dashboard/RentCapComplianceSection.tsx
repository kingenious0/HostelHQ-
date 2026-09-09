"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import type { Hostel } from "@/lib/data";
import {
  TariffLimits,
  DEFAULT_TARIFF_LIMITS,
  getStatutoryTariffCeiling,
} from "@/lib/tariff-limits";
import { updateHostelAction } from "@/app/actions/db";
import { sendRentCapBreachSMSAction } from "@/app/actions/sms";
import {
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Loader2,
  Building2,
  Calendar,
} from "lucide-react";

export interface TariffViolationItem {
  hostelId: string;
  hostelName: string;
  institution?: string;
  location?: string;
  roomTypeName: string;
  roomIndex: number;
  postedPrice: number;
  statutoryCap: number;
  excess: number;
  isSuspended: boolean;
  status: string;
  hostel: Hostel;
}

interface RentCapComplianceSectionProps {
  hostels: Hostel[];
  currentUser: any;
  userRole?: string | null;
  onHostelUpdated?: (updatedHostel: Hostel) => void;
}

export function RentCapComplianceSection({
  hostels,
  currentUser,
  userRole,
  onHostelUpdated,
}: RentCapComplianceSectionProps) {
  const { toast } = useToast();

  // Dynamic Tariff Limits state
  const [limits, setLimits] = useState<TariffLimits>(DEFAULT_TARIFF_LIMITS);
  const [limitsLoading, setLimitsLoading] = useState(true);

  // Edit Limits Modal state
  const [editLimitsOpen, setEditLimitsOpen] = useState(false);
  const [formOne, setFormOne] = useState<number>(DEFAULT_TARIFF_LIMITS.oneInRoom);
  const [formTwo, setFormTwo] = useState<number>(DEFAULT_TARIFF_LIMITS.twoInRoom);
  const [formThree, setFormThree] = useState<number>(DEFAULT_TARIFF_LIMITS.threeInRoom);
  const [formFour, setFormFour] = useState<number>(DEFAULT_TARIFF_LIMITS.fourInRoom);
  const [savingLimits, setSavingLimits] = useState(false);

  // Action Loading tracking by hostel ID
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  // Real-time listener for settings/tariff_limits
  useEffect(() => {
    const limitsDocRef = doc(db, "settings", "tariff_limits");
    const unsubscribe = onSnapshot(
      limitsDocRef,
      (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const parsed: TariffLimits = {
            oneInRoom: Number(data.oneInRoom) || DEFAULT_TARIFF_LIMITS.oneInRoom,
            twoInRoom: Number(data.twoInRoom) || DEFAULT_TARIFF_LIMITS.twoInRoom,
            threeInRoom: Number(data.threeInRoom) || DEFAULT_TARIFF_LIMITS.threeInRoom,
            fourInRoom: Number(data.fourInRoom) || DEFAULT_TARIFF_LIMITS.fourInRoom,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || "University Housing Board",
          };
          setLimits(parsed);
          setFormOne(parsed.oneInRoom);
          setFormTwo(parsed.twoInRoom);
          setFormThree(parsed.threeInRoom);
          setFormFour(parsed.fourInRoom);
        } else {
          setLimits(DEFAULT_TARIFF_LIMITS);
        }
        setLimitsLoading(false);
      },
      (err: any) => {
        console.warn("Could not listen to settings/tariff_limits:", err);
        setLimitsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save updated limits to Firestore settings/tariff_limits
  const handleSaveLimits = async () => {
    if (!formOne || !formTwo || !formThree || !formFour) {
      toast({
        title: "Validation Error",
        description: "All four room configuration caps must be specified.",
        variant: "destructive",
      });
      return;
    }

    setSavingLimits(true);
    try {
      const staffIdentifier =
        currentUser?.displayName || currentUser?.email || (userRole === "dean" ? "Dean of Students" : "Housing Coordinator");

      const payload: TariffLimits = {
        oneInRoom: Number(formOne),
        twoInRoom: Number(formTwo),
        threeInRoom: Number(formThree),
        fourInRoom: Number(formFour),
        updatedAt: new Date().toISOString(),
        updatedBy: staffIdentifier,
      };

      await setDoc(doc(db, "settings", "tariff_limits"), payload, { merge: true });

      setLimits(payload);
      setEditLimitsOpen(false);

      toast({
        title: "Campus Rent Caps Updated",
        description: "New statutory rent ceiling thresholds are now active across campus listings.",
      });
    } catch (err: any) {
      console.error("Failed to save tariff limits:", err);
      toast({
        title: "Update Failed",
        description: err.message || "Could not save rent cap settings.",
        variant: "destructive",
      });
    } finally {
      setSavingLimits(false);
    }
  };

  // Calculate rent cap breaches across all passed hostels
  const violations: TariffViolationItem[] = [];

  hostels.forEach((h) => {
    const isSuspendedOverpriced = h.status === "suspended_overpriced";
    const roomTypes = h.roomTypes || [];

    roomTypes.forEach((rt, idx) => {
      const ceiling = getStatutoryTariffCeiling(rt.name, rt.capacity, limits);
      const isBreaching = typeof rt.price === "number" && rt.price > ceiling.maxPrice;

      // Include if it exceeds cap, or if hostel is currently marked suspended_overpriced
      if (isBreaching || isSuspendedOverpriced) {
        violations.push({
          hostelId: h.id,
          hostelName: h.name,
          institution: h.institution,
          location: h.location,
          roomTypeName: rt.name,
          roomIndex: idx,
          postedPrice: rt.price,
          statutoryCap: ceiling.maxPrice,
          excess: Math.max(0, (rt.price || 0) - ceiling.maxPrice),
          isSuspended: isSuspendedOverpriced,
          status: h.status || "approved",
          hostel: h,
        });
      }
    });
  });

  // Handle Suspend Listing action
  const handleSuspendListing = async (v: TariffViolationItem) => {
    const cleanId = v.hostelId.replace(/^HOSTEL#/i, "").replace(/^PENDING_HOSTEL#/i, "").trim();
    setSuspendingId(v.hostelId);

    try {
      const callerName =
        currentUser?.displayName || (userRole === "dean" ? "Dean of Students" : "Housing Coordinator");

      const suspensionReason = `Room tariff (GH₵${v.postedPrice.toLocaleString()}) exceeds approved cap (GH₵${v.statutoryCap.toLocaleString()})`;

      // 1. Delist Room/Hostel in Firestore
      await updateDoc(doc(db, "hostels", cleanId), {
        status: "suspended_overpriced",
        isPublished: false,
        suspensionReason,
        suspendedAt: new Date().toISOString(),
        suspendedBy: callerName,
      });

      // 2. Delist Room/Hostel in DynamoDB
      await updateHostelAction(cleanId, {
        status: "suspended_overpriced" as any,
        isPublished: false,
        suspensionReason,
      });

      // 3. In-App Manager Notification into notifications collection
      const managerRecipientId = v.hostel.managerId || v.hostel.contactPhone || "";
      if (managerRecipientId) {
        try {
          await addDoc(collection(db, "notifications"), {
            recipientId: managerRecipientId,
            title: "Listing Suspended: Rent Cap Exceeded",
            message: `Your ${v.roomTypeName} rate of GH₵${v.postedPrice.toLocaleString()} at "${v.hostelName}" exceeds the campus ceiling of GH₵${v.statutoryCap.toLocaleString()}. Your listing is currently hidden from students. Lower your tariff to restore visibility.`,
            type: "rent_cap_breach",
            createdAt: new Date().toISOString(),
            read: false,
          });
        } catch (notifErr) {
          console.warn("Could not insert in-app notification:", notifErr);
        }
      }

      // 4. SMS Dispatch Trigger
      try {
        await sendRentCapBreachSMSAction({
          hostelId: cleanId,
          hostelName: v.hostelName,
          managerPhone: v.hostel.managerPhone || v.hostel.contactPhone,
          roomTypeName: v.roomTypeName,
          postedRate: v.postedPrice,
          statutoryCap: v.statutoryCap,
        });
      } catch (smsErr) {
        console.warn("SMS dispatch warning:", smsErr);
      }

      // 5. Update local state
      const updatedHostel: Hostel = {
        ...v.hostel,
        status: "suspended_overpriced" as any,
        isPublished: false,
        suspensionReason,
      };

      if (onHostelUpdated) {
        onHostelUpdated(updatedHostel);
      }

      toast({
        title: "Listing Suspended: Rent Cap Exceeded",
        description: `"${v.hostelName}" has been delisted from student directory. In-app and SMS notice dispatched to manager.`,
      });
    } catch (err: any) {
      console.error("Suspension error:", err);
      toast({
        title: "Action Failed",
        description: err.message || "Failed to suspend property listing.",
        variant: "destructive",
      });
    } finally {
      setSuspendingId(null);
    }
  };

  const statutoryCards = [
    { label: "1 in a Room (Single)", value: limits.oneInRoom, key: "1inRoom" },
    { label: "2 in a Room", value: limits.twoInRoom, key: "2inRoom" },
    { label: "3 in a Room", value: limits.threeInRoom, key: "3inRoom" },
    { label: "4 in a Room", value: limits.fourInRoom, key: "4inRoom" },
  ];

  return (
    <div className="space-y-4">
      {/* Statutory Campus Limits Legend & Edit Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Campus Rent Caps Configuration</h3>
            <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
              Active Academic Year
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Statutory baseline tariff thresholds enforced across off-campus student accommodation zoning.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFormOne(limits.oneInRoom);
            setFormTwo(limits.twoInRoom);
            setFormThree(limits.threeInRoom);
            setFormFour(limits.fourInRoom);
            setEditLimitsOpen(true);
          }}
          className="h-8.5 text-xs font-semibold gap-1.5 shadow-xs border-primary/40 hover:border-primary text-primary"
        >
          <Sliders className="h-3.5 w-3.5" />
          Edit Approved Limits
        </Button>
      </div>

      {/* Grid of Current Limits */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statutoryCards.map((item) => (
          <Card key={item.key} className="border border-border/60 bg-card p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {item.label}
            </span>
            <div className="text-lg sm:text-xl font-black text-foreground mt-1 font-mono">
              GH₵{item.value.toLocaleString()}
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
              Statutory Campus Ceiling
            </span>
          </Card>
        ))}
      </div>

      {/* Rent Cap Compliance Table */}
      <Card className="border border-border/60 shadow-xs bg-card">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/20 rounded-t-xl">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-500" /> Rent Cap Compliance
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  violations.length > 0
                    ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                    : "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                }`}
              >
                {violations.length > 0 ? `${violations.length} Breach Detected` : "100% Compliant"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Audited properties exceeding campus rent ceilings. Suspend non-compliant listings immediately to delist them from student search and issue manager breach notices.
            </CardDescription>
          </div>
        </div>

        <CardContent className="p-0">
          {violations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
              <CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto" />
              <p className="font-semibold text-foreground text-base">Zero rent cap violations detected</p>
              <p className="text-xs max-w-md mx-auto">
                All room configurations across verified and pending hostels currently operate within approved statutory campus rental caps.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border/60">
                  <TableRow>
                    <TableHead>Hostel & Location</TableHead>
                    <TableHead>Room Configuration</TableHead>
                    <TableHead>Posted Rate</TableHead>
                    <TableHead>Statutory Cap</TableHead>
                    <TableHead>Excess / Gouging</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Compliance Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v, idx) => {
                    const isProcessing = suspendingId === v.hostelId;
                    const isSuspended = v.isSuspended || v.hostel.status === "suspended_overpriced";

                    return (
                      <TableRow key={`${v.hostelId}-${idx}`} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-3">
                          <p className="font-semibold text-foreground text-sm">{v.hostelName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {v.location} • {v.institution || "AAMUSTED/KNUST"}
                          </p>
                        </TableCell>

                        <TableCell className="py-3 font-medium text-xs text-foreground">
                          {v.roomTypeName}
                        </TableCell>

                        <TableCell className="py-3 font-mono text-xs font-semibold text-rose-600 line-through">
                          GH₵{v.postedPrice.toLocaleString()}
                        </TableCell>

                        <TableCell className="py-3 font-mono text-xs font-bold text-emerald-600">
                          GH₵{v.statutoryCap.toLocaleString()}
                        </TableCell>

                        <TableCell className="py-3">
                          {v.excess > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                              +GH₵{v.excess.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">GH₵0</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          {isSuspended ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                              Suspended (Overpriced)
                            </span>
                          ) : v.status === "approved" ? (
                            <Badge variant="default" className="text-[10px]">
                              Live Directory
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pending Filing
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          {isSuspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs font-semibold border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 opacity-80 cursor-default"
                              title="Listing is currently suspended and delisted from student search"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Suspended
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuspendListing(v)}
                              disabled={isProcessing}
                              className="h-8 text-xs font-semibold border-rose-600 text-rose-700 hover:bg-rose-50 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950/40 shadow-xs transition-colors"
                              title="Immediately delist property from student view and dispatch manager in-app + SMS notices"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                  Suspending...
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                                  Suspend Listing
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* EDIT APPROVED LIMITS MODAL */}
      <Dialog open={editLimitsOpen} onOpenChange={setEditLimitsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sliders className="h-5 w-5 text-primary" /> Edit Approved Rent Caps
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the statutory rent ceiling thresholds per academic year. Listings posted above these rates will be flagged for compliance suspension.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="oneInRoom" className="text-xs font-semibold">
                1 in a Room (Single Occupancy) — GH₵
              </Label>
              <Input
                id="oneInRoom"
                type="number"
                min={100}
                step={50}
                value={formOne}
                onChange={(e) => setFormOne(Number(e.target.value))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="twoInRoom" className="text-xs font-semibold">
                2 in a Room (Double Occupancy) — GH₵
              </Label>
              <Input
                id="twoInRoom"
                type="number"
                min={100}
                step={50}
                value={formTwo}
                onChange={(e) => setFormTwo(Number(e.target.value))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="threeInRoom" className="text-xs font-semibold">
                3 in a Room (Triple Occupancy) — GH₵
              </Label>
              <Input
                id="threeInRoom"
                type="number"
                min={100}
                step={50}
                value={formThree}
                onChange={(e) => setFormThree(Number(e.target.value))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fourInRoom" className="text-xs font-semibold">
                4 in a Room (Quad Occupancy) — GH₵
              </Label>
              <Input
                id="fourInRoom"
                type="number"
                min={100}
                step={50}
                value={formFour}
                onChange={(e) => setFormFour(Number(e.target.value))}
                className="font-mono text-sm"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground">
              Last modified:{" "}
              <span className="font-semibold text-foreground font-mono">
                {limits.updatedAt ? new Date(limits.updatedAt).toLocaleDateString() : "Default"}
              </span>{" "}
              by <span className="font-semibold text-foreground">{limits.updatedBy || "System"}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditLimitsOpen(false)}
              disabled={savingLimits}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLimits}
              disabled={savingLimits}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {savingLimits ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving Caps...
                </>
              ) : (
                "Save & Enforce Limits"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
