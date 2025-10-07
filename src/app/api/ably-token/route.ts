
import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(req: NextRequest) {
  const ablyApiKey = process.env.ABLY_API_KEY;

  if (!ablyApiKey) {
    return NextResponse.json(
      {
        errorMessage: `Missing ABLY_API_KEY environment variable.
        If you're running locally, please ensure you have a .env file with a value for ABLY_API_KEY`,
      },
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  // We're using the REST client here to create a token request.
  // The client on the frontend will then use this token to authenticate.
  const client = new Ably.Rest(ablyApiKey);
  const tokenRequestData = await client.auth.createTokenRequest({ clientId: 'hostel-hq-student' });

  return NextResponse.json(tokenRequestData);
}
