import { Realtime } from 'ably';

let ablyInstance: Realtime | null = null;

// Function to get a singleton instance of Ably
export function getAblyClient(): Realtime {
  if (!ablyInstance) {
    if (typeof window === 'undefined') {
      // Server-side (SSG/SSR/Build): use ABLY_SERVER_KEY if available or absolute URL with autoConnect disabled
      const key = process.env.ABLY_SERVER_KEY;
      if (key) {
        ablyInstance = new Realtime({ key, autoConnect: false });
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        ablyInstance = new Realtime({
          authUrl: `${baseUrl}/api/ably-token`,
          autoConnect: false,
        });
      }
    } else {
      // Client-side browser: safe to fetch token from root-relative endpoint
      ablyInstance = new Realtime({ authUrl: '/api/ably-token' });
    }
  }
  return ablyInstance;
}

export const ably = getAblyClient();