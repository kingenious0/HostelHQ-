# HostelHQ - Product Requirements Document (PRD) Update
**Version**: 2.0  
**Date**: August 2026  
**Status**: In Development / Pre-Launch  
**Product**: HostelHQ Student Accommodation & Hostel Management Platform  

---

## 1. Executive Summary & Vision
HostelHQ is a full-stack campus accommodation and property management platform engineered to resolve the systemic challenges of student housing in Ghana. The platform digitizes off-campus student accommodation discovery, guided physical inspections, room reservations, Mobile Money payment handling, legal tenancy agreement generation, and hostel operations into a unified, transparent ecosystem.

### Current Tech Stack:
- **Frontend / Framework**: Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI.
- **Backend & Database**: AWS DynamoDB (`HostelManagement` single-table via `@aws-sdk/lib-dynamodb`), Google Cloud Firebase / Cloud Firestore (auth & real-time sync), Firebase Admin SDK.
- **Geospatial & Mapping**: Mapbox GL (Interactive vector maps & GPS coordinate capture).
- **Payment & FinTech**: Paystack API (Ghanaian Cedi - GHS, Mobile Money for MTN, Telecel, AirtelTigo).
- **Real-Time & AI**: Ably (WebSockets), Firebase Genkit with Llama 3.3.
- **Document Generation**: jsPDF (Automated legal tenancy contracts & invoices).

---

## 2. User Roles & Permission Matrix

| User Role | Permissions & Core Responsibilities |
| :--- | :--- |
| **Student / Renter** | Discovers hostels, filters by campus proximity/budget, books physical guided visits, secures rooms via Paystack Mobile Money, downloads official legal tenancy agreements and invoices. |
| **Hostel Manager / Landlord** | Manages room inventory and bed allocations, reviews booking requests, monitors real-time wallet balances, requests Mobile Money payouts, and accesses signed tenant agreements. |
| **Field Agent** | Registers and onboards verified hostels using a 5-step wizard with Mapbox GPS pinning, coordinates student physical visits, marks visits as completed, and earns commission. |
| **System Administrator** | Oversees global platform metrics, vets agent property listings, manages user permissions, monitors Paystack system balances, and approves payout queues. |

---

## 3. Core Modules & Updated Requirements

### 3.1 Authentication & Progressive Student Verification
- **Frictionless Signup**: Remove mandatory document uploads at initial registration to prevent user drop-off. Onboard students in under 30 seconds using Full Name, Personal Email (Gmail/Yahoo), Phone Number, and Student Index Number.
- **Progressive Disclosure**: Identity verification is deferred until booking confirmation or physical check-in. Provide flexible proof alternatives (Student Portal Dashboard Screenshot, Admission Letter, or Ghana Card) to accommodate freshmen and students who have misplaced physical ID cards.
- **Biometric / WebAuthn Login Relocation**: Remove public fingerprint login button from the main sign-in landing screen to prevent unsupported device error states; relocate biometric quick-login to authenticated User Profile / Security Settings.
- **Single Sign-On (SSO)**: Support Google Workspace / Google Sign-In as the primary fast authentication method.

### 3.2 Geospatial Mapping & Property Discovery (Mapbox GL)
- **Interactive Map Canvas**: High-performance vector map rendering all verified hostels pinned around campus gates with walking/driving distance calculations.
- **Agent 5-Step Listing Wizard with GPS Pin-Dropping**:
  - **Step 1**: Basic Hostel Information & Campus Distance (AAMUSTED).
  - **Step 2**: Room Types, Capacities & Annual Pricing (GHS).
  - **Step 3**: Facilities, Security & Utility Breakdown (Water, Electricity, WiFi).
  - **Step 4**: Mapbox Interactive Pin-Dropper (captures precise latitude/longitude coordinates).
  - **Step 5**: High-resolution media uploads & submission for Admin vetting.
- **Hostel Details Page Layout Fix**: Convert the booking/pricing card to a sticky sidebar to eliminate the blank white space on scroll. Ensure high visual contrast on all amenity highlight badges.

