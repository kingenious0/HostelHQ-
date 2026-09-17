import { NextRequest, NextResponse } from "next/server";
import { fetchLiveExecutiveMetrics } from "@/services/occupancyService";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

/**
 * Technical Implementation Code:
 * Official USTED Branded Executive Briefing HTML Template
 */
export function buildExecutiveReportHTML(metrics: any, complianceList: any[]) {
  const normMetrics = {
    totalHostels: metrics?.totalHostels ?? 0,
    accredited: metrics?.accredited ?? metrics?.accreditedCount ?? 0,
    pending: metrics?.pending ?? metrics?.pendingCount ?? 0,
    occupiedBeds: metrics?.occupiedBeds ?? metrics?.activeOccupiedBeds ?? 0,
    totalBeds: metrics?.totalBeds ?? metrics?.totalVerifiedBeds ?? 0,
    complianceRate: metrics?.complianceRate ?? 0,
    sanctioned: metrics?.sanctioned ?? metrics?.sanctionedPropertiesCount ?? 0,
  };

  const normList = Array.isArray(complianceList) ? complianceList : [];

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 11pt; line-height: 1.4; }
      .container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 30px; background: #ffffff; }
      
      /* Official Letterhead */
      .letterhead { display: flex; align-items: center; border-bottom: 3px solid #6B1D2F; padding-bottom: 15px; margin-bottom: 20px; }
      .letterhead-text h2 { margin: 0; font-size: 15px; color: #111827; text-transform: uppercase; font-weight: 700; }
      .letterhead-text p { margin: 3px 0 0; font-size: 11px; color: #4b5563; font-weight: 600; }

      /* Title Banner */
      .title-banner { background: #fdf8f6; border: 1px solid #f3d6dc; padding: 12px; text-align: center; border-radius: 4px; margin-bottom: 20px; }
      .title-banner h1 { margin: 0; color: #6B1D2F; font-size: 16px; text-transform: uppercase; }
      .title-banner p { margin: 3px 0 0; font-size: 10px; color: #6b7280; }

      /* Sections & Tables */
      h3 { font-size: 13px; color: #6B1D2F; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 20px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
      th, td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; }
      th { background-color: #f3f4f6; color: #374151; font-weight: 600; }
      
      .badge-good { color: #047857; font-weight: bold; }
      .badge-sanction { color: #b91c1c; font-weight: bold; }

      /* Sign-off */
      .sign-grid { display: table; width: 100%; margin-top: 30px; text-align: center; font-size: 10px; }
      .sign-box { display: table-cell; width: 33.33%; border-top: 1px solid #9ca3af; padding-top: 8px; margin: 0 10px; }
      .footer { margin-top: 25px; text-align: center; font-size: 9px; color: #6b7280; border-top: 1px dashed #e5e7eb; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Letterhead -->
      <div class="letterhead">
        <div class="letterhead-text">
          <h2>University of Skills Training and Entrepreneurial Development (USTED)</h2>
          <p>Directorate of Student Welfare & Private Accommodation Governance — Kumasi</p>
        </div>
      </div>

      <!-- Title -->
      <div class="title-banner">
        <h1>Executive Council Briefing Report</h1>
        <p>Statutory Governance Document • Ref: VC-BRIEF-2026-HQ • Generated Live</p>
      </div>

      <!-- Section 1 -->
      <h3>1. Private Student Housing Portfolio Assessment</h3>
      <table>
        <tr><th>Portfolio Metric</th><th>Live Database Value</th></tr>
        <tr><td>Total Registered Hostels</td><td>${normMetrics.totalHostels} Properties (${normMetrics.accredited} Accredited, ${normMetrics.pending} Pending)</td></tr>
        <tr><td>Active Student Bed Occupancy</td><td>${normMetrics.occupiedBeds} / ${normMetrics.totalBeds} Active Student Beds Occupied</td></tr>
        <tr><td>Overall Portfolio Compliance</td><td><strong>${normMetrics.complianceRate}% Active Standing</strong></td></tr>
        <tr><td>Active Statutory Sanctions</td><td>${normMetrics.sanctioned} Properties under corrective review</td></tr>
      </table>

      <!-- Section 2 -->
      <h3>2. Key Portfolio Compliance Matrix</h3>
      <table>
        <tr><th>Hostel Name</th><th>Location</th><th>Status</th><th>Beds</th></tr>
        ${normList.map((h: any) => `
          <tr>
            <td>${h.name || 'Unnamed Hostel'}</td>
            <td>${h.location || 'Kumasi Campus Area'}</td>
            <td><span class="${String(h.status || '').toLowerCase().includes('sanction') || String(h.status || '').toLowerCase().includes('suspend') || String(h.status || '').toLowerCase().includes('revok') ? 'badge-sanction' : 'badge-good'}">${h.status || 'Good Standing'}</span></td>
            <td>${h.totalBeds ?? h.beds ?? 0}</td>
          </tr>
        `).join('')}
      </table>

      <!-- Sign-off -->
      <div class="sign-grid">
        <div class="sign-box"><strong>Executive Director</strong><br>Student Housing Directorate</div>
        <div class="sign-box"><strong>Pro-Vice-Chancellor</strong><br>Academic & Student Affairs</div>
        <div class="sign-box"><strong>Vice-Chancellor / Rector</strong><br>Office of the VC</div>
      </div>

      <div class="footer">
        CLASSIFICATION: OFFICIAL EXECUTIVE DOCUMENT (CONFIDENTIAL) • Registered under Act 389
      </div>
    </div>
  </body>
  </html>`;
}

// Backward-compatible alias
export const generateExecutiveReportHTML = buildExecutiveReportHTML;

/**
 * Generates a native binary PDF buffer using pdf-lib as a reliable,
 * zero-dependency serverless fallback when external rendering services are absent.
 */
async function generateNativeExecutivePDF(metrics: any, complianceList: any[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points (210mm x 297mm)
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Palette matching USTED Letterhead (#6B1D2F) & UI tokens
  const maroon = rgb(0.42, 0.11, 0.18); // #6B1D2F
  const darkGray = rgb(0.12, 0.16, 0.22);
  const medGray = rgb(0.42, 0.45, 0.5);
  const lightBg = rgb(0.96, 0.97, 0.98);
  const borderGray = rgb(0.85, 0.87, 0.9);
  const green = rgb(0.02, 0.47, 0.34);
  const red = rgb(0.73, 0.11, 0.11);

  let y = height - 50;

  // 1. USTED Official Letterhead
  page.drawText("UNIVERSITY OF SKILLS TRAINING AND ENTREPRENEURIAL DEVELOPMENT (USTED)", {
    x: 40,
    y,
    size: 11,
    font: fontBold,
    color: maroon,
  });
  y -= 14;

  page.drawText("Directorate of Student Welfare & Private Accommodation Governance — Kumasi", {
    x: 40,
    y,
    size: 8.5,
    font: fontRegular,
    color: medGray,
  });
  y -= 10;

  // Header dividing line (border-bottom: 3px solid #6B1D2F)
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 2.5,
    color: maroon,
  });
  y -= 25;

  // 2. Title Box (.title-banner)
  page.drawRectangle({
    x: 40,
    y: y - 32,
    width: width - 80,
    height: 40,
    color: rgb(0.99, 0.97, 0.96),
    borderColor: rgb(0.95, 0.84, 0.86),
    borderWidth: 1,
  });

  page.drawText("EXECUTIVE COUNCIL BRIEFING REPORT", {
    x: width / 2 - 120,
    y: y - 14,
    size: 12,
    font: fontBold,
    color: maroon,
  });

  page.drawText("Statutory Governance Document • Ref: VC-BRIEF-2026-HQ • Generated Live", {
    x: width / 2 - 150,
    y: y - 26,
    size: 7.5,
    font: fontRegular,
    color: medGray,
  });
  y -= 52;

  // 3. Section 1: Portfolio Assessment
  page.drawText("1. PRIVATE STUDENT HOUSING PORTFOLIO ASSESSMENT", {
    x: 40,
    y,
    size: 9.5,
    font: fontBold,
    color: maroon,
  });
  y -= 15;

  const totalHostels = metrics.totalHostels ?? 0;
  const accredited = metrics.accredited ?? metrics.accreditedCount ?? 0;
  const pending = metrics.pending ?? metrics.pendingCount ?? 0;
  const occupiedBeds = metrics.occupiedBeds ?? metrics.activeOccupiedBeds ?? 0;
  const totalBeds = metrics.totalBeds ?? metrics.totalVerifiedBeds ?? 0;
  const complianceRate = metrics.complianceRate ?? 0;
  const sanctioned = metrics.sanctioned ?? metrics.sanctionedPropertiesCount ?? 0;

  const summaryRows = [
    ["Total Registered Hostels", `${totalHostels} Properties (${accredited} Accredited, ${pending} Pending)`],
    ["Active Student Bed Occupancy", `${occupiedBeds} / ${totalBeds} Active Student Beds Occupied`],
    ["Overall Portfolio Compliance", `${complianceRate}% Active Standing`],
    ["Active Statutory Sanctions", `${sanctioned} Properties under corrective review`],
  ];

  for (const [label, val] of summaryRows) {
    page.drawRectangle({
      x: 40,
      y: y - 14,
      width: width - 80,
      height: 18,
      color: lightBg,
      borderColor: borderGray,
      borderWidth: 0.5,
    });
    page.drawText(label, { x: 48, y: y - 9, size: 8, font: fontBold, color: darkGray });
    page.drawText(val, { x: 220, y: y - 9, size: 8, font: fontRegular, color: darkGray });
    y -= 18;
  }
  y -= 20;

  // 4. Section 2: Key Portfolio Compliance Matrix
  page.drawText("2. KEY PORTFOLIO COMPLIANCE MATRIX", {
    x: 40,
    y,
    size: 9.5,
    font: fontBold,
    color: maroon,
  });
  y -= 15;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: y - 14,
    width: width - 80,
    height: 18,
    color: rgb(0.95, 0.96, 0.96),
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  page.drawText("Hostel Name", { x: 48, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Location", { x: 220, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Status", { x: 380, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Beds", { x: 470, y: y - 9, size: 8, font: fontBold, color: darkGray });
  y -= 18;

  // Table Rows (up to 18 rows to cleanly fit single A4)
  const rowsToPrint = complianceList.slice(0, 18);
  for (const h of rowsToPrint) {
    page.drawRectangle({
      x: 40,
      y: y - 14,
      width: width - 80,
      height: 18,
      color: rgb(1, 1, 1),
      borderColor: borderGray,
      borderWidth: 0.5,
    });
    page.drawText(String(h.name || "Unnamed Hostel").substring(0, 28), { x: 48, y: y - 9, size: 7.5, font: fontRegular, color: darkGray });
    page.drawText(String(h.location || "Kumasi Campus Area").substring(0, 24), { x: 220, y: y - 9, size: 7.5, font: fontRegular, color: medGray });

    const isSanctioned =
      (h.status || "").toLowerCase().includes("sanction") ||
      (h.status || "").toLowerCase().includes("suspend") ||
      (h.status || "").toLowerCase().includes("revok");

    page.drawText(String(h.status || "Good Standing"), {
      x: 380,
      y: y - 9,
      size: 7.5,
      font: fontBold,
      color: isSanctioned ? red : green,
    });
    page.drawText(String(h.totalBeds ?? h.beds ?? 0), { x: 470, y: y - 9, size: 7.5, font: fontRegular, color: darkGray });
    y -= 18;
  }
  y -= 30;

  // 5. Sign-off Grid
  const colWidth = (width - 110) / 3;
  const sigPositions = [40, 40 + colWidth + 15, 40 + (colWidth + 15) * 2];
  const sigTitles = [
    ["Executive Director", "Student Housing Directorate"],
    ["Pro-Vice-Chancellor", "Academic & Student Affairs"],
    ["Vice-Chancellor / Rector", "Office of the VC"],
  ];

  for (let i = 0; i < 3; i++) {
    const xPos = sigPositions[i];
    page.drawLine({
      start: { x: xPos, y },
      end: { x: xPos + colWidth, y },
      thickness: 1,
      color: medGray,
    });
    page.drawText(sigTitles[i][0], {
      x: xPos + 10,
      y: y - 12,
      size: 8,
      font: fontBold,
      color: darkGray,
    });
    page.drawText(sigTitles[i][1], {
      x: xPos + 10,
      y: y - 22,
      size: 7,
      font: fontRegular,
      color: medGray,
    });
  }

  // 6. Confidential Statutory Footer
  page.drawText("CLASSIFICATION: OFFICIAL EXECUTIVE DOCUMENT (CONFIDENTIAL) • Registered under Act 389", {
    x: width / 2 - 190,
    y: 20,
    size: 6.5,
    font: fontRegular,
    color: medGray,
  });

  return await pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || body?.format || "").toLowerCase();

    // 1. Fetch live metrics from database
    const rawMetrics = await fetchLiveExecutiveMetrics();
    const metrics = {
      totalHostels: rawMetrics.totalHostels ?? 0,
      accredited: rawMetrics.accreditedCount ?? rawMetrics.accredited ?? 0,
      pending: rawMetrics.pendingCount ?? rawMetrics.pending ?? 0,
      occupiedBeds: rawMetrics.activeOccupiedBeds ?? rawMetrics.occupiedBeds ?? 0,
      totalBeds: rawMetrics.totalVerifiedBeds ?? rawMetrics.totalBeds ?? 0,
      complianceRate: rawMetrics.complianceRate ?? 0,
      sanctioned: rawMetrics.sanctionedPropertiesCount ?? rawMetrics.sanctioned ?? 0,
      ...rawMetrics,
    };
    const complianceList = Array.isArray(rawMetrics.complianceList) ? rawMetrics.complianceList : [];

    // 2. Build official USTED branded executive report HTML
    const reportHtml = body?.htmlContent || buildExecutiveReportHTML(metrics, complianceList);

    // If client requested HTML format directly, return it with text/html
    if (format === "html") {
      return new NextResponse(reportHtml, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const apiKey = process.env.PDFSHIFT_API_KEY?.trim();

    // 3. If PDFShift key exists, convert HTML template directly to PDF
    if (apiKey) {
      try {
        const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({
            source: reportHtml,
            format: "A4",
            margin: "10mm",
          }),
        });

        if (response.ok) {
          const pdfBuffer = await response.arrayBuffer();
          const dateStr = new Date().toISOString().split("T")[0];
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="HostelHQ-Executive-Briefing-Report-${dateStr}.pdf"`,
              "Content-Length": pdfBuffer.byteLength.toString(),
              "Cache-Control": "no-store, max-age=0",
            },
          });
        }
      } catch (externalErr) {
        console.warn("PDFShift conversion notice:", externalErr);
      }
    }

    // 4. Native fallback: render styled executive PDF matching USTED template
    const pdfBytes = await generateNativeExecutivePDF(metrics, complianceList);
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="HostelHQ-Executive-Briefing-Report-${dateStr}.pdf"`,
        "Content-Length": pdfBytes.byteLength.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("PDF generation route error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
