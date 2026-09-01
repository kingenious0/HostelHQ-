"use client";

import React, { useEffect, useState } from "react";
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
import {
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  Mail,
  UserX,
  Loader2,
  Building,
  User,
} from "lucide-react";
import type { Complaint, ComplaintStatus } from "@/lib/data";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface ManagerContact {
  name: string;
  phone?: string;
  email?: string;
  isAssigned: boolean;
}

interface ComplaintDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  resolutionNotes: string;
  onResolutionNotesChange: (notes: string) => void;
  onUpdateStatus: (complaintId: string, newStatus: ComplaintStatus, notes?: string) => Promise<void>;
  isUpdating?: boolean;
  hostels?: any[];
}

export function ComplaintDetailModal({
  isOpen,
  onClose,
  complaint,
  resolutionNotes,
  onResolutionNotesChange,
  onUpdateStatus,
  isUpdating = false,
  hostels = [],
}: ComplaintDetailModalProps) {
  const [managerContact, setManagerContact] = useState<ManagerContact | null>(null);
  const [loadingManager, setLoadingManager] = useState(false);

  useEffect(() => {
    if (!complaint) {
      setManagerContact(null);
      return;
    }

    let isMounted = true;

    async function resolveManager() {
      setLoadingManager(true);
      try {
        // 1. Check if complaint already has manager contact info
        const directName = complaint?.managerName;
        const directPhone = complaint?.managerPhone;
        const directEmail = complaint?.managerEmail;
        const managerId = complaint?.managerId;

        // 2. Cross-reference hostel list if available
        const matchedHostel = hostels.find((h) => h.id === complaint?.hostelId);
        const resolvedManagerId = managerId || matchedHostel?.managerId || matchedHostel?.ownerId;

        let finalName = directName || matchedHostel?.managerName;
        let finalPhone = directPhone || matchedHostel?.managerPhone;
        let finalEmail = directEmail || matchedHostel?.managerEmail;

        // 3. If we have a managerId and missing phone/email/name, query Firestore
        if (resolvedManagerId && (!finalPhone || !finalEmail || !finalName)) {
          try {
            const userSnap = await getDoc(doc(db, "users", resolvedManagerId));
            if (userSnap.exists()) {
              const uData = userSnap.data() as any;
              finalName = finalName || uData.fullName || uData.displayName;
              finalPhone = finalPhone || uData.phoneNumber || uData.phone;
              finalEmail = finalEmail || uData.email;
            }
          } catch (e) {
            console.warn("Could not query manager from users collection:", e);
          }
        }

        // 4. If hostel has not been fetched yet and we don't have managerId, check hostel document directly
        if (!finalName && !resolvedManagerId && complaint?.hostelId) {
          try {
            const hSnap = await getDoc(doc(db, "hostels", complaint.hostelId));
            if (hSnap.exists()) {
              const hData = hSnap.data() as any;
              const hManagerId = hData.managerId || hData.ownerId;
              finalName = hData.managerName;
              finalPhone = hData.managerPhone;
              finalEmail = hData.managerEmail;

              if (hManagerId && (!finalPhone || !finalEmail || !finalName)) {
                const uSnap = await getDoc(doc(db, "users", hManagerId));
                if (uSnap.exists()) {
                  const uData = uSnap.data() as any;
                  finalName = finalName || uData.fullName || uData.displayName;
                  finalPhone = finalPhone || uData.phoneNumber || uData.phone;
                  finalEmail = finalEmail || uData.email;
                }
              }
            }
          } catch (e) {
            console.warn("Could not query hostel for manager info:", e);
          }
        }

        if (isMounted) {
          if (!finalName && !finalPhone && !finalEmail && !resolvedManagerId) {
            setManagerContact({
              name: "Manager: Not assigned",
              isAssigned: false,
            });
          } else {
            setManagerContact({
              name: finalName || "Hostel Manager",
              phone: finalPhone,
              email: finalEmail,
              isAssigned: true,
            });
          }
        }
      } catch (err) {
        console.error("Error resolving manager contact for complaint:", err);
        if (isMounted) {
          setManagerContact({
            name: "Manager: Not assigned",
            isAssigned: false,
          });
        }
      } finally {
        if (isMounted) setLoadingManager(false);
      }
    }

    resolveManager();

    return () => {
      isMounted = false;
    };
  }, [complaint, hostels]);

  if (!complaint) return null;

  const cleanStudentPhone = (complaint.studentPhone || "").replace(/[^0-9]/g, "");
  const cleanManagerPhone = (managerContact?.phone || "").replace(/[^0-9]/g, "");

  const studentWhatsAppUrl = cleanStudentPhone
    ? `https://wa.me/${cleanStudentPhone.startsWith("0") ? "233" + cleanStudentPhone.substring(1) : cleanStudentPhone}`
    : null;

  const managerWhatsAppUrl = cleanManagerPhone
    ? `https://wa.me/${cleanManagerPhone.startsWith("0") ? "233" + cleanManagerPhone.substring(1) : cleanManagerPhone}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {complaint.category}
            </Badge>
            <Badge
              className={
                complaint.status === "Resolved"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : complaint.status === "Under Review"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-rose-100 text-rose-800 border-rose-300"
              }
            >
              {complaint.status}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">{complaint.subject}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lodged on {new Date(complaint.createdAt).toLocaleString()} • Ref: #{complaint.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Context Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Student Record Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student Record</span>
                </div>
                <p className="font-bold text-foreground text-sm">{complaint.studentName}</p>
                {complaint.studentEmail && (
                  <p className="text-muted-foreground truncate text-[11px] flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    {complaint.studentEmail}
                  </p>
                )}
                {complaint.studentPhone ? (
                  <p className="font-mono text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                    <PhoneCall className="w-3 h-3 text-slate-400 shrink-0" />
                    {complaint.studentPhone}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 italic mt-0.5">Phone not provided</p>
                )}
              </div>

              {/* Student Action Buttons */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                {complaint.studentPhone ? (
                  <>
                    <a
                      href={`tel:${complaint.studentPhone}`}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors"
                    >
                      <PhoneCall className="w-3 h-3" />
                      Call
                    </a>
                    {studentWhatsAppUrl && (
                      <a
                        href={studentWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-semibold border border-[#25D366]/30 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No phone provided</span>
                )}
              </div>
            </div>

            {/* Hostel & Manager Context Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-wider mb-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hostel & Manager Context</span>
                </div>
                <p className="font-bold text-foreground text-sm">{complaint.hostelName}</p>
                {complaint.roomNumber && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Room Number: <span className="font-semibold text-slate-700">{complaint.roomNumber}</span>
                  </p>
                )}

                {loadingManager ? (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Resolving manager...</span>
                  </div>
                ) : managerContact && managerContact.isAssigned ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-slate-800 font-semibold text-xs">
                      Manager: {managerContact.name}
                    </p>
                    {managerContact.email && (
                      <p className="text-muted-foreground truncate text-[11px] flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        {managerContact.email}
                      </p>
                    )}
                    {managerContact.phone ? (
                      <p className="font-mono text-muted-foreground text-[11px] flex items-center gap-1">
                        <PhoneCall className="w-3 h-3 text-slate-400 shrink-0" />
                        {managerContact.phone}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No phone on file</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50/70 border border-amber-200/60 rounded-md p-1.5 mt-1.5">
                    <UserX className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-xs">Manager: Not assigned</span>
                  </div>
                )}
              </div>

              {/* Manager Action Buttons */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                {managerContact?.isAssigned && managerContact.phone ? (
                  <>
                    <a
                      href={`tel:${managerContact.phone}`}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors"
                    >
                      <PhoneCall className="w-3 h-3" />
                      Call
                    </a>
                    {managerWhatsAppUrl && (
                      <a
                        href={managerWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-semibold border border-[#25D366]/30 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {managerContact?.isAssigned ? "No contact phone" : "No manager assigned"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Complaint Description */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Detailed Narrative of Grievance
            </p>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {complaint.description}
            </div>
          </div>

          {/* Resolution Notes Input */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
              Dean Directorate Resolution Findings & Directives
            </label>
            <Textarea
              placeholder="Document arbitrated settlement, agreed timelines, or warnings issued..."
              value={resolutionNotes}
              onChange={(e) => onResolutionNotesChange(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {complaint.status === "Submitted" && (
            <Button
              variant="outline"
              onClick={() => onUpdateStatus(complaint.id, "Under Review", resolutionNotes)}
              disabled={isUpdating}
              className="border-amber-500 text-amber-700 hover:bg-amber-50 text-xs font-semibold"
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Move to Under Review
            </Button>
          )}

          {complaint.status !== "Resolved" && (
            <Button
              onClick={() => onUpdateStatus(complaint.id, "Resolved", resolutionNotes)}
              disabled={isUpdating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Mark Dispute Resolved
            </Button>
          )}

          <Button variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
