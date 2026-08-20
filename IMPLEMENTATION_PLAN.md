# Implementation Plan: Admin Hostel Creation, Professional Signup, and SMS/OTP Integration

## Overview
This document outlines the plan to implement three major features:
1. **Admin Hostel Creation** - Allow admins to create hostels (same as agents)
2. **Professional Signup Process** - Improve signup UI/UX, especially for students
3. **SMS/OTP Integration** - Add phone verification for agents using Wigal, and SMS notifications for booking requests

---

## Phase 1: Wigal SMS Service Integration

### 1.1 Create Wigal SMS Service Module
**File**: `src/lib/wigal.ts`
- Create a service module to handle Wigal API integration
- Functions needed:
  - `sendOTP(phoneNumber: string): Promise<string>` - Send OTP to phone number
  - `verifyOTP(phoneNumber: string, otp: string): Promise<boolean>` - Verify OTP
  - `sendSMS(phoneNumber: string, message: string): Promise<boolean>` - Send SMS notification
- Store OTPs temporarily in Firestore (`otpVerifications` collection) with expiration (5-10 minutes)
- Environment variables needed:
  - `WIGAL_API_KEY` or `WIGAL_API_URL`
  - `WIGAL_SENDER_ID` (optional)

### 1.2 Create API Routes for SMS
**Files**: 
- `src/app/api/sms/send-otp/route.ts` - Server action to send OTP
- `src/app/api/sms/verify-otp/route.ts` - Server action to verify OTP
- `src/app/api/sms/send-notification/route.ts` - Server action to send booking notification

**Note**: Research Wigal API documentation to understand exact endpoint structure and authentication method.

---

## Phase 2: Signup Page Improvements

### 2.1 Add Role Selection Step
**File**: `src/app/signup/page.tsx`
- **Step 1: Role Selection** (NEW FIRST STEP):
  - Display three role cards/options in a grid layout:
    - **Student Card**:
      - Icon: GraduationCap or User icon
      - Title: "Student"
      - Description: "I'm looking for a hostel to rent"
      - Action: "Sign up as Student"
    - **Agent Card**:
      - Icon: UserCheck or Briefcase icon
      - Title: "Agent"
      - Description: "I want to list hostels and help students find rooms"
      - Action: "Sign up as Agent"
    - **Manager Card**:
      - Icon: Building or Home icon
      - Title: "Hostel Manager"
      - Description: "I manage hostel properties and oversee operations"
      - Action: "Sign up as Manager"
  - Each card should have:
    - Hover effect (border highlight, shadow)
    - Click handler to select role
    - Visual selection state (selected: border-primary, bg-primary/10)
    - Responsive design (stack on mobile, grid on desktop)
  - User selects role BEFORE filling form
  - Store selected role in state: `selectedRole: 'student' | 'agent' | 'hostel_manager' | null`
  - After selection, show "Next" button to proceed to form
  - **Note**: Admin accounts are special and cannot be created through signup. Only the predefined `admin@hostelhq.com` email gets admin role (handled in backend/login logic).

### 2.2 Update Signup Form UI
**File**: `src/app/signup/page.tsx`
- **Remove Email Domain Restriction**:
  - Allow ANY valid email address (no more @student.hostelhq.com requirement)
  - Use standard email validation (regex or built-in HTML5 validation)
  - Remove the confusing email format alert
  - Make email validation professional and clear
  
- **Conditional Fields Based on Role**:
  - **All Roles**: Full Name, Email, Password
  - **Agent Only**: Phone Number (with country code selector, default +233)
  - **Manager Only**: Terms Agreement (step after basic info)
  
- **Phone Number Field for Agents**:
  - Show phone input only when `selectedRole === 'agent'`
  - Add country code selector (default: +233 for Ghana)
  - Validate phone number format (Ghana: 0XXXXXXXXX or 233XXXXXXXXX)
  - Store phone number in user data

### 2.3 Implement OTP Verification Flow
**File**: `src/app/signup/page.tsx`
- **Multi-Step Flow**:
  - **Step 1**: Role Selection (Student/Agent/Manager)
  - **Step 2**: Basic Info Form
    - All: Name, Email, Password
    - Agent: + Phone Number
  - **Step 3**: Role-Specific Step
    - **Agent**: OTP Verification
    - **Manager**: Terms Agreement
    - **Student**: Skip (go to account creation)
  - **Step 4**: Account Creation & Login

