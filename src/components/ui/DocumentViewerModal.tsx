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
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export type DocumentType =
  | "id_card"
  | "admission_letter"
  | "document"
  | "proof_of_payment"
  | string;

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl?: string | null;
  title?: string;
  studentName?: string;
  documentType?: DocumentType;
}

/**
 * Transforms Cloudinary PDF URLs into direct high-resolution image URLs.
 * This bypasses browser iframe PDF restrictions, attachment downloads,
 * and CORS issues, displaying page 1 (or any page) as a crisp, zoomable image.
 */
function getCloudinaryPdfImageUrl(url: string, page = 1): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com")) return url;

  const isPdf =
    url.toLowerCase().includes(".pdf") ||
    url.toLowerCase().includes("format=pdf") ||
    url.toLowerCase().includes("/pdf/");
  if (!isPdf) return url;

  // Replace .pdf extension with .jpg
  let transformed = url.replace(/\.pdf(\?.*)?$/i, ".jpg$1");

  // Inject on-the-fly transformations: auto format, auto quality, specific page
  if (transformed.includes("/image/upload/")) {
    transformed = transformed.replace(
      "/image/upload/",
      `/image/upload/f_auto,q_auto,pg_${page}/`
    );
  } else if (transformed.includes("/upload/")) {
    transformed = transformed.replace(
      "/upload/",
      `/upload/f_auto,q_auto,pg_${page}/`
    );
  }

  return transformed;
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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"image" | "proxy_pdf" | "google">("image");
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const cleanUrl = (documentUrl || "").trim();

  // Determine if file is a PDF
  const isPdf = Boolean(
    cleanUrl &&
      (cleanUrl.toLowerCase().includes(".pdf") ||
        cleanUrl.toLowerCase().includes("format=pdf") ||
        cleanUrl.toLowerCase().includes("/pdf/"))
  );

  const isCloudinary = Boolean(cleanUrl && cleanUrl.includes("cloudinary.com"));

  // Reset zoom & state when document or open status changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPdfPage(1);
      setIsLoading(true);
      setHasError(!cleanUrl);
      setErrorMessage("");

      // If it's a Cloudinary PDF, default to 'image' mode for instant zero-blank rendering
      // If it's another PDF host, default to 'proxy_pdf'
      if (isPdf) {
        if (isCloudinary) {
          setViewMode("image");
        } else {
          setViewMode("proxy_pdf");
        }
      } else {
        setViewMode("image");
      }
    }
  }, [isOpen, cleanUrl, isPdf, isCloudinary]);

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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Compute active image source
  const activeImageSrc =
    isPdf && isCloudinary
      ? getCloudinaryPdfImageUrl(cleanUrl, pdfPage)
      : cleanUrl;

  // Compute proxy PDF source (same-origin, avoids browser iframe blank bugs)
  const proxyPdfSrc = `/api/document-proxy?url=${encodeURIComponent(cleanUrl)}#toolbar=1&navpanes=0`;

  // Compute Google Docs viewer source
  const googleViewerSrc = `https://docs.google.com/viewer?url=${encodeURIComponent(cleanUrl)}&embedded=true`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] w-[96vw] sm:max-w-[92vw] sm:w-[92vw] md:max-w-[88vw] md:w-[88vw] h-[94vh] max-h-[94vh] p-0 overflow-hidden bg-slate-950/95 border-slate-800 text-slate-100 shadow-2xl flex flex-col rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{displayTitle}</DialogTitle>
        </DialogHeader>

        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 shrink-0 z-10 backdrop-blur-md gap-2">
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
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-white truncate">
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider py-0 px-2 border-slate-700 bg-slate-800 text-slate-300"
                >
                  {documentTypeLabel}
                </Badge>
                {isPdf ? (
                  <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                    <FileText className="h-3 w-3" /> PDF Document
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Image Document
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* View Mode Switcher for PDFs */}
            {isPdf && !hasError && (
              <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-0.5 border border-slate-700/80">
                {isCloudinary && (
                  <Button
                    size="sm"
                    variant={viewMode === "image" ? "default" : "ghost"}
                    onClick={() => {
                      setViewMode("image");
                      setIsLoading(true);
                    }}
                    className={`h-7 px-2 text-[10px] sm:text-xs font-medium rounded-lg gap-1 ${
                      viewMode === "image"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Render PDF page as high-res zoomable image"
                  >
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    <span>Image View</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant={viewMode === "proxy_pdf" ? "default" : "ghost"}
                  onClick={() => {
                    setViewMode("proxy_pdf");
                    setIsLoading(true);
                  }}
                  className={`h-7 px-2 text-[10px] sm:text-xs font-medium rounded-lg gap-1 ${
                    viewMode === "proxy_pdf"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="View PDF with built-in viewer"
                >
                  <FileText className="h-3 w-3" />
                  <span>PDF Reader</span>
                </Button>

                <Button
                  size="sm"
                  variant={viewMode === "google" ? "default" : "ghost"}
                  onClick={() => {
                    setViewMode("google");
                    setIsLoading(true);
                  }}
                  className={`h-7 px-2 text-[10px] sm:text-xs font-medium rounded-lg gap-1 ${
                    viewMode === "google"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="View via Google Docs Viewer"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Google Docs</span>
                </Button>
              </div>
            )}

            {/* Image zoom & rotate controls (active when viewing in image mode) */}
            {viewMode === "image" && !hasError && (
              <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
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
                <span className="text-[11px] font-mono font-medium px-1 text-slate-300 min-w-[2.8rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3.5}
                  title="Zoom In (+)"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRotate}
                  title="Rotate (90°)"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetZoom}
                  title="Reset Zoom & Rotation"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* PDF Multi-page navigation (when in Cloudinary image mode) */}
            {isPdf && isCloudinary && viewMode === "image" && !hasError && (
              <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 text-xs">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPdfPage((p) => Math.max(1, p - 1));
                    setIsLoading(true);
                  }}
                  disabled={pdfPage <= 1}
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono px-1 text-slate-300">
                  Page {pdfPage}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPdfPage((p) => p + 1);
                    setIsLoading(true);
                  }}
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Open in New Tab Button */}
            {cleanUrl && !hasError && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1.5 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl"
              >
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open full document in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>
              </Button>
            )}

            {/* Download Button */}
            {cleanUrl && !hasError && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1.5 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl"
              >
                <a href={cleanUrl} target="_blank" rel="noopener noreferrer" download>
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

        {/* Informative Helper Banner for PDFs */}
        {isPdf && !hasError && (
          <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              {viewMode === "image" ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> High-Resolution Image Preview (Zero Blank Screen)
                </span>
              ) : viewMode === "proxy_pdf" ? (
                <span className="text-sky-400 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Same-Origin PDF Reader
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Google Docs Cloud Viewer
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden md:inline text-slate-500">
                Having trouble viewing?
              </span>
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                Open directly in new tab <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        )}

        {/* Modal Viewport Body */}
        <div className="flex-1 relative overflow-auto bg-slate-950 flex items-center justify-center p-2 sm:p-4">
          {hasError || !cleanUrl ? (
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Document Not Available
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                {errorMessage ||
                  "The student may not have uploaded this file yet, or the document link has expired or is temporarily inaccessible."}
              </p>
              <div className="flex items-center gap-2">
                {cleanUrl && (
                  <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-700">
                    <a href={cleanUrl} target="_blank" rel="noopener noreferrer">
                      Try Direct Link
                    </a>
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={onClose}
                  className="rounded-xl"
                >
                  Close Viewer
                </Button>
              </div>
            </div>
          ) : viewMode === "image" ? (
            /* Mode 1: High-Res Image View (Cloudinary Auto-Rasterized PDF or Standard Image) */
            <div
              ref={imageContainerRef}
              className="w-full h-full flex items-center justify-center overflow-auto p-2 sm:p-4 select-none relative"
            >
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-mono">
                    {isPdf ? "Rendering PDF Page..." : "Loading Document Image..."}
                  </p>
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
                  src={activeImageSrc}
                  alt={displayTitle}
                  className="max-h-[78vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-slate-800 bg-white"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    // If image conversion fails, switch to proxy_pdf
                    if (isPdf && viewMode === "image") {
                      setViewMode("proxy_pdf");
                    } else {
                      setHasError(true);
                      setErrorMessage("Failed to load document image preview.");
                    }
                  }}
                />
              </div>
            </div>
          ) : viewMode === "proxy_pdf" ? (
            /* Mode 2: Same-Origin PDF Proxy Embed */
            <div className="w-full h-full relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-mono">Loading Same-Origin PDF Stream...</p>
                </div>
              )}
              <iframe
                src={proxyPdfSrc}
                className="w-full h-full border-0 rounded-lg bg-slate-900"
                title={displayTitle}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setViewMode("google");
                }}
              />
              {/* Fallback bar inside PDF viewport if browser refuses to display iframe */}
              <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Blank frame? Browser might restrict internal PDF plugins.</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewMode("google")}
                    className="h-6 text-[11px] text-primary hover:text-primary-foreground"
                  >
                    Switch to Google Viewer
                  </Button>
                  <a
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 underline"
                  >
                    Open in tab
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Mode 3: Google Docs Viewer Embed */
            <div className="w-full h-full relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-xs font-mono">Connecting to Google Cloud PDF Viewer...</p>
                </div>
              )}
              <iframe
                src={googleViewerSrc}
                className="w-full h-full border-0 rounded-lg bg-white"
                title={displayTitle}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage("Google Docs Viewer could not load this file. Please open directly.");
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Status & Engine Information Bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] text-slate-300 font-medium">
              Secure Document Viewer
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline font-mono">
              ({viewMode === "image" ? "High-Res Image Engine" : viewMode === "proxy_pdf" ? "Same-Origin Proxy Engine" : "Google Cloud Engine"})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {cleanUrl && (
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition-colors"
              >
                Open original file <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
