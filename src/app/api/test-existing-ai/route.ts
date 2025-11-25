import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Test the existing working AI flow
    const { enhanceHostelDescription } = await import('@/ai/flows/enhance-hostel-description');
    
    const result = await enhanceHostelDescription({
      photosDataUris: [],
      gpsLocation: "5.6037, -0.1870",
      nearbyLandmarks: "University of Ghana, Legon",
      amenities: "WiFi, Security, Study Room",
      roomFeatures: "4 beds, shared bathroom",
      currentDescription: body.message || "A nice hostel room for students"
    });
    
    return NextResponse.json({
      status: 'success',
      aiResult: result.enhancedDescription,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
