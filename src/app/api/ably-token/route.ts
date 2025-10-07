
import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(req: NextRequest) {
  const ablyApiKey = process.env.ABLY_SERVER_KEY;
  // Use 'anonymous' as a fallback if the client doesn't provide an ID
  const clientId = req.headers.get('x-ably-clientid') || 'anonymous';

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

  // IMPORTANT: Instantiate the client *inside* the handler for serverless environments.
  // This ensures the API key is read from the environment variables on every request.
  const client = new Ably.Rest(ablyApiKey);
  const tokenRequestData = await client.auth.createTokenRequest({ 
    clientId: clientId,
    capability: { '*': ['subscribe', 'publish', 'presence'] }
  });

  return NextResponse.json(tokenRequestData);
}