- **Agent OTP Flow**:
  1. User selects "Agent" role
  2. User fills: Name, Email, Password, Phone Number
  3. User clicks "Continue" or "Send OTP"
  4. Send OTP to phone number via Wigal API
  5. Show OTP input screen with:
     - 6-digit OTP input field
     - "Resend OTP" button (with cooldown timer)
     - "Verify" button
  6. User enters OTP and clicks "Verify"
  7. Verify OTP on server
  8. If valid, create Firebase Auth account
  9. Create user document in `users` collection with `role='agent'` (NOT pendingUsers)
  10. Log user in automatically
  11. Redirect to agent dashboard

- **Student Flow**:
  1. User selects "Student" role
  2. User fills: Name, Email, Password
  3. User clicks "Create Account"
  4. Create Firebase Auth account
  5. Create user document with `role='student'`
  6. Log user in automatically
  7. Redirect to home page

- **Manager Flow**:
  1. User selects "Manager" role
  2. User fills: Name, Email, Password
  3. User clicks "Next"
  4. Show Terms Agreement (scrollable)
  5. User accepts terms
  6. User clicks "Create Account"
  7. Create Firebase Auth account
  8. Create user document with `role='hostel_manager'`
  9. Log user in automatically
  10. Redirect to manager dashboard

### 2.4 Remove Admin Approval Logic
**Files to Update**:
- `src/app/signup/page.tsx` - Remove pendingUsers collection logic for agents, remove email domain-based role detection
- `src/app/login/page.tsx` - Remove pending agent check
- `src/app/admin/dashboard/page.tsx` - Remove agent approval section

---

## Phase 3: Admin Hostel Creation

### 3.1 Create Admin Upload Page
**File**: `src/app/admin/upload/page.tsx`
- Duplicate the agent upload form (`src/app/agent/upload/page.tsx`)
- Modify to:
  - Check if user is admin (not agent)
  - Set `adminId` instead of `agentId` when creating hostel
  - Allow direct approval (skip pendingHostels, create directly in `hostels` collection)
  - OR: Still go through pendingHostels but auto-approve, or add a flag `createdBy: 'admin'`

### 3.2 Update Header Navigation
**File**: `src/components/header.tsx`
- Add "Upload Hostel" link in admin menu (similar to agent menu)
- Link to `/admin/upload`

### 3.3 Update Data Types
**File**: `src/lib/data.ts` or relevant type files
- Update Hostel type to allow `agentId` OR `adminId` (or use `createdBy: { type: 'agent' | 'admin', id: string }`)

---

## Phase 4: SMS Notifications for Booking Requests

