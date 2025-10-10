
import { Realtime } from 'ably';

// The client doesn't use the API key directly.
// It will use a URL to fetch a token from our own server.
// We use a root-relative path to ensure it always points to the correct endpoint.
const authUrl = '/api/ably-token';

let ablyInstance: Realtime | null = null;

// Function to get a singleton instance of Ably
function getAblyClient() {
    if (!ablyInstance) {
            ablyInstance = new Realtime({ authUrl });
                }
                    return ablyInstance;
                    }

                    // We initialize Ably without a clientId here.
                    // The clientId will be set dynamically in the Header component after user authentication.
                    export const ably = getAblyClient();
                    