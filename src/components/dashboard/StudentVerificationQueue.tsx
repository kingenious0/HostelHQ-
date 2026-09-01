"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, Eye, FileText, CreditCard } from "lucide-react";
import type { StudentVerification } from "@/lib/data";

interface StudentVerificationQueueProps {
  verifications: StudentVerification[];
  actionLoading?: boolean;
  onApprove: (id: string) => Promise<void>;
  onRejectClick: (item: StudentVerification) => void;
  onOpenDocument: (url: string, title: string, documentType: "admission" | "id_card" | "document") => void;
}

export function StudentVerificationQueue({
  verifications,
  actionLoading = false,
  onApprove,
  onRejectClick,
  onOpenDocument,
}: StudentVerificationQueueProps) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-card rounded-t-xl">
        <div>
          <CardTitle className="text-base font-bold">Student Verification Queue</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Inspect university admission letters and student ID cards to grant protected resident status.
          </CardDescription>
        </div>
      </div>

      <CardContent className="p-0">
        {verifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
            <UserCheck className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-foreground">Zero pending verifications</p>
            <p className="text-xs">All uploaded student admission documents have been processed.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-border/60">
                  <TableRow>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Admission Letter</TableHead>
                    <TableHead>Student ID Card</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="py-3">
                        {item.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Review
                          </span>
                        )}
                        {item.status === "verified" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        )}
                        {item.status === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <p className="font-medium text-foreground text-sm">{item.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.studentIdNumber}</p>
                      </TableCell>

                      <TableCell className="py-3">
                        <span className="text-xs text-foreground font-medium">
                          {item.institution || "AAMUSTED"}
                        </span>
                      </TableCell>

                      <TableCell className="py-3">
                        {item.admissionLetterUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDocument(
                                item.admissionLetterUrl!,
                                `${item.fullName} - Admission Letter`,
                                "admission"
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-xs text-blue-700 font-medium hover:bg-blue-100 transition-colors border border-blue-200/60 cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" /> View Letter
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not provided</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        {item.studentIdCardUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDocument(
                                item.studentIdCardUrl!,
                                `${item.fullName} - Student ID Card`,
                                "id_card"
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 text-xs text-indigo-700 font-medium hover:bg-indigo-100 transition-colors border border-indigo-200/60 cursor-pointer"
                          >
                            <CreditCard className="h-3.5 w-3.5" /> View ID Card
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not provided</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        {item.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => onApprove(item.id)}
                              disabled={actionLoading}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRejectClick(item)}
                              disabled={actionLoading}
                              className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {item.reviewedAt ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}` : "Completed"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block md:hidden divide-y divide-border/60">
              {verifications.map((item) => (
                <div key={item.id} className="p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{item.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.studentIdNumber} • {item.institution || "AAMUSTED"}
                      </p>
                    </div>
                    {item.status === "pending" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    )}
                    {item.status === "verified" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Verified
                      </span>
                    )}
                    {item.status === "rejected" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        Rejected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {item.admissionLetterUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDocument(
                            item.admissionLetterUrl!,
                            `${item.fullName} - Admission Letter`,
                            "admission"
                          )
                        }
                        className="inline-flex items-center gap-1 text-primary font-medium hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Letter
                      </button>
                    ) : (
                      <span className="text-muted-foreground">No Letter</span>
                    )}
                    {item.studentIdCardUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDocument(
                            item.studentIdCardUrl!,
                            `${item.fullName} - Student ID Card`,
                            "id_card"
                          )
                        }
                        className="inline-flex items-center gap-1 text-primary font-medium hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> View ID Card
                      </button>
                    ) : (
                      <span className="text-muted-foreground">No ID Card</span>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRejectClick(item)}
                        disabled={actionLoading}
                        className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onApprove(item.id)}
                        disabled={actionLoading}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
