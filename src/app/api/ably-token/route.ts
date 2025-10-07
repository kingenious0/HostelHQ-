
import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(req: NextRequest) {
  const ablyApiKey = process.env.ABLY_API_KEY;

  if (!ablyApiKey) {
    return NextResponse.json(
      {
        errorMessage: `Missing ABLY_API_KEY environment variable.`,
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
  const tokenRequestData = await client.auth.createTokenRequest({ clientId: 'hostel-hq-student' });

  return NextResponse.json(tokenRequestData);
}
