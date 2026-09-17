import { NextRequest, NextResponse } from "next/server";
import { fetchLiveExecutiveMetrics } from "@/services/occupancyService";
import { generateExecutiveReportHTML } from "@/templates/executiveReportTemplate";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

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

  // Palette (USTED Maroon & Neutral)
  const maroon = rgb(0.42, 0.11, 0.18); // #6B1D2F
  const darkGray = rgb(0.12, 0.16, 0.22);
  const medGray = rgb(0.42, 0.45, 0.5);
  const lightBg = rgb(0.96, 0.97, 0.98);
  const borderGray = rgb(0.85, 0.87, 0.9);
  const green = rgb(0.02, 0.47, 0.34);
  const red = rgb(0.73, 0.11, 0.11);

  let y = height - 50;

  // 1. USTED Letterhead
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

  // Header dividing line
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 2,
    color: maroon,
  });
  y -= 25;

  // 2. Title Box
  page.drawRectangle({
    x: 40,
    y: y - 30,
    width: width - 80,
    height: 38,
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

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  page.drawText(`Statutory Governance Document • Generated Live: ${dateStr}`, {
    x: width / 2 - 130,
    y: y - 26,
    size: 7.5,
    font: fontRegular,
    color: medGray,
  });
  y -= 50;

  // 3. Section 1: Portfolio Assessment
  page.drawText("1. PRIVATE STUDENT HOUSING PORTFOLIO ASSESSMENT (LIVE DATABASE)", {
    x: 40,
    y,
    size: 9.5,
    font: fontBold,
    color: darkGray,
  });
  y -= 15;

  const summaryRows = [
    ["Total Registered Hostels", `${metrics.totalHostels} Properties (${metrics.accreditedCount} Accredited, ${metrics.pendingCount} Pending)`],
    ["Live Student Bed Occupancy", `${metrics.activeOccupiedBeds} / ${metrics.totalVerifiedBeds} Active Student Beds Occupied`],
    ["Overall Portfolio Compliance", `${metrics.complianceRate}% Active Standing`],
    ["Active Statutory Sanctions", `${metrics.sanctionedPropertiesCount} Properties under corrective review`],
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

  // 4. Section 2: Live Compliance Matrix Table
  page.drawText("2. LIVE COMPLIANCE MATRIX", {
    x: 40,
    y,
    size: 9.5,
    font: fontBold,
    color: darkGray,
  });
  y -= 15;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: y - 14,
    width: width - 80,
    height: 18,
    color: rgb(0.9, 0.92, 0.94),
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  page.drawText("Hostel Name", { x: 48, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Location", { x: 220, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Status", { x: 380, y: y - 9, size: 8, font: fontBold, color: darkGray });
  page.drawText("Total Beds", { x: 470, y: y - 9, size: 8, font: fontBold, color: darkGray });
  y -= 18;

  // Table Rows (up to 18 rows to fit clean A4)
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
    page.drawText(String(h.name || "").substring(0, 28), { x: 48, y: y - 9, size: 7.5, font: fontRegular, color: darkGray });
    page.drawText(String(h.location || "").substring(0, 24), { x: 220, y: y - 9, size: 7.5, font: fontRegular, color: medGray });

    const isSanctioned =
      (h.status || "").toLowerCase().includes("sanction") ||
      (h.status || "").toLowerCase().includes("suspend") ||
      (h.status || "").toLowerCase().includes("revok");

    page.drawText(String(h.status || "accredited"), {
      x: 380,
      y: y - 9,
      size: 7.5,
      font: fontBold,
      color: isSanctioned ? red : green,
    });
    page.drawText(String(h.totalBeds || "0"), { x: 470, y: y - 9, size: 7.5, font: fontRegular, color: darkGray });
    y -= 18;
  }
  y -= 30;

  // 5. Signatures Grid
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

  return await pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const { htmlContent } = body;
    const apiKey = process.env.PDFSHIFT_API_KEY?.trim();

    // 1. If an explicit HTML content was sent and PDFShift key exists, use PDFShift
    if (apiKey && htmlContent && typeof htmlContent === "string") {
      try {
        const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({
            source: htmlContent,
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
        console.warn("PDFShift conversion fallback notice:", externalErr);
      }
    }

    // 2. Otherwise, dynamically generate live executive metrics from Firestore/DynamoDB
    const metricsData = await fetchLiveExecutiveMetrics();
    const pdfBytes = await generateNativeExecutivePDF(metricsData, metricsData.complianceList);
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
  // Support GET download as well for direct link triggers
  return POST(req);
}
