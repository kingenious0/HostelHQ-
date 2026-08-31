
import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';
import { getAuthenticatedUser } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const ablyApiKey = process.env.ABLY_SERVER_KEY;

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

  // Derive client identity from verified session rather than client-supplied param
  const user = await getAuthenticatedUser(req);
  const clientId = user ? user.uid : 'anonymous';

  // Determine scoped capabilities
  let capability: Record<string, string[]>;
  if (user?.role === 'admin') {
    capability = { '*': ['subscribe', 'publish', 'presence', 'history'] };
  } else if (user) {
    capability = {
      [`user:${user.uid}:*`]: ['subscribe', 'publish', 'presence'],
      'public:*': ['subscribe', 'presence'],
      'notifications:*': ['subscribe'],
    };
  } else {
    // Unauthenticated anonymous visitors can only subscribe to public updates
    capability = {
      'public:*': ['subscribe'],
    };
  }

  // Instantiate the client *inside* the handler for serverless environments.
  const client = new Ably.Rest(ablyApiKey);
  const tokenRequestData = await client.auth.createTokenRequest({ 
    clientId,
    capability,
  });

  return NextResponse.json(tokenRequestData);
}
