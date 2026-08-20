import 'server-only';

/**
 * Wigal (FROG) SMS Service
 * Handles OTP sending, verification, and SMS notifications via Wigal FROG API
 * Documentation: https://frogdocs.wigal.com.gh
 */

// Support both legacy WIGAL_* and alternative FROG_SMS_* env variable names
const WIGAL_API_KEY =
  process.env.WIGAL_API_KEY || process.env.FROG_SMS_API_KEY;
const WIGAL_USERNAME =
  process.env.WIGAL_USERNAME || process.env.FROG_SMS_USERNAME;
const WIGAL_SENDER_ID =
  process.env.WIGAL_SENDER_ID || process.env.FROG_SMS_SENDER_ID || 'HostelHQ';

/**
 * Robust DNS resolver that tries system DNS first, then fallbacks to Google DNS (8.8.8.8)
 * This bypasses ISP-level DNS blocking or propagation issues.
 */
async function resolveWigalUrl(urlStr: string): Promise<string> {
  const url = new URL(urlStr);
  const hostname = url.hostname;

  try {
    // Try standard resolution first
    const dns = await import('node:dns/promises');
    try {
      await dns.lookup(hostname);
      return urlStr; // System found it, use original URL
    } catch (e) {
      console.warn(`DNS lookup failed for ${hostname}, attempting Google DNS fallback...`);

      // Fallback: Using a specific Google DNS resolver
      const resolver = new dns.Resolver();
      resolver.setServers(['8.8.8.8', '1.1.1.1']);
      const addresses = await resolver.resolve4(hostname);

      if (addresses.length > 0) {
        // We found the IP! Now we swap the hostname for the IP
        // but tell fetch to ignore the SSL name mismatch (node-fetch/undici style)
        url.hostname = addresses[0];
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        return url.toString();
      }
    }
  } catch (err) {
    console.error('DNS Fallback failed:', err);
  }
  return urlStr; // Failure, return original and let fetch try one last time
}

export interface SendOTPResponse {
  success: boolean;
  otp?: string;
  message?: string;
  error?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SendSMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Format phone number for Ghana (ensure it's in correct format for FROG API)
 * FROG API expects numbers without country code prefix (e.g., "0542709440" not "233542709440")
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Remove country code if present (233)
  if (cleaned.startsWith('233')) {
    cleaned = cleaned.substring(3);
  }

  // Remove any leading zeros (we'll add one back)
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Ensure it starts with 0 (Ghana format)
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Generate and send OTP via Wigal FROG API
 * Uses the /api/v3/sms/otp/generate endpoint
 */
export async function generateAndSendOTP(
  phoneNumber: string,
  options?: {
    length?: number;
    expiry?: number; // in minutes
    type?: 'NUMERIC' | 'ALPHA' | 'ALPHANUMERIC';
    messageTemplate?: string;
  }
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!WIGAL_API_KEY || !WIGAL_USERNAME) {
    console.error('WIGAL_API_KEY or WIGAL_USERNAME is not configured');
    return {
      success: false,
      error: 'SMS service is not configured. Please contact support.',
    };
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const length = options?.length || 6;
    const expiry = options?.expiry || 10; // 10 minutes default
    const type = options?.type || 'NUMERIC';
    const messageTemplate = options?.messageTemplate ||
      `Your HostelHQ verification code is: %OTPCODE%. This code expires in %EXPIRY% minutes.`;

    // DNS Workaround: If the system can't find the host, we'll try to help it
    const baseUrl = process.env.WIGAL_API_URL || process.env.FROG_SMS_API_URL || 'https://frogapi.wigal.com.gh';
    const finalUrl = await resolveWigalUrl(`${baseUrl}/api/v3/sms/otp/generate`);

    const requestBody = {
      number: formattedPhone,
      expiry: expiry,
      length: length,
      messagetemplate: messageTemplate,
      type: type,
      senderid: WIGAL_SENDER_ID,
    };

    console.log('Wigal OTP Generate Request:', {
      url: finalUrl,
      hasApiKey: !!WIGAL_API_KEY,
      hasUsername: !!WIGAL_USERNAME,
      senderId: WIGAL_SENDER_ID,
      phone: formattedPhone,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': WIGAL_API_KEY,
        'USERNAME': WIGAL_USERNAME,
      },
      body: JSON.stringify(requestBody),
    });

    // Try to parse response body regardless of status
    let responseData;
    try {
      const responseText = await response.text();

      // Check if response is HTML (error page) instead of JSON
      if (responseText.trim().startsWith('<') || responseText.trim().startsWith('<!')) {
        console.error('Wigal API returned HTML instead of JSON:', responseText.substring(0, 300));
        return {
          success: false,
          error: 'SMS service returned an error. Please verify your Wigal API credentials are correct.',
        };
      }

      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse API response:', parseError);
      return {
        success: false,
        error: 'Invalid response from SMS service. Please try again later.',
      };
    }

    console.log('Wigal OTP Generate Response:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    });

    if (!response.ok) {
      // Handle different error cases
      const errorMessage = responseData.message ||
        responseData.error ||
        responseData.errorMessage ||
        `HTTP ${response.status}: ${response.statusText}`;

      // Provide more helpful error messages
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Authentication failed. Please check your Wigal API credentials (API-KEY and USERNAME).',
        };
      }

      if (response.status === 400) {
        return {
          success: false,
          error: errorMessage || 'Invalid request. Please check the phone number format and Sender ID.',
        };
      }

      return {
        success: false,
        error: errorMessage || 'Failed to generate OTP. Please try again.',
      };
    }

    // Check response status in data
    if (responseData.status === 'ACCEPTD' || responseData.status === 'SUCCESS' || response.status === 200) {
      return {
        success: true,
        message: 'OTP sent successfully',
      };
    }

