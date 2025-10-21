
import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(req: NextRequest) {
  const ablyApiKey = process.env.ABLY_SERVER_KEY;
  // IMPORTANT: The Ably library on the client will send the clientId it was configured with.
  // We MUST use this clientId to generate the token.
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') || 'anonymous';


  if (!ablyApiKey) {
    return NextResponse.json(
      {
        errorMessage: `Missing ABLY_SERVER_KEY environment variable.`,
      },
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  // Instantiate the client *inside* the handler for serverless environments.
  const client = new Ably.Rest(ablyApiKey);
  const tokenRequestData = await client.auth.createTokenRequest({ 
    clientId: clientId,
    // Add capabilities for the client
    capability: { '*': ['subscribe', 'publish', 'presence', 'history'] }
  });

  return NextResponse.json(tokenRequestData);
}
