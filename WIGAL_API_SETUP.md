# Wigal (FROG) API Setup Guide

## Environment Variables

Add the following to your `.env.local` file:

```env
# Wigal FROG API Configuration
WIGAL_API_KEY=your_api_key_here
WIGAL_USERNAME=your_username_here
WIGAL_API_URL=https://frogapi.wigal.com.gh
# For testing, use: https://frogtestapi.wigal.com.gh
WIGAL_SENDER_ID=HostelHQ
```

## API Endpoints Used

### 1. Generate and Send OTP
- **Endpoint**: `POST /api/v3/sms/otp/generate`
- **Headers**: 
  - `API-KEY`: Your Wigal API key
  - `USERNAME`: Your Wigal username
  - `Content-Type`: application/json
- **Body**:
  ```json
  {
    "number": "0542709440",
    "expiry": 10,
    "length": 6,
    "messagetemplate": "Your HostelHQ verification code is: %OTPCODE%. This code expires in %EXPIRY% minutes.",
    "type": "NUMERIC",
    "senderid": "HostelHQ"
  }
  ```
- **Response**: Status `ACCEPTD` or `SUCCESS` indicates success

### 2. Verify OTP
- **Endpoint**: `POST /api/v3/sms/otp/verify`
- **Headers**: Same as above
- **Body**:
  ```json
  {
    "otpcode": "123456",
    "number": "0542709440"
  }
  ```
- **Response**: Status `SUCCESS` or `valid: true` indicates valid OTP

### 3. Send SMS Notification
- **Endpoint**: `POST /api/v3/sms/send`
- **Headers**: Same as above
- **Body**:
  ```json
  {
    "senderid": "HostelHQ",
    "destinations": [
      {
        "destination": "0542709440",
        "msgid": "MSG1234567890"
      }
    ],
    "message": "Your message here",
    "smstype": "text"
  }
  ```
- **Response**: Status `ACCEPTD` indicates success

## Phone Number Format

The FROG API expects Ghana phone numbers in local format (starting with 0), not with country code:
- ✅ Correct: `0542709440`
- ❌ Wrong: `233542709440` or `+233542709440`

The `formatPhoneNumber()` function automatically converts numbers to the correct format.

## Message Template Placeholders

For OTP messages, you can use these placeholders:
- `%OTPCODE%` - The generated OTP code (required)
- `%EXPIRY%` - Expiry time in minutes
- `%SERVICE%` - Service name
- `%LENGTH%` - OTP length
- `%TYPE%` - OTP type (NUMERIC/ALPHA/ALPHANUMERIC)

## Testing

1. Use the test API URL: `https://frogtestapi.wigal.com.gh`
2. Test with real phone numbers
3. Check API responses for error messages
4. Monitor SMS delivery status

## Error Handling

Common error responses:
- `INSUFFICIENT_BALANCE` - Account balance is low
- `EXPIRED` - OTP has expired
- `INVALID` - OTP code is incorrect
- `MISSING_FIELDS` - Required fields are missing

## Documentation Links

- Send Personalized Messages: https://frogdocs.wigal.com.gh/send_personalized.html
- Send General Messages: https://frogdocs.wigal.com.gh/send_general.html
- OTP Management: https://frogdocs.wigal.com.gh/otp.html

