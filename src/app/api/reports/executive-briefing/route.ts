import { NextRequest, NextResponse } from "next/server";
import { fetchLiveExecutiveMetrics } from "@/services/occupancyService";
import { generateExecutiveReportHTML } from "@/templates/executiveReportTemplate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "html";

    // Query live database aggregation metrics
    const metricsData = await fetchLiveExecutiveMetrics();

    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: metricsData,
        generatedAt: new Date().toISOString(),
      });
    }

    // Render HTML with official USTED Letterhead
    const htmlContent = generateExecutiveReportHTML(
      metricsData,
      metricsData.complianceList
    );

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Executive briefing report generation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate executive briefing" },
      { status: 500 }
    );
  }
}
