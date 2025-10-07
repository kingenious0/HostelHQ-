import { Realtime } from 'ably';

// The client doesn't use the API key directly.
// It will use a URL to fetch a token from our own server.
// We construct an absolute URL to avoid "Invalid URL" errors in different environments.
const authUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/ably-token` : '/api/ably-token';

export const ably = new Realtime({ authUrl });