### 3.3 The 3-Phase Anti-Fraud Renting Workflow
- **Phase 1: Scheduled Physical Visit**: Student books an in-person inspection date/time slot with a nominal commitment fee (e.g., GH₵ 1.00 in test mode) to eliminate spam requests.
- **Phase 2: In-Person Guided Inspection**: Field agent conducts the tour and marks the visit as "Completed" via the Agent Portal.
- **Phase 3: Unlocking Secure Hostel & Tenancy Generation**:
  - Upon visit completion, the "Secure Hostel" payment button unlocks on the listing.
  - Student completes the annual room payment via Paystack Mobile Money.
  - System updates listing status to "Hostel Secured" (preventing duplicate bookings).
  - System automatically generates a downloadable, legally binding PDF Tenancy Agreement and official payment invoice via jsPDF.

### 3.4 Financial Architecture, Wallets & Payout Management
- **Payment Collection**: Direct Paystack checkout integration supporting MTN MoMo, Telecel Cash, and AirtelTigo Money in GHS.
- **Escrow & Semi-Automated Payout Queue**:
  - Manager/Agent requests withdrawal from their dashboard.
  - System immediately locks requested funds from available balance to prevent double-spending.
  - Request is logged to the payouts collection/table with status: `pending`.
  - Admin reviews request on `/admin/dashboard`, executes MoMo transfer, and clicks "Approve & Mark Paid" with transaction reference.
  - Automated SMS and email notification sent to recipient upon approval.

---

## 4. UI/UX Refinement & Bug Fixes

### Admin Dashboard Bug Fix:
- Fix the "Unknown Unknown" creator bug in the Live Hostel Listings table by resolving manager/agent profile lookups with graceful fallback ("Verified Hall Management").

### Copywriting Modernization:
| Component | Before (Informal) | After (Professional Specification) |
| :--- | :--- | :--- |
| **Homepage Hero Subtitle** | - | Safe, verified student housing near your campus. |
| **Hostel Section Subtitle** | "Authentic stays only. No cap" | Verified stays. Zero fraud. |
| **Hostel Highlights / Amenities** | Informal single-word notes | Structured amenity specifications (e.g., "24/7 Security & CCTV Surveillance", "Reliable Potable Water & Backup Reservoir", "Dedicated Metered Power Supply"). |
| **Footer Copyright** | - | © {new Date().getFullYear()} HostelHQ. All rights reserved. |

### Seed Data & Polish:
- Replace dummy placeholder images with authentic hostel photos. Normalize pricing (GH₵ 2,500 - GH₵ 7,500/year) and distance metrics.
- Agent Dashboard: Add summary KPI metric cards (Properties Managed, Pending Visits, Total Earnings) and provide user feedback when clicking withdrawal on zero balance.

---

## 5. Security & Data Integrity Specification
- **Strict Client-Side Lockdown**: Block all direct client-side writes to wallets, transactions, payouts, and booking payment statuses.
- **Server Execution Enforcement**: All balance mutations, payout approvals, and booking status transitions must occur strictly server-side using atomic operations to prevent race conditions.

---

## 6. Implementation Roadmap

### Sprint 1: Data Sanitization & UI Polish
- Fix "Unknown Unknown" table bug in Admin dashboard.
- Sanitize seed listings, photos, and prices.
- Update copywriting and apply sticky layout on hostel details.

### Sprint 2: Workflow & Auth Optimization
- Implement progressive verification with "Skip for Now" option.
- Relocate fingerprint authentication to user settings.
- Verify visit-to-booking state transitions.

### Sprint 3: Financial & Payout Hardening
- Refactor payout queue logic with wallet locking.
- Integrate SMS notifications.
- Enforce strict security rules.

### Sprint 4: End-to-End Testing & Production Deployment
- Stress test Paystack webhooks.
- Test agent Mapbox geocoding.
- Complete end-to-end user acceptance testing (UAT).
