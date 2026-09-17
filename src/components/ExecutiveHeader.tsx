"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  RefreshCw,
  Menu,
  ChevronDown,
  Download,
  Printer,
  FileSpreadsheet,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ExecutiveHeaderProps {
  activeTab: "overview" | "compliance" | "sanctions" | "reports";
  accreditationRate: number;
  loadingMetrics?: boolean;
  onRefresh: () => void;
  onOpenBriefing: () => void;
  onExportCSV: () => void;
  briefingData?: any;
  userInitials: string;
  userFullName?: string;
  userRole?: string | null;
  isVC?: boolean;
  onSignOut: () => void;
  onOpenMobileNav: () => void;
}

export function ExecutiveHeader({
  activeTab,
  accreditationRate,
  loadingMetrics = false,
  onRefresh,
  onOpenBriefing,
  onExportCSV,
  briefingData,
  userInitials,
  userFullName,
  userRole,
  isVC = false,
  onSignOut,
  onOpenMobileNav,
}: ExecutiveHeaderProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Tab Title & Breadcrumb Labels
  const tabTitles: Record<string, string> = {
    overview: "Executive Overview",
    compliance: "Statutory Compliance Audit",
    sanctions: "Sanctions Switchboard",
    reports: "Executive Reports",
  };

  const currentTitle = tabTitles[activeTab] || "Governance Console";

  // Streamlined PDF Download handler using /api/reports/generate-pdf
  const handleDownloadPDF = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch("/api/reports/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "executive-header" }),
      });

      if (!res.ok) {
        // Direct download fallback via GET
        window.open("/api/reports/generate-pdf", "_blank");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HostelHQ-Executive-Briefing-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("PDF download failed:", err);
      window.open("/api/reports/generate-pdf", "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <header className="no-print sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 sm:px-6 py-3.5 mb-2 transition-all">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 max-w-7xl mx-auto w-full">
        {/* Left: Mobile Toggle, Breadcrumbs & Dynamic Page Title */}
        <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden h-8 w-8 rounded-lg shrink-0 border-gray-200 dark:border-gray-800"
            onClick={onOpenMobileNav}
            title="Open Navigation Menu"
            type="button"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>Council</span>
              <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-900 dark:text-white capitalize truncate">
                {activeTab}
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
              {currentTitle}
            </h1>
          </div>
        </div>

        {/* Right: Consolidated Actions Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap self-end md:self-center shrink-0">
          {/* Compliance Badge */}
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold rounded-full border border-emerald-100 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{accreditationRate}% Compliance</span>
          </span>

          {/* Primary Executive Briefing Trigger */}
          <button
            type="button"
            onClick={onOpenBriefing}
            className="px-3.5 py-1.5 bg-[#6B1D2F] text-white text-xs font-medium rounded-lg shadow-xs hover:bg-[#581826] active:scale-[0.98] transition flex items-center gap-1.5"
            title="Open Council Briefing Modal"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Council Briefing</span>
          </button>

          {/* Consolidated Export Dropdown (Replaces separate CSV & PDF buttons) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5 shadow-2xs transition"
                title="Export report options"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B1D2F]" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-gray-500" />
                )}
                <span>Export Report</span>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-lg border-gray-200 dark:border-gray-800">
              <DropdownMenuLabel className="text-[11px] font-semibold text-gray-400 px-2 py-1">
                Executive Export Formats
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={handleDownloadPDF}
                disabled={downloadingPdf}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FileText className="h-4 w-4 text-[#6B1D2F]" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900 dark:text-white">Download A4 PDF</span>
                  <span className="text-[10px] text-gray-500">Official USTED Letterhead Document</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onExportCSV}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900 dark:text-white">Download Council CSV</span>
                  <span className="text-[10px] text-gray-500">Spreadsheet with bed benchmarks</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={onOpenBriefing}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Printer className="h-4 w-4 text-gray-500" />
                <span>Print Statutory Briefing</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loadingMetrics}
            className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-2xs disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`h-4 w-4 ${loadingMetrics ? "animate-spin text-[#6B1D2F]" : "text-gray-500"}`} />
          </button>

          {/* User Avatar / Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200 ml-1 cursor-pointer hover:border-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#6B1D2F]/20 transition"
                aria-label="Executive user profile menu"
              >
                {userInitials || "TP"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg border-gray-200 dark:border-gray-800">
              <div className="px-2.5 py-2">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {userFullName || "Executive Council"}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {isVC ? "Vice-Chancellor / Rector" : userRole === "admin" ? "System Administrator" : "Pro-Vice-Chancellor"}
                </p>
              </div>
              <DropdownMenuSeparator className="my-1 border-gray-100 dark:border-gray-800" />
              <DropdownMenuItem asChild>
                <Link
                  href="/settings/profile"
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <UserIcon className="h-3.5 w-3.5 text-gray-500" />
                  <span>Executive Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onSignOut}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default ExecutiveHeader;
