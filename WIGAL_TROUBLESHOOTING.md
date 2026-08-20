# Wigal FROG API Troubleshooting Guide

## Common Errors and Solutions

### 1. "You are not authorized to perform action requested on resource"

This error typically means authentication failed. Check the following:

#### ✅ Check Environment Variables
Make sure these are set in your `.env.local` file:
```env
WIGAL_API_KEY=your_api_key_here
WIGAL_USERNAME=your_username_here
WIGAL_API_URL=https://frogapi.wigal.com.gh
WIGAL_SENDER_ID=HostelHQ
```

#### ✅ Verify API Credentials
1. Log in to your Wigal account
2. Verify your API-KEY is correct
3. Verify your USERNAME matches your account
4. Ensure credentials are active and not expired

#### ✅ Check Sender ID
1. Make sure `WIGAL_SENDER_ID` matches your approved Sender ID in Wigal
2. Sender ID must be approved by Wigal before use
3. Contact Wigal support if you need a Sender ID approved

#### ✅ Test with Test API
Try using the test API first:
```env
WIGAL_API_URL=https://frogtestapi.wigal.com.gh
```

### 2. "Invalid request" or 400 Error

#### ✅ Check Phone Number Format
- Phone numbers should be in Ghana local format (e.g., `0542709440`)
- The system automatically converts from international format
- Ensure the phone number is valid and active

#### ✅ Check Request Parameters
- `expiry`: Must be a positive number (in minutes)
- `length`: Must be between 4-10 digits
- `type`: Must be 'NUMERIC', 'ALPHA', or 'ALPHANUMERIC'
- `messagetemplate`: Must contain `%OTPCODE%` placeholder

### 3. "Insufficient Balance"

#### ✅ Check Account Balance
1. Log in to Wigal dashboard
2. Check your account balance
3. Top up your account if needed

### 4. Network Errors

#### ✅ Check Internet Connection
- Ensure server has internet access
- Check firewall settings
- Verify API URL is accessible

#### ✅ Check API URL
- Production: `https://frogapi.wigal.com.gh`
- Test: `https://frogtestapi.wigal.com.gh`
- Ensure URL is correct (no typos)

### 5. OTP Not Received

#### ✅ Check Phone Number
- Verify phone number is correct
- Ensure phone can receive SMS
- Check if phone is on a supported network (MTN, Vodafone, AirtelTigo)

#### ✅ Check Spam Folder
- Some SMS might be filtered as spam
- Check phone's spam/message filtering settings

#### ✅ Check Account Status
- Verify Wigal account is active
- Check if account has restrictions
- Contact Wigal support if issues persist

## Debugging Steps

### 1. Enable Detailed Logging

Check server logs for detailed error messages:
```bash
# Check Next.js server logs
npm run dev
# Look for "Wigal OTP Generate Request" and "Wigal OTP Generate Response" logs
```

### 2. Test API Manually

Test the API with cURL:
```bash
curl -X POST https://frogapi.wigal.com.gh/api/v3/sms/otp/generate \
  -H "Content-Type: application/json" \
  -H "API-KEY: your_api_key" \
  -H "USERNAME: your_username" \
  -d '{
    "number": "0542709440",
    "expiry": 10,
    "length": 6,
    "messagetemplate": "Your code is: %OTPCODE%",
    "type": "NUMERIC",
    "senderid": "HostelHQ"
  }'
```

### 3. Verify Environment Variables

Create a test route to check if environment variables are loaded:
```typescript
// app/api/test-wigal-config/route.ts
export async function GET() {
  return Response.json({
    hasApiKey: !!process.env.WIGAL_API_KEY,
    hasUsername: !!process.env.WIGAL_USERNAME,
    apiUrl: process.env.WIGAL_API_URL,
    senderId: process.env.WIGAL_SENDER_ID,
    // Don't expose actual values in production!
  });
}
```

### 4. Check API Response

The updated code now logs detailed API responses. Check your server console for:
- Request URL
- Request headers (without sensitive data)
- Response status
- Response body

## Common Solutions

### Solution 1: Verify Credentials
```bash
# Check if variables are loaded
echo $WIGAL_API_KEY
echo $WIGAL_USERNAME
```

### Solution 2: Restart Server
After updating `.env.local`, restart your Next.js server:
```bash
# Stop server (Ctrl+C)
# Start server again
npm run dev
```

### Solution 3: Check Next.js Config
Ensure environment variables are properly configured in `next.config.js` if needed:
```javascript
// next.config.js
module.exports = {
  env: {
    WIGAL_API_KEY: process.env.WIGAL_API_KEY,
    WIGAL_USERNAME: process.env.WIGAL_USERNAME,
  },
};
```

### Solution 4: Contact Wigal Support
If issues persist:
1. Contact Wigal support with your account details
2. Provide error messages and request/response logs
3. Verify account permissions for OTP generation
4. Check if Sender ID is approved

## Testing Checklist

- [ ] Environment variables are set
- [ ] API credentials are correct
- [ ] Sender ID is approved
- [ ] Account has sufficient balance
- [ ] Phone number format is correct
- [ ] API URL is correct (test or production)
- [ ] Server has internet access
- [ ] Server logs show detailed error messages

## Getting Help

If you continue to experience issues:
1. Check server logs for detailed error messages
2. Test API manually with cURL
3. Verify all environment variables
4. Contact Wigal support with error details
5. Check Wigal documentation: https://frogdocs.wigal.com.gh

