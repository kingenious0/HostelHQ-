import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test basic Genkit import
    const { ai } = await import('@/ai/genkit');
    
    // Test environment variables
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasGoogleKey = !!process.env.GOOGLE_GENAI_API_KEY;
    
    return NextResponse.json({
      status: 'success',
      genkitImported: !!ai,
      hasGeminiKey,
      hasGoogleKey,
      apiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Test basic AI generation without our flow
    const { ai } = await import('@/ai/genkit');
    
    const result = await ai.generate({
      model: 'googleai/gemini-1.5-pro',
      prompt: `You are a helpful assistant for HostelHQ. User says: "${body.message || 'Hello'}". Respond helpfully in 1-2 sentences.`,
    });
    
    return NextResponse.json({
      status: 'success',
      aiResult: result.text,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