    // If status is not success, return error
    return {
      success: false,
      error: responseData.message || responseData.error || 'Failed to generate OTP',
    };
  } catch (error: any) {
    console.error('Error generating OTP:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      success: false,
      error: error.message || 'Network error. Please check your internet connection and try again.',
    };
  }
}

/**
 * Verify OTP via Wigal FROG API
 * Uses the /api/v3/sms/otp/verify endpoint
 */
export async function verifyOTP(phoneNumber: string, otpCode: string): Promise<VerifyOTPResponse> {
  if (!WIGAL_API_KEY || !WIGAL_USERNAME) {
    console.error('WIGAL_API_KEY or WIGAL_USERNAME is not configured');
    return {
      success: false,
      error: 'SMS service is not configured. Please contact support.',
    };
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const requestBody = {
      otpcode: otpCode,
      number: formattedPhone,
    };

    const baseUrl = process.env.WIGAL_API_URL || process.env.FROG_SMS_API_URL || 'https://frogapi.wigal.com.gh';
    const finalUrl = await resolveWigalUrl(`${baseUrl}/api/v3/sms/otp/verify`);

    console.log('Wigal OTP Verify Request:', {
      url: finalUrl,
      phone: formattedPhone,
      hasOtpCode: !!otpCode,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': WIGAL_API_KEY,
        'USERNAME': WIGAL_USERNAME,
      },
      body: JSON.stringify(requestBody),
    });

    // Try to parse response body regardless of status
    let responseData;
    try {
      const responseText = await response.text();

      // Check if response is HTML (error page) instead of JSON
      if (responseText.trim().startsWith('<') || responseText.trim().startsWith('<!')) {
        console.error('Wigal API returned HTML instead of JSON:', responseText.substring(0, 300));
        return {
          success: false,
          error: 'SMS service returned an error. Please verify your Wigal API credentials are correct.',
        };
      }

      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse API response:', parseError);
      return {
        success: false,
        error: 'Invalid response from SMS service. Please try again later.',
      };
    }

    console.log('Wigal OTP Verify Response:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    });

    if (!response.ok) {
      const errorMessage = responseData.message ||
        responseData.error ||
        responseData.errorMessage ||
        `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Authentication failed. Please check your Wigal API credentials.',
        };
      }

      return {
        success: false,
        error: errorMessage || 'Failed to verify OTP. Please try again.',
      };
    }

    // Check if OTP is valid
    if (responseData.status === 'SUCCESS' || responseData.valid === true || response.status === 200) {
      return {
        success: true,
        message: 'OTP verified successfully',
      };
    }

    return {
      success: false,
      error: responseData.message || responseData.error || 'Invalid or expired OTP',
    };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      success: false,
      error: error.message || 'Network error. Please check your internet connection and try again.',
    };
  }
}

/**
 * Send SMS notification via Wigal FROG API
 * Uses the /api/v3/sms/send endpoint (General Messages)
 */
export async function sendSMS(phoneNumber: string, message: string, msgId?: string): Promise<SendSMSResponse> {
  if (!WIGAL_API_KEY || !WIGAL_USERNAME) {
    console.error('WIGAL_API_KEY or WIGAL_USERNAME is not configured');
    return {
      success: false,
      error: 'SMS service is not configured',
    };
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    // Generate a unique message ID if not provided
    const uniqueMsgId = msgId || `MSG${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const requestBody = {
      senderid: WIGAL_SENDER_ID,
      destinations: [
        {
          destination: formattedPhone,
          msgid: uniqueMsgId,
        }
      ],
      message: message,
      smstype: 'text',
    };

    const baseUrl = process.env.WIGAL_API_URL || process.env.FROG_SMS_API_URL || 'https://frogapi.wigal.com.gh';
    const finalUrl = await resolveWigalUrl(`${baseUrl}/api/v3/sms/send`);

    console.log('Wigal SMS Send Request:', {
      url: finalUrl,
      phone: formattedPhone,
      senderId: WIGAL_SENDER_ID,
      messageLength: message.length,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': WIGAL_API_KEY,
        'USERNAME': WIGAL_USERNAME,
      },
      body: JSON.stringify(requestBody),
    });

    // Try to parse response body regardless of status
    let responseData;
    try {
      const responseText = await response.text();

      // Check if response is HTML (error page) instead of JSON
      if (responseText.trim().startsWith('<') || responseText.trim().startsWith('<!')) {
        console.error('Wigal API returned HTML instead of JSON:', responseText.substring(0, 300));
        return {
          success: false,
          error: 'SMS service returned an error. Please verify your Wigal API credentials are correct.',
        };
      }

      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse API response:', parseError);
      return {
        success: false,
        error: 'Invalid response from SMS service. Please try again later.',
      };
    }

    console.log('Wigal SMS Send Response:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    });

    if (!response.ok) {
      const errorMessage = responseData.message ||
        responseData.error ||
        responseData.errorMessage ||
        `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Authentication failed. Please check your Wigal API credentials.',
        };
      }

      if (response.status === 400) {
        return {
          success: false,
          error: errorMessage || 'Invalid request. Please check the phone number format and Sender ID.',
        };
      }

      return {
        success: false,
        error: errorMessage || 'Failed to send SMS',
      };
    }

    // FROG API returns status "ACCEPTD" on success
    if (responseData.status === 'ACCEPTD' || responseData.status === 'SUCCESS' || response.status === 200) {
      return {
        success: true,
        message: 'SMS sent successfully',
      };
    }

    return {
      success: false,
      error: responseData.message || responseData.error || 'Failed to send SMS',
    };
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      success: false,
      error: error.message || 'Network error. Please check your internet connection and try again.',
    };
  }
}

