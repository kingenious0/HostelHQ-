"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  X,
  FileText,
  AlertCircle,
  ExternalLink,
  Loader2,
  FileCheck,
  ShieldCheck
} from "lucide-react";

export type DocumentType = "id_card" | "admission_letter" | "document" | "proof_of_payment" | string;

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl?: string | null;
  title?: string;
  studentName?: string;
  documentType?: DocumentType;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  documentUrl,
  title,
  studentName,
  documentType = "document",
}: DocumentViewerModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & state when document or open status changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsLoading(true);
      setHasError(!documentUrl || documentUrl.trim() === "");
    }
  }, [isOpen, documentUrl]);

  // Determine file type
  const isPdf = Boolean(
    documentUrl &&
      (documentUrl.toLowerCase().includes(".pdf") ||
        documentUrl.toLowerCase().includes("format=pdf") ||
        documentUrl.toLowerCase().includes("/pdf/"))
  );

  const documentTypeLabel = (() => {
    switch (documentType) {
      case "id_card":
        return "Student ID Card";
      case "admission_letter":
        return "Admission Letter";
      case "proof_of_payment":
        return "Payment Receipt";
      default:
        return "Document";
    }
  })();

  const displayTitle =
    title ||
    (studentName
      ? `${studentName} — ${documentTypeLabel}`
      : `Verified Document — ${documentTypeLabel}`);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] sm:max-w-[90vw] sm:w-[90vw] md:max-w-[85vw] md:w-[85vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden bg-slate-950/95 border-slate-800 text-slate-100 shadow-2xl flex flex-col rounded-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{displayTitle}</DialogTitle>
        </DialogHeader>

        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
              {documentType === "id_card" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : documentType === "admission_letter" ? (
                <FileCheck className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider py-0 px-2 border-slate-700 bg-slate-800 text-slate-300"
                >
                  {documentTypeLabel}
                </Badge>
                {isPdf ? (
                  <span className="text-[11px] text-slate-400 font-mono">PDF Document</span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono">Image Preview</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Image zoom & rotate controls (active for non-PDFs) */}
            {!isPdf && !hasError && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  title="Zoom Out (-)"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono font-medium px-1.5 text-slate-300 min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  title="Zoom In (+)"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Download Button */}
            {documentUrl && !hasError && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1.5 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl"
              >
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </Button>
            )}

            {/* Close Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Viewport Body */}
        <div className="flex-1 relative overflow-auto bg-slate-950 flex items-center justify-center p-2 sm:p-4">
          {hasError || !documentUrl ? (
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Document Not Available
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                The student may not have uploaded this file yet, or the document link has expired or is temporarily inaccessible.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Close Viewer
              </Button>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-mono">Loading PDF Viewer...</p>
                </div>
              )}
              <iframe
                src={`${documentUrl}#toolbar=1`}
                className="w-full h-full border-0 rounded-lg bg-white"
                title={displayTitle}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
              <noscript>
                <div className="p-4 text-center">
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline text-sm"
                  >
                    Click here to view PDF directly
                  </a>
                </div>
              </noscript>
            </div>
          ) : (
            <div
              ref={imageContainerRef}
              className="w-full h-full flex items-center justify-center overflow-auto p-4 select-none"
            >
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-mono">Loading Document Image...</p>
                </div>
              )}
              <div
                className="transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={documentUrl}
                  alt={displayTitle}
                  className="max-h-[78vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-slate-800"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status / Mobile Zoom Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] text-slate-300">Secure Document Viewer</span>
          </div>

          {!isPdf && !hasError && (
            <div className="flex sm:hidden items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="h-7 w-7 p-0 text-slate-300"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-mono px-1 text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="h-7 w-7 p-0 text-slate-300"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              Open original <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
