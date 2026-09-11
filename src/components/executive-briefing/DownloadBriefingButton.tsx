'use client';

import React, { useState } from 'react';
import { Download, Loader2, AlertCircle, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BriefingPDFTemplate, BriefingData } from './BriefingPDFTemplate';

interface DownloadBriefingButtonProps {
  data: BriefingData;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DownloadBriefingButton({
  data,
  className = '',
  variant = 'default',
  size = 'sm',
}: DownloadBriefingButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const templateElement = document.getElementById('briefing-template-root');
      if (!templateElement) {
        throw new Error('Briefing template document container not found in DOM.');
      }

      const rawHtml = templateElement.innerHTML;

      // Construct a complete, standalone HTML5 document for PDFShift
      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HostelHQ Executive Council Briefing Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  ${rawHtml}
</body>
</html>`;

      const response = await fetch('/api/briefing/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ htmlContent: standaloneHtml }),
      });

      if (!response.ok) {
        let errMessage = 'Failed to generate PDF.';
        try {
          const errJson = await response.json();
          if (errJson.details) {
            errMessage = errJson.details;
          } else if (errJson.error) {
            errMessage = errJson.error;
          }
        } catch {
          const text = await response.text();
          if (text) errMessage = text;
        }
        throw new Error(errMessage);
      }

      const blob = await response.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `HostelHQ-Executive-Council-Briefing-${dateStr}.pdf`;

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Executive PDF download error:', err);
      setError(err?.message || 'Failed to generate PDF document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFallbackPrint = () => {
    const templateElement = document.getElementById('briefing-template-root');
    if (!templateElement) {
      window.print();
      return;
    }

    // Open clean print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>HostelHQ Executive Council Briefing Report</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; }
            </style>
          </head>
          <body>
            ${templateElement.innerHTML}
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleDownload}
          disabled={isLoading}
          variant={variant}
          size={size}
          className={`font-semibold rounded-xl gap-2 shadow-xs transition-all ${
            variant === 'default'
              ? 'bg-[#922C42] hover:bg-[#922C42]/90 text-white'
              : ''
          } ${className}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Generating A4 PDF...</span>
            </>
          ) : success ? (
            <>
              <FileCheck className="h-4 w-4 text-emerald-300" />
              <span>PDF Downloaded!</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Download A4 PDF</span>
            </>
          )}
        </Button>

        {error && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFallbackPrint}
            className="text-xs rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
            title="Print directly via system dialog"
          >
            System Print (Fallback)
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 mt-1 max-w-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Hidden container used to render the institutional A4 document HTML */}
      <div
        id="briefing-template-root"
        style={{
          display: 'none',
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
        }}
        aria-hidden="true"
      >
        <BriefingPDFTemplate data={data} />
      </div>
    </div>
  );
}