### 4.1 Update Booking Flow
**File**: `src/app/hostels/book/schedule/page.tsx`
- When student selects agent and schedules visit:
  - After updating visit document with agentId
  - Fetch agent's phone number from Firestore
  - Call SMS API to send notification:
    - Message: "You have a new visit request! Student [Name] has selected you for a visit to [Hostel Name] on [Date] at [Time]. Please log in to accept or decline."
  - Handle errors gracefully (don't block booking if SMS fails)

### 4.2 Create SMS Notification Service
**File**: `src/lib/notifications.ts` or update `src/lib/wigal.ts`
- Function: `sendBookingNotification(agentId: string, visitDetails: VisitDetails): Promise<boolean>`
- Fetch agent phone number from Firestore
- Format message with visit details
- Send SMS via Wigal
- Log success/failure

### 4.3 Update Visit Creation
**File**: `src/app/hostels/book/confirmation/page.tsx` or wherever visits are created
- Ensure agent phone number is available when visit is assigned
- Trigger SMS notification after agent assignment

---

## Phase 5: Database Schema Updates

### 5.1 Update User Document Schema
- Add `phoneNumber?: string` field to user documents
- For agents: Make phoneNumber required
- Store in `users` collection (not pendingUsers)

### 5.2 Update Hostel Document Schema
- Add `createdBy?: { type: 'agent' | 'admin', id: string }` OR
- Keep `agentId` but allow it to be admin ID, add `createdByType?: 'agent' | 'admin'`
- Update queries to handle both agents and admins

### 5.3 Create OTP Verification Collection
- Collection: `otpVerifications`
- Schema:
  ```
  {
    phoneNumber: string,
    otp: string,
    expiresAt: Timestamp,
    verified: boolean,
    createdAt: Timestamp
  }
  ```

---

## Phase 6: Testing & Cleanup

### 6.1 Remove Deprecated Code
- Remove `pendingUsers` collection logic (keep collection for existing data migration if needed)
- Remove agent approval UI from admin dashboard
- Update any queries that filter by `pendingUsers`

### 6.2 Update Type Definitions
- Update `AppUser` type to include `phoneNumber?: string`
- Update role types to remove `pending_agent`
- Update any TypeScript interfaces

### 6.3 Error Handling
- Add proper error handling for SMS failures
- Add retry logic for OTP sending
- Add rate limiting for OTP requests (prevent spam)
- Add user-friendly error messages

---

## Implementation Order

1. **Phase 1**: Wigal SMS Service Integration (Foundation)
2. **Phase 2**: Signup Page Improvements (User-facing, high priority)
3. **Phase 3**: Admin Hostel Creation (Admin feature)
4. **Phase 4**: SMS Notifications (Booking flow enhancement)
5. **Phase 5**: Database Schema Updates (Throughout implementation)
6. **Phase 6**: Testing & Cleanup (Final polish)

---

## Environment Variables Needed

Add to `.env.local`:
```env
# Wigal SMS Configuration
WIGAL_API_KEY=your_wigal_api_key
WIGAL_API_URL=https://api.wigal.com (or actual Wigal API URL)
WIGAL_SENDER_ID=HostelHQ (optional)
```

---

## Key Files to Modify

### New Files:
- `src/lib/wigal.ts` - Wigal SMS service
- `src/lib/notifications.ts` - Notification helpers
- `src/app/api/sms/send-otp/route.ts` - OTP sending API
- `src/app/api/sms/verify-otp/route.ts` - OTP verification API
- `src/app/api/sms/send-notification/route.ts` - Booking notification API
- `src/app/admin/upload/page.tsx` - Admin hostel upload page

### Modified Files:
- `src/app/signup/page.tsx` - Add phone field, OTP flow, remove admin approval
- `src/app/login/page.tsx` - Remove pending agent check
- `src/app/admin/dashboard/page.tsx` - Remove agent approval, add upload link
- `src/components/header.tsx` - Add admin upload link
- `src/app/hostels/book/schedule/page.tsx` - Add SMS notification
- `src/lib/data.ts` - Update type definitions
- `src/app/agent/dashboard/page.tsx` - May need updates for phone display

---

## Research Needed

1. **Wigal API Documentation**:
   - API endpoint URLs
   - Authentication method (API key, Bearer token, etc.)
   - Request/response format
   - Rate limits
   - OTP sending endpoint
   - SMS sending endpoint
   - Cost per SMS

2. **Phone Number Validation**:
   - Ghana phone number formats
   - Validation regex patterns
   - Country code handling

---

## Notes & Considerations

1. **Backward Compatibility**: Existing agents in `pendingUsers` should be migrated or handled gracefully
2. **Error Handling**: SMS failures shouldn't block critical flows (e.g., account creation, booking)
3. **Rate Limiting**: Implement rate limiting for OTP requests to prevent abuse
4. **Security**: Store OTPs securely, use expiration times, don't log OTPs
5. **User Experience**: Show loading states, clear error messages, resend OTP option
6. **Testing**: Test with real phone numbers in development, use Wigal test environment if available

---

## Success Criteria

- ✅ Admins can create hostels through UI
- ✅ Signup page has professional, clear email validation
- ✅ Agents can sign up with phone number
- ✅ OTP verification works for agent signup
- ✅ Agents are automatically logged in after OTP verification (no admin approval)
- ✅ SMS notifications are sent to agents when students book visits
- ✅ All deprecated admin approval code is removed
- ✅ Phone numbers are stored and displayed correctly
- ✅ Error handling is robust and user-friendly

