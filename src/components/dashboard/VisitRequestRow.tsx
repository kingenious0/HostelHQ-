"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  Phone,
  PhoneCall,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Clock3,
  FileText,
  FileCheck,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { declineVisitRequestAction } from "@/app/actions/db";
import { type StudentProfileContext, type VisitRequestCardProps } from "./VisitRequestCard";

export function VisitRequestRow({
  visit,
  studentProfile,
  onUpdateStatus,
  isUpdating = false,
  onOpenDocument,
}: VisitRequestCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  // Parse and format visit date safely
  let dateObj: Date | null = null;
  let visitDateFormatted = "Date not set";
  let monthFormatted = "DATE";
  let dayFormatted = "--";
  let isDateToday = false;
  let isDateTomorrow = false;

  try {
    if (visit.visitDate) {
      dateObj =
        typeof visit.visitDate === "string"
          ? new Date(visit.visitDate)
          : visit.visitDate.toDate
          ? visit.visitDate.toDate()
          : new Date(visit.visitDate);

      if (dateObj && !isNaN(dateObj.getTime())) {
        visitDateFormatted = format(dateObj, "EEEE, d MMM yyyy");
        monthFormatted = format(dateObj, "MMM").toUpperCase();
        dayFormatted = format(dateObj, "dd");
        isDateToday = isToday(dateObj);
        isDateTomorrow = isTomorrow(dateObj);
      }
    }
  } catch (e) {
    visitDateFormatted = String(visit.visitDate);
  }

  // Resolve student verification details
  const verificationStatus =
    studentProfile?.verificationStatus ||
    visit.verificationStatus ||
    "pending";

  const idCardUrl =
    studentProfile?.studentIdCardUrl ||
    studentProfile?.idCardUrl ||
    visit.studentIdCardUrl ||
    visit.idCardUrl;

  const admissionLetterUrl =
    studentProfile?.admissionLetterUrl || visit.admissionLetterUrl;

  // Clean phone number for tel & WhatsApp links
  const rawPhone = studentProfile?.phone || visit.studentPhone || "";
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  const whatsappPhone = cleanPhone.startsWith("0")
    ? "233" + cleanPhone.substring(1)
    : cleanPhone;

  // Status badge config
  const statusBadge = {
    pending: {
      label: "Pending",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
      dotColor: "bg-amber-500",
    },
    accepted: {
      label: "Confirmed",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
      dotColor: "bg-emerald-500",
    },
    completed: {
      label: "Completed",
      className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
      dotColor: "bg-blue-500",
    },
    declined: {
      label: "Declined",
      className: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
      dotColor: "bg-rose-500",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      dotColor: "bg-slate-400",
    },
  }[visit.status] || {
    label: visit.status,
    className: "bg-slate-100 text-slate-800",
    dotColor: "bg-slate-400",
  };

  const handleConfirmDecline = async () => {
    setIsSubmittingDecline(true);
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(visit.id, "declined", declineReason.trim());
      } else {
        const res = await declineVisitRequestAction({
          visitId: visit.id,
          reason: declineReason.trim(),
        });
        if (!res.success) {
          throw new Error(res.error || "Failed to decline visit request");
        }
        toast({
          title: "Visit Request Declined",
          description: "Student has been notified of the decision.",
        });
      }
      setDeclineDialogOpen(false);
      setDeclineReason("");
    } catch (err: any) {
      console.error("Error declining visit:", err);
      toast({
        title: "Decline Failed",
        description: err.message || "Failed to decline visit request",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
      visit.status === "pending"
        ? "bg-amber-50/20 border-amber-200/90 shadow-xs"
        : "bg-white border-slate-200/90 hover:border-slate-300 shadow-xs"
    }`}>
      {/* Main Compact Row */}
      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
        {/* Date Block */}
        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center overflow-hidden">
          {isDateToday ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-600 text-white font-bold">
              <span className="text-[9px] uppercase tracking-wider leading-none">NOW</span>
              <span className="text-xs font-extrabold leading-tight">TODAY</span>
            </div>
          ) : isDateTomorrow ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-blue-600 text-white font-bold">
              <span className="text-[9px] uppercase tracking-wider leading-none">NEXT</span>
              <span className="text-xs font-extrabold leading-tight">TMRW</span>
            </div>
          ) : (
            <>
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider leading-none pt-0.5">
                {monthFormatted}
              </span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                {dayFormatted}
              </span>
            </>
          )}
        </div>

        {/* Center: Student, Hostel & Status Information */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate leading-tight">
              {visit.studentName}
            </h4>
            {verificationStatus === "verified" ? (
              <span title="Verified Student" className="inline-flex items-center text-emerald-600">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            ) : verificationStatus === "pending" ? (
              <span title="Pending Verification" className="inline-flex items-center text-amber-600">
                <Clock3 className="w-3.5 h-3.5" />
              </span>
            ) : null}

            {/* Compact Status Dot / Pill */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadge.className}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotColor}`} />
              {statusBadge.label}
            </span>
          </div>

          {/* Subtitle: Hostel & Room */}
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {visit.hostelName || "Hostel"}
            </span>
            {visit.roomTypeName && <span> • {visit.roomTypeName}</span>}
            {visit.visitTime && <span> • <Clock className="inline w-3 h-3 text-slate-400 ml-0.5 mr-0.5 -mt-0.5" />{visit.visitTime}</span>}
          </p>
        </div>

        {/* Quick Action Controls (Right) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Direct Call Icon Button */}
          {rawPhone ? (
            <a
              href={`tel:${cleanPhone}`}
              title="Call Student"
              className="h-8 w-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center transition-colors border border-emerald-200/80"
            >
              <PhoneCall className="w-3.5 h-3.5" />
            </a>
          ) : null}

          {/* Direct WhatsApp Icon Button */}
          {rawPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp Student"
              className="h-8 w-8 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] flex items-center justify-center transition-colors border border-[#25D366]/30"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </a>
          ) : null}

          {/* If Pending: Quick 1-Tap Confirm Button */}
          {visit.status === "pending" && (
            <Button
              size="sm"
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus && onUpdateStatus(visit.id, "accepted")}
              title="Confirm Inspection"
              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl gap-1 shadow-xs"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Confirm</span>
            </Button>
          )}

          {/* Expand / Collapse Chevron Toggle */}
          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse Details" : "Expand Details"}
            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs space-y-2.5 animate-in fade-in-50 duration-150">
          {/* Schedule Date & Phone / Email Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{visitDateFormatted} {visit.visitTime ? `at ${visit.visitTime}` : ""}</span>
            </div>
            {rawPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">{rawPhone}</span>
              </div>
            )}
            {(visit.studentEmail || studentProfile?.email) && (
              <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] truncate">{visit.studentEmail || studentProfile?.email}</span>
              </div>
            )}
          </div>

          {/* Student Notes */}
          {visit.notes && (
            <div className="text-[11px] italic text-slate-600 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg p-2">
              &ldquo;{visit.notes}&rdquo;
            </div>
          )}

          {/* Decline Reason if already declined */}
          {visit.status === "declined" && visit.declineReason && (
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <span className="font-semibold">Decline Reason:</span> {visit.declineReason}
              </div>
            </div>
          )}

          {/* Student Credential Inspection Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!idCardUrl}
              onClick={() => {
                if (idCardUrl && onOpenDocument) {
                  onOpenDocument(
                    idCardUrl,
                    `${visit.studentName} — Student ID Card`,
                    "id_card"
                  );
                }
              }}
              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border-slate-200 flex items-center justify-center gap-1.5 ${
                !idCardUrl
                  ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400"
                  : "hover:bg-primary/5 text-slate-700 hover:text-primary"
              }`}
            >
              <FileText className="w-3 h-3 text-primary" />
              <span>{idCardUrl ? "View ID Card" : "No ID Card"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!admissionLetterUrl}
              onClick={() => {
                if (admissionLetterUrl && onOpenDocument) {
                  onOpenDocument(
                    admissionLetterUrl,
                    `${visit.studentName} — Admission Letter`,
                    "admission_letter"
                  );
                }
              }}
              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border-slate-200 flex items-center justify-center gap-1.5 ${
                !admissionLetterUrl
                  ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400"
                  : "hover:bg-primary/5 text-slate-700 hover:text-primary"
              }`}
            >
              <FileCheck className="w-3 h-3 text-emerald-600" />
              <span>{admissionLetterUrl ? "View Letter" : "No Letter"}</span>
            </Button>
          </div>

          {/* Full Workflow Action Buttons inside Expanded Drawer */}
          <div className="flex items-center gap-2 pt-1">
            {visit.status === "pending" && (
              <>
                <Button
                  size="sm"
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus && onUpdateStatus(visit.id, "accepted")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-xl font-semibold shadow-xs"
                >
                  {isUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Confirm Inspection Time
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => setDeclineDialogOpen(true)}
                  className="h-8 px-3 text-xs rounded-xl font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Decline
                </Button>
              </>
            )}

            {visit.status === "accepted" && (
              <>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus && onUpdateStatus(visit.id, "completed")}
                  className="flex-1 text-xs h-8 rounded-xl font-semibold border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  )}
                  Mark Completed
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={isUpdating}
                  onClick={() => setDeclineDialogOpen(true)}
                  className="h-8 px-3 text-xs rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Decline
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Decline Confirmation Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center">
                <XCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold">
                Decline Room Inspection
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to decline this visit request from{" "}
              <strong className="text-foreground">{visit.studentName}</strong> for{" "}
              <strong className="text-foreground">{visit.hostelName || "the hostel"}</strong>? The student will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="decline-reason-row" className="text-xs font-semibold text-slate-700">
              Reason for Declining (Optional)
            </Label>
            <Textarea
              id="decline-reason-row"
              placeholder="e.g. Room fully booked, scheduled maintenance, manager unavailable at this time..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={isSubmittingDecline}
              className="text-xs rounded-xl"
            >
              Keep Visit
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDecline}
              disabled={isSubmittingDecline}
              className="text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
            >
              {isSubmittingDecline ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Declining...
                </>
              ) : (
                "Confirm Decline"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
