import { Realtime } from 'ably';

const ablyApiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;

if (!ablyApiKey) {
    throw new Error('Ably API key is not configured. Make sure you have NEXT_PUBLIC_ABLY_API_KEY in your .env file.');
}

// Use a Realtime client for both publishing and subscribing
export const ably = new Realtime({ key: ablyApiKey });
