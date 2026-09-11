import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { htmlContent } = await req.json();

    if (!htmlContent || typeof htmlContent !== 'string') {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.PDFSHIFT_API_KEY?.trim();

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      // PDFShift accepts both Basic auth (api:KEY) and X-API-Key header
      headers['Authorization'] = `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`;
      headers['X-API-Key'] = apiKey;
    }

    // PDFShift v3 payload
    const pdfShiftPayload = {
      source: htmlContent,
      format: 'A4',
      margin: '12mm',
      sandbox: !apiKey, // Run in sandbox if no API key yet
    };

    const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify(pdfShiftPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDFShift API error:', response.status, errorText);

      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {}

      const message = parsedError?.message || parsedError?.error || errorText || 'Failed to generate PDF via PDFShift';

      return NextResponse.json(
        {
          error: 'PDF conversion failed',
          details: message,
          status: response.status,
          missingKey: !apiKey,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HostelHQ-Executive-Briefing-Report-${dateStr}.pdf"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('PDF generation route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
