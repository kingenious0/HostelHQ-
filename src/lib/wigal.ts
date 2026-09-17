import 'server-only';

/**
 * Wigal (FROG) SMS Service
 * Handles OTP sending, verification, and SMS notifications via Wigal FROG API
 * Documentation: https://frogdocs.wigal.com.gh
 */

// Support both legacy WIGAL_* and alternative FROG_SMS_* env variable names
export function getWigalCredentials() {
  const apiKey =
    process.env.WIGAL_API_KEY || process.env.FROG_SMS_API_KEY || '';
  const username =
    process.env.WIGAL_USERNAME || process.env.FROG_SMS_USERNAME || '';
  const senderId =
    process.env.WIGAL_SENDER_ID || process.env.FROG_SMS_SENDER_ID || 'HostelHQ';
  return { apiKey, username, senderId };
}

/**
 * Prioritize IPv4 resolution in Node.js dual-stack networking to prevent delays or timeouts
 */
try {
  const dns = require('node:dns');
  if (typeof dns?.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Safe fallback if running in environments where node:dns is not polyfilled
}

/**
 * Normalizes Wigal base URL, trimming trailing slashes and inline comments from env vars
 */
export function getWigalBaseUrl(): string {
  const rawUrl =
    process.env.WIGAL_API_URL ||
    process.env.FROG_SMS_API_URL ||
    'https://frogapi.wigal.com.gh';
  return rawUrl.replace(/#.*$/, '').trim().replace(/\/+$/, '');
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
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';

  // Remove country code if present (233)
  if (cleaned.startsWith('233')) {
    cleaned = cleaned.substring(3);
  }

  // Remove any leading zeros (we'll add one back)
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If empty after stripping zeros, return empty
  if (!cleaned) return '';

  // Ensure it starts with 0 (Ghana format)
  return '0' + cleaned;
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
  const { apiKey, username, senderId } = getWigalCredentials();
  if (!apiKey || !username) {
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

    const baseUrl = getWigalBaseUrl();
    const finalUrl = `${baseUrl}/api/v3/sms/otp/generate`;

    const requestBody = {
      number: formattedPhone,
      expiry: expiry,
      length: length,
      messagetemplate: messageTemplate,
      type: type,
      senderid: senderId,
    };

    console.log('Wigal OTP Generate Request:', {
      url: finalUrl,
      hasApiKey: !!apiKey,
      hasUsername: !!username,
      senderId: senderId,
      phone: formattedPhone,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey,
        'USERNAME': username,
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
          error: 'SMS service gateway is temporarily unavailable. Please try again.',
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
  const { apiKey, username } = getWigalCredentials();
  if (!apiKey || !username) {
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

    const baseUrl = getWigalBaseUrl();
    const finalUrl = `${baseUrl}/api/v3/sms/otp/verify`;

    console.log('Wigal OTP Verify Request:', {
      url: finalUrl,
      phone: formattedPhone,
      hasOtpCode: !!otpCode,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey,
        'USERNAME': username,
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
          error: 'SMS service gateway is temporarily unavailable. Please try again.',
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
  const { apiKey, username, senderId } = getWigalCredentials();
  if (!apiKey || !username) {
    console.error('WIGAL_API_KEY or WIGAL_USERNAME is not configured');
    return {
      success: false,
      error: 'SMS service is not configured',
    };
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone || formattedPhone.length < 10) {
      return {
        success: false,
        error: `Invalid recipient phone number: "${phoneNumber}". Must be a valid phone number with at least 10 digits.`,
      };
    }

    // Generate a unique message ID if not provided
    const uniqueMsgId = msgId || `MSG${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const requestBody = {
      senderid: senderId,
      destinations: [
        {
          destination: formattedPhone,
          msgid: uniqueMsgId,
        }
      ],
      message: message,
      smstype: 'text',
    };

    const baseUrl = getWigalBaseUrl();
    const finalUrl = `${baseUrl}/api/v3/sms/send`;

    console.log('Wigal SMS Send Request:', {
      url: finalUrl,
      phone: formattedPhone,
      senderId: senderId,
      messageLength: message.length,
    });

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-KEY': apiKey,
        'USERNAME': username,
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
          error: 'SMS service gateway is temporarily unavailable. Please try again.',
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

