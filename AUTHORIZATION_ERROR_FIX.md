# Fixing "You are not authorized" Error

## Error Analysis

The error "You are not authorized to perform action requested on resource" typically indicates:

1. **Invalid API Credentials** - API-KEY or USERNAME is incorrect
2. **Missing Credentials** - Environment variables not set
3. **Sender ID Not Approved** - The Sender ID needs to be approved by Wigal
4. **Account Permissions** - Account doesn't have permission for OTP generation
5. **Wrong API Endpoint** - Using test API with production credentials or vice versa

## What I've Fixed

### 1. Enhanced Error Logging
- Added detailed console logs for API requests and responses
- Logs show request URL, headers (without sensitive data), and full response
- Better error messages for different error types (401, 403, 400, etc.)

### 2. Improved Error Handling
- Better parsing of API responses
- More descriptive error messages for users
- Hints for common configuration issues

### 3. Created Debug Tools
- Test route: `/api/test-wigal` (development only) to verify configuration
- Troubleshooting guide: `WIGAL_TROUBLESHOOTING.md`

## Immediate Steps to Fix

### Step 1: Verify Environment Variables

Check your `.env.local` file has all required variables:

```env
WIGAL_API_KEY=your_actual_api_key_here
WIGAL_USERNAME=your_actual_username_here
WIGAL_API_URL=https://frogapi.wigal.com.gh
# OR for testing:
# WIGAL_API_URL=https://frogtestapi.wigal.com.gh
WIGAL_SENDER_ID=your_approved_sender_id
```

**Important:**
- `WIGAL_API_KEY` and `WIGAL_USERNAME` are REQUIRED
- Values must match exactly (case-sensitive, no extra spaces)
- Restart your Next.js server after updating `.env.local`

### Step 2: Verify Credentials with Wigal

1. Log in to your Wigal account dashboard
2. Verify your API-KEY is correct and active
3. Verify your USERNAME matches your account username
4. Check if your account has OTP generation permissions enabled

### Step 3: Verify Sender ID

1. Check if `WIGAL_SENDER_ID` is approved in your Wigal account
2. Sender ID must be approved before use
3. Contact Wigal support if you need a Sender ID approved
4. Common approved formats: "HostelHQ", "HOSTELHQ", or a short code

### Step 4: Check Server Logs

After attempting to send an OTP, check your server console for:

```
Wigal OTP Generate Request: {
  url: 'https://frogapi.wigal.com.gh/api/v3/sms/otp/generate',
  hasApiKey: true,
  hasUsername: true,
  senderId: 'HostelHQ',
  phone: '0542709440'
}

Wigal OTP Generate Response: {
  status: 403,
  statusText: 'Forbidden',
  data: { message: '...' }
}
```

This will show you the exact error from the API.

### Step 5: Test with Test API

Try using the test API first:

```env
WIGAL_API_URL=https://frogtestapi.wigal.com.gh
```

Test credentials work with the test API before switching to production.

### Step 6: Test Configuration Route

Visit `http://localhost:8080/api/test-wigal` (development only) to see:
- If environment variables are loaded
- API connection status
- Detailed error messages

## Common Issues and Solutions

### Issue 1: "Authentication failed"
**Solution:**
- Double-check API-KEY and USERNAME are correct
- Ensure no extra spaces or characters
- Verify credentials in Wigal dashboard
- Try regenerating API key if needed

### Issue 2: "Sender ID not approved"
**Solution:**
- Contact Wigal support to approve your Sender ID
- Use an already approved Sender ID
- Check Sender ID format matches exactly (case-sensitive)

### Issue 3: "Insufficient permissions"
**Solution:**
- Verify your Wigal account has OTP generation enabled
- Contact Wigal support to enable OTP features
- Check account subscription/plan includes OTP

### Issue 4: Environment variables not loading
**Solution:**
- Ensure `.env.local` is in the project root
- Restart Next.js server after changing `.env.local`
- Check variable names are exact (case-sensitive)
- Verify no syntax errors in `.env.local`

## Testing Checklist

- [ ] `.env.local` file exists in project root
- [ ] `WIGAL_API_KEY` is set and correct
- [ ] `WIGAL_USERNAME` is set and correct
- [ ] `WIGAL_API_URL` is set (test or production)
- [ ] `WIGAL_SENDER_ID` is set and approved
- [ ] Next.js server restarted after updating `.env.local`
- [ ] Server logs show credentials are loaded (hasApiKey: true, hasUsername: true)
- [ ] Test with `/api/test-wigal` route (development)
- [ ] Check server console for detailed error logs

## Next Steps

1. **Check Server Logs**: Look at your Next.js server console for detailed error messages
2. **Verify Credentials**: Double-check all environment variables
3. **Test API Manually**: Use cURL or Postman to test the API directly
4. **Contact Wigal Support**: If credentials are correct but still getting errors, contact Wigal support

## Manual API Test

Test the API directly with cURL:

```bash
curl -X POST https://frogapi.wigal.com.gh/api/v3/sms/otp/generate \
  -H "Content-Type: application/json" \
  -H "API-KEY: YOUR_API_KEY" \
  -H "USERNAME: YOUR_USERNAME" \
  -d '{
    "number": "0542709440",
    "expiry": 10,
    "length": 6,
    "messagetemplate": "Your code is: %OTPCODE%",
    "type": "NUMERIC",
    "senderid": "HostelHQ"
  }'
```

Replace `YOUR_API_KEY` and `YOUR_USERNAME` with your actual credentials.

If this works, the issue is in the application code. If it doesn't, the issue is with your Wigal account or credentials.

## Contact Wigal Support

If issues persist:
1. Provide your account details
2. Share the exact error message from server logs
3. Verify account permissions for OTP generation
4. Check if Sender ID needs approval
5. Verify account balance (if applicable)

## Updated Files

- `src/lib/wigal.ts` - Enhanced error logging and handling
- `src/app/api/sms/send-otp/route.ts` - Better error messages
- `src/app/signup/page.tsx` - Improved error display
- `WIGAL_TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- `src/app/api/test-wigal/route.ts` - Configuration test route

