import { Realtime } from 'ably';

// The client doesn't use the API key directly.
// It will use a URL to fetch a token from our own server.
export const ably = new Realtime({ authUrl: '/api/ably-token' });
