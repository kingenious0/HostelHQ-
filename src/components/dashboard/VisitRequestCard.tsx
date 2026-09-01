"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { declineVisitRequestAction } from "@/app/actions/db";

export interface StudentProfileContext {
  verificationStatus?: "verified" | "pending" | "rejected" | "unverified";
  studentIdCardUrl?: string;
  idCardUrl?: string;
  admissionLetterUrl?: string;
  email?: string;
  phone?: string;
  fullName?: string;
}

export interface VisitRequestCardProps {
  visit: {
    id: string;
    hostelId: string;
    hostelName?: string;
    studentId?: string;
    studentName: string;
    studentEmail?: string;
    studentPhone?: string;
    roomTypeId?: string | null;
    roomTypeName?: string;
    visitDate: string | any;
    visitTime?: string;
    notes?: string;
    status: "pending" | "accepted" | "completed" | "cancelled" | "declined" | string;
    declineReason?: string;
    createdAt?: string | any;
    studentCompleted?: boolean;
    verificationStatus?: string;
    studentIdCardUrl?: string;
    idCardUrl?: string;
    admissionLetterUrl?: string;
  };
  studentProfile?: StudentProfileContext;
  onUpdateStatus?: (
    visitId: string,
    newStatus: "accepted" | "completed" | "cancelled" | "declined",
    reason?: string
  ) => Promise<void>;
  isUpdating?: boolean;
  onOpenDocument?: (url: string, title: string, docType: "id_card" | "admission_letter") => void;
}

export function VisitRequestCard({
  visit,
  studentProfile,
  onUpdateStatus,
  isUpdating = false,
  onOpenDocument,
}: VisitRequestCardProps) {
  const { toast } = useToast();
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  // Parse and format visit date safely
  let visitDateFormatted = "Date not set";
  try {
    if (visit.visitDate) {
      const d =
        typeof visit.visitDate === "string"
          ? new Date(visit.visitDate)
          : visit.visitDate.toDate
          ? visit.visitDate.toDate()
          : new Date(visit.visitDate);
      visitDateFormatted = format(d, "EEEE, d MMM yyyy");
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
      label: "Pending Confirmation",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    },
    accepted: {
      label: "Confirmed / Accepted",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    completed: {
      label: "Visit Completed",
      className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
    },
    declined: {
      label: "Declined",
      className: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
    },
  }[visit.status] || {
    label: visit.status,
    className: "bg-slate-100 text-slate-800",
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
    <>
      <Card className="border rounded-2xl p-4 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
        <div>
          {/* Header Row: Student Name, Hostel, and Verification Badge */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-sm text-slate-900 leading-tight truncate">
                  {visit.studentName}
                </h4>

                {/* Student Verification Badge */}
                {verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    Verified Student
                  </span>
                ) : verificationStatus === "pending" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock3 className="w-3 h-3 text-amber-600 shrink-0" />
                    Pending Verification
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                    <ShieldAlert className="w-3 h-3 text-slate-500 shrink-0" />
                    Unverified
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {visit.hostelName || "Hostel Inspection"}
                {visit.roomTypeName && ` • ${visit.roomTypeName}`}
              </p>
            </div>

            {/* Visit Status Badge */}
            <span
              className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>

          {/* Schedule & Contact Details */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/80 rounded-xl p-2.5 my-2 border border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-medium text-slate-800">{visitDateFormatted}</span>
            </div>
            {visit.visitTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{visit.visitTime}</span>
              </div>
            )}
            {rawPhone && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">{rawPhone}</span>
              </div>
            )}
            {(visit.studentEmail || studentProfile?.email) && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-500 truncate">
                  {visit.studentEmail || studentProfile?.email}
                </span>
              </div>
            )}
          </div>

          {/* Notes if provided */}
          {visit.notes && (
            <p className="text-[11px] italic text-slate-600 bg-amber-50/70 border border-amber-200/60 rounded-lg p-2 mb-2.5">
              &ldquo;{visit.notes}&rdquo;
            </p>
          )}

          {/* Decline Reason if already declined */}
          {visit.status === "declined" && visit.declineReason && (
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 mb-2.5 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <span className="font-semibold">Decline Reason:</span> {visit.declineReason}
              </div>
            </div>
          )}

          {/* Quick-action buttons: View Student Credentials in Universal Document Viewer */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 pt-1">
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
              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border-slate-200 flex items-center justify-center gap-1 ${
                !idCardUrl
                  ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400"
                  : "hover:bg-primary/5 text-slate-700 hover:text-primary hover:border-primary/30"
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
              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border-slate-200 flex items-center justify-center gap-1 ${
                !admissionLetterUrl
                  ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400"
                  : "hover:bg-primary/5 text-slate-700 hover:text-primary hover:border-primary/30"
              }`}
            >
              <FileCheck className="w-3 h-3 text-emerald-600" />
              <span>{admissionLetterUrl ? "View Letter" : "No Letter"}</span>
            </Button>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          {/* Direct Call and WhatsApp Pill Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {rawPhone ? (
              <>
                <a
                  href={`tel:${cleanPhone}`}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200/80 transition-colors"
                >
                  <PhoneCall className="w-3 h-3" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${whatsappPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-semibold border border-[#25D366]/30 transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  WhatsApp
                </a>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground col-span-2 text-center py-1">
                No student contact provided
              </span>
            )}
          </div>

          {/* Workflow Status Action Buttons */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
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
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  Confirm Time
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => setDeclineDialogOpen(true)}
                  className="h-8 px-2.5 text-xs rounded-xl font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
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
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1 text-blue-600" />
                  )}
                  Mark Completed
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={isUpdating}
                  onClick={() => setDeclineDialogOpen(true)}
                  className="h-8 px-2 text-xs rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Decline
                </Button>
              </>
            )}

            {visit.status !== "pending" &&
              visit.status !== "accepted" &&
              visit.status !== "cancelled" &&
              visit.status !== "declined" && (
                <span className="text-[11px] text-muted-foreground w-full text-center py-1">
                  Inspection finalized
                </span>
              )}
          </div>
        </div>
      </Card>

      {/* Decline Visit Request Confirmation Dialog */}
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
            <Label htmlFor="decline-reason" className="text-xs font-semibold text-slate-700">
              Reason for Declining (Optional)
            </Label>
            <Textarea
              id="decline-reason"
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
    </>
  );
}
