import { NextRequest, NextResponse } from "next/server";
import { fetchLiveHostelOccupancyMetrics } from "@/services/occupancyService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await fetchLiveHostelOccupancyMetrics();
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("fetchLiveHostelOccupancyMetrics API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch live occupancy metrics" },
      { status: 500 }
    );
  }
}
