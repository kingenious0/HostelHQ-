
import { Realtime } from 'ably';

// The client doesn't use the API key directly.
// It will use a URL to fetch a token from our own server.
// We use a root-relative path to ensure it always points to the correct endpoint.
const authUrl = '/api/ably-token';

export const ably = new Realtime({ authUrl });
