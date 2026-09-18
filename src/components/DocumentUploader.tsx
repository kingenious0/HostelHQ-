"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadVerificationDocument } from "@/lib/cloudinary";

export interface DocumentUploaderProps {
  documentType: "student_id" | "admission_letter";
  onDocumentTypeChange?: (type: "student_id" | "admission_letter") => void;
  onUploadSuccess: (url: string, file: File) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function DocumentUploader({
  documentType,
  onDocumentTypeChange,
  onUploadSuccess,
  onError,
  disabled = false,
}: DocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [uploadCompleted, setUploadCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // Validate file size (<5MB)
    if (file.size > 5 * 1024 * 1024) {
      const err = "File size exceeds 5MB limit. Please upload a smaller file.";
      onError?.(err);
      return;
    }

    // Validate MIME types
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!validTypes.includes(file.type) && !isPdf) {
      const err = "Invalid file type. Please upload a Student ID image (JPG, PNG) or Admission Letter PDF.";
      onError?.(err);
      return;
    }

    setSelectedFile(file);
    setUploadCompleted(false);

    // Setup preview
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null); // PDF icon used instead
    }

    // Automatically perform compression & upload
    setIsUploading(true);
    setUploadStatusText("Compressing & Uploading...");

    try {
      const uploadedUrl = await uploadVerificationDocument(file, (status) => {
        setUploadStatusText(status);
      });

      setUploadCompleted(true);
      setUploadStatusText("Document attached securely");
      onUploadSuccess(uploadedUrl, file);
    } catch (err: any) {
      console.error("Document upload error:", err);
      const errMsg = err.message || "Failed to upload document. Please retry.";
      onError?.(errMsg);
      setSelectedFile(null);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadCompleted(false);
    setUploadStatusText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Document Type Selector Segmented Control */}
      {onDocumentTypeChange && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Select Document Category
          </Label>
          <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-xl border border-border/60">
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => onDocumentTypeChange("student_id")}
              className={`py-2 px-3 text-xs font-medium rounded-lg transition-all text-center ${
                documentType === "student_id"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Student ID Card (Image)
            </button>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => onDocumentTypeChange("admission_letter")}
              className={`py-2 px-3 text-xs font-medium rounded-lg transition-all text-center ${
                documentType === "admission_letter"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admission Letter (PDF/Image)
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {/* Drag & Drop Dropzone */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled && !isUploading) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/80 hover:border-primary/60 hover:bg-muted/30"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">
                Click or drag & drop your {documentType === "student_id" ? "Student ID Card" : "Admission Letter"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Supported: JPG, PNG, WebP or PDF (Max 5MB)
              </p>
            </div>
            <span className="inline-flex items-center text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ⚡ Instant Client Canvas Compression
            </span>
          </div>
        </div>
      ) : (
        /* Selected & Uploading / Uploaded State Card */
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {previewUrl ? (
                <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 border border-red-500/20">
                  <FileText className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                  {selectedFile.type.includes("pdf") ? "PDF Document" : "Image"}
                </p>
              </div>
            </div>

            {!isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearSelectedFile}
                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress / Completion Status */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
            <div className="flex items-center gap-1.5">
              {isUploading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
                  <span className="font-medium text-primary text-[11px]">
                    {uploadStatusText || "Compressing & Uploading..."}
                  </span>
                </>
              ) : uploadCompleted ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold text-emerald-600 text-[11px]">
                    Document attached & ready for automated verification
                  </span>
                </>
              ) : null}
            </div>

            {!isUploading && uploadCompleted && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
