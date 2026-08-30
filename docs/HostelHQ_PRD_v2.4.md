# HostelHQ — Product Requirements Document (PRD v2.4)

**Version:** 2.4 — added Section 5c: current-state audit against live screenshots, confirmed full re-UI proceeds as planned, elevated mobile-first to an explicit cross-cutting requirement
**Date:** August 29, 2026 (revised)
**Status:** Approved for MVP development
**Author:** Elliot, with Assistant Dean of Students (USTED) as institutional stakeholder

---

## 1. Overview

HostelHQ is a university-controlled digital platform for discovering, requesting visits to, and booking registered off-campus student accommodation. It replaces the current informal system where students rely on independent agents — who add unauthorized fees and operate outside university oversight — with a direct, verified connection between students and hostel managers, under the visibility and governance of USTED's Dean of Students, Pro-VC/VC, and a Hostel Coordinator.

### 1.1 Problem Statement

- 95% of USTED students live off-campus with no centralized, university-sanctioned way to find accommodation.
- Independent agents currently mediate hostel access and add unauthorized markup fees.
- The university has no visibility into where students live, what they're being charged, or how they're being treated.
- There is no formal channel for students to report maltreatment or unsafe conditions, or for hostel managers to report problem tenants.

### 1.2 Solution

A role-based platform where: hostels register and are approved by the university; students discover and request visits to verified hostels; managers approve or reject visit requests after reviewing verified student profiles; bookings and payment happen only after a student has visited and decided to proceed; and university staff (Dean, Hostel Coordinator, Pro-VC, VC) have oversight dashboards scoped to their level of responsibility.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Eliminate the agent-as-middleman model entirely.
- Make hostel discovery and visiting free and frictionless for students.
- Verify that platform users are genuine USTED students via document review.
- Give hostel managers control over who visits, via an approval step.
- Give the university a working complaints pipeline in both directions (student↔hostel).
- Give university leadership basic oversight visibility (placements, complaint volume/trends).

### Non-Goals (explicitly deferred)
- Automated/AI document verification (manual review for now).
- WhatsApp notifications (SMS + in-app only for MVP).
- Price-change approval UI (data hook only; no dashboard).
- Itemized/visible booking fee (folded into price silently for now).
- Hostel compliance/inspection tracking.
- Live integration with a university student database.

---

## 3. User Roles

| Role | Description |
|---|---|
| **Student** | Discovers hostels, requests visits, books & pays after visiting, files complaints |
| **Hostel Manager/Owner** | Lists and manages a hostel's rooms/pricing, approves/rejects visit requests, files complaints about students |
| **System Admin** | Reviews student verification documents, technical administration, hostel registration approval |
| **Hostel Coordinator** | University role — approves hostel registrations; (Phase 2) approves price changes |
| **Dean of Students** | University role — operational oversight: complaints (both directions), placements, verification queue |
| **Pro-VC / VC** | University role — executive oversight: aggregate stats only, no individual case drill-down |

**Removed:** Agent role (listing agent + guided-visit agent) is fully retired from the system.

**Map/navigation provider:** No provider switch. The repo already runs a free, multi-provider routing stack (`CombinedRoutingService`: OpenRouteService primary → TomTom → GraphHopper → public OSRM fallback), with Mapbox handling map display — both free at this project's scale. Google Maps was evaluated and dropped after hitting a mandatory $30 Google Cloud prepayment wall, with no functional gap it would have solved that the existing stack doesn't already cover. The only map-related change is removing the Mapbox+Ably live GPS-tracking code that was specific to the now-retired agent-guided-visit feature.

---

## 4. Core User Flows

### 4.1 Student Sign-Up & Verification
1. Student creates an account with name, contact info, and student details.
2. Student uploads a photo of their Admission Letter or Student ID.
3. Account status is set to `pending`.
4. System Admin receives an SMS notification of a new pending verification.
5. Admin reviews uploaded document against sign-up details.
6. **Approve** → student receives SMS with confirmation + login link; account becomes `active` with a Verified badge.
   **Reject** → student receives SMS explaining rejection; may resubmit.

### 4.2 Hostel Discovery & Visit Request
1. Verified student browses registered/approved hostels — filter by location, price, room type, availability.
2. Student opens a hostel profile: photos, amenities, rooms, price, location, manager contact, registration status.
3. Student taps **Request Visit** (no charge).
4. Hostel manager receives notification (SMS + in-app) with the student's profile: name, contact, Verified badge, uploaded ID document.
5. Manager **Approves** or **Rejects**.
   Approved → student notified (SMS + in-app); in-app map view + "Get Directions" to the hostel unlocks (existing Mapbox display + OpenRouteService-based routing).
   - Rejected → student notified (SMS + in-app); can request a different hostel.

### 4.3 Booking & Payment
1. Student visits the hostel in person (self-directed, using the in-app map and directions).
2. If the student wants the room, they proceed to **Book** in-app.
3. Student pays the full room fee online (Paystack). The platform's booking fee is included in this total but not itemized to the student at this stage.
4. Manager receives booking confirmation; tenancy agreement is generated.
5. University dashboard reflects the new placement (student ↔ hostel).

### 4.4 Complaints (Two-Directional)
**Student → Hostel:**
1. Student opens Report/Complaint from their account or a specific hostel/booking.
2. Selects category, writes description, submits.
3. Complaint appears on the Dean of Students dashboard with hostel details (name, manager, phone, location) auto-attached.
4. Dean reviews, contacts manager if needed, updates status (Submitted → Under Review → Resolved).
5. Student is notified of status changes.

**Manager → Student:**
1. Manager opens Report from their dashboard, selects the student/booking involved.
2. Same submission and status pipeline, visible to the Dean.

### 4.5 Price Changes (Data Hook Only — No UI in MVP)
1. Manager edits a room's price.
2. New price is written to a `pendingPrice` field rather than replacing the live price.
3. *(Phase 2)* Dean/Hostel Coordinator dashboard will surface pending price changes for approval.
4. For MVP, this field exists in the data model but has no review interface — the live price remains what managers set at listing time.

---

## 5. Dashboards by Role

| Role | Dashboard contents |
|---|---|
| **Dean of Students** | Complaints (both directions) with full context, placements overview (students per hostel), pending student verifications |
| **Hostel Coordinator** | Hostel registration approval queue; (Phase 2) price-change approvals |
| **Pro-VC / VC** | Executive summary only: total registered hostels, total students placed, total complaints, complaint trend/leading category — no individual complaint or student detail |
| **System Admin** | Everything above, plus verification document review queue and technical/system administration |
| **Hostel Manager** | Own listing management, visit requests (approve/reject), bookings, revenue, complaints filed against students |

---

## 5a. UI/UX Design References (Restructure Spec)

Following a review of competitor student-housing platforms (Student.com, Amber Student, Uniplaces, Spotahome, HousingAnywhere) and a proven general-purpose reference (Airbnb), the following concrete design patterns are adopted for the MVP restructure. These apply to the existing `hostels` listing page and `hostels/[id]` detail page in the current codebase — no new pages, just a layout/UX overhaul of what's already built.

### Hostel Listing Page — Synthesis of Best Patterns

| Pattern | Source | Application |
|---|---|---|
| Verified badge treatment on cards | Uniplaces | Every card for a university-approved hostel shows a prominent **"University-Approved ✓"** badge — trust signal leads, not price |
| Shortlist/compare | Amber Student | Students can save 2–3 hostels to a shortlist and view them side-by-side before deciding which to request a visit to |
| Persistent filter bar | HousingAnywhere | Price range, room type, distance-from-campus filters stay pinned at the top of the listings page rather than living on a separate filter screen |
| Video-tour profiles (stretch) | Spotahome | Phase 2 stretch goal: allow managers to upload a short video walkthrough alongside photos, useful for students arranging housing before they can visit in person |
| "X mins from [University]" distance line | Student.com | Every listing card shows travel time from USTED campus, not just an address — directly answers the Dean's concern about students knowing how to reach a hostel |
| 3-step "How It Works" strip | Student.com | Homepage strip: Explore → Request Visit → Book — teaches the new flow at a glance and doubles as a defense-presentation slide |

### Hostel Detail Page — Airbnb-Style Restructure

The current `hostels/[id]/page.tsx` (1,350 lines) already has the right underlying data (amenities, room inventory, reviews, availability states) — this is a **layout restructure, not a data rebuild.** Adopting Airbnb's proven detail-page structure:

1. **Photo gallery grid** — one large hero photo + 4 thumbnails in a grid, with a "show all photos" expansion, replacing a single sliding carousel as the primary visual.
2. **Title + key facts row** directly beneath the gallery — hostel name, University-Approved badge, room count/capacity — in one compact line.
3. **Two-column layout below the fold:**
   - **Left (scrollable):** description → amenities → room-type breakdown → reviews
   - **Right (sticky):** price, availability badge, and the primary CTA ("Request Visit") — stays visible while scrolling, never leaves view
4. **Amenities as an icon grid** (existing `amenityIcons` mapping reused, just re-laid-out from a list to a grid).
5. **Each room type treated as its own mini-listing** within the page — photo, price, capacity, availability shown distinctly per room type, not folded into one generic hostel-wide price (borrowed from Spotahome's property-vs-room separation).
6. **Map embedded near the bottom** showing exact location and surrounding context.
7. **Reviews as a clearly separated section**, not interleaved with other content.

### Visual Reference Links (for AI agents / devs implementing this spec)

Live pages to inspect directly when building the UI — no screenshots embedded in this doc, follow the links below:

| Pattern | Reference | URL |
|---|---|---|
| Verified badge on listing cards | Uniplaces (search any city, check listing cards) | https://www.uniplaces.com |
| Shortlist/compare functionality | Amber Student (browse listings, look for save/shortlist icon) | https://amberstudent.com |
| Persistent filter bar on search results | HousingAnywhere | https://housinganywhere.com |
| Video-tour listings (stretch) | Spotahome | https://www.spotahome.com |
| Distance-from-university line + 3-step "How It Works" strip | Student.com homepage | https://www.student.com |
| Airbnb-style detail page: photo gallery grid, sticky booking card, two-column layout | Airbnb (open any listing) | https://www.airbnb.com |

---

## 5b. UI Overhaul — Additional Pages Scoped (Repo Audit)

Following a direct audit of the live app (hostel-hq.vercel.app) and its underlying repo, four more pages are identified as overhaul targets beyond the listing/detail pages in 5a. Priority and design direction for each:

### 1. Booking / Secure Checkout Flow (`src/app/hostels/[id]/secure/page.tsx`, ~670 lines)
**Why it matters most:** this is where payment happens — the highest-trust, highest-stakes screen in the app. Its role also changes under the new flow: it's no longer an early entry point but the **final step after a visit request is approved** (free visit → request → manager approval → visit → *then* this checkout page).
- **Reference:** Airbnb / Stripe Checkout multi-step pattern (Review → Pay → Confirm)
- Add a sticky order/price summary visible while the student fills the form
- Add a clear step/progress indicator so students know how many steps remain
- Reflects the new payment model: total shown already includes the folded-in booking fee (per Section 4 decisions), not itemized

### 2. Manager Dashboard (`src/app/manager/dashboard/page.tsx`, ~1,800 lines — largest file in the app)
**Why it matters:** hostel managers/owners will judge the platform primarily on this screen, and it now needs to carry the new **Visit Request approval** workflow front and center.
- **Reference:** Stripe Dashboard / Linear — clean data-table + card layout over one dense scroll
- Restructure into tabbed sections: Listings, Bookings, **Visit Requests (new)**, Payouts
- Visit Request approval (view student profile, verified badge, uploaded ID, approve/reject) should be its own clearly surfaced card, not buried in a general activity feed

### 3. Login / Signup Flow (`login/page.tsx` ~718 lines + `signup/page.tsx` ~810 lines)
**Why it matters:** first impression, and now has to carry the new document-upload verification step cleanly without confusing new students.
- **Reference:** Airbnb / Notion-style minimal split-screen auth (form on one side, brand imagery on the other)
- Restructure signup into explicit steps: Account Info → Upload ID/Admission Letter → **Pending Review confirmation screen**
- Add a distinct "Your account is under review" state so students understand why they can't log in immediately after signing up

### 4. Homepage / Hero + Search (`src/app/page.tsx`, ~178 lines)
**Clarifying finding:** the homepage IS the listing page in the current app — `Hero`, `SearchForm`, and `HostelCard` grid are already combined on one route, which aligns naturally with Student.com's hero-search-first pattern already chosen as inspiration in Section 5a.
- **Decision needed:** keep hero + results merged on one page (Student.com-style), or split into a lighter homepage with a separate `/search` results page (Airbnb-style)? Recommendation: keep merged for MVP — simpler, and matches the reference already chosen — revisit only if the combined page becomes visually cluttered once badges/filters/shortlist (Section 5a) are added.

---

## 5c. Current-State Audit (Live Screenshots) & Full Re-UI Decision

Screenshots of the live app (hostel-hq.vercel.app) were reviewed against the Section 5a/5b spec. Finding: several target patterns are **structurally present already** (photo gallery + sticky card on the detail page, trust-stats bar + distance-from-campus on the homepage, filter dropdowns + grid/list toggle on the room-selection page, a "Compare Room Options" button hinting at the Amber-style compare pattern). However, presence of the pattern is not the same as professional-grade execution — spacing, typography hierarchy, color balance (heavy maroon/red overuse), and visual consistency across pages still fall short of the Airbnb/Uniplaces/Student.com bar this spec targets.

**Decision: the full re-UI in Sections 5a/5b proceeds as planned.** This audit does not reduce scope — it confirms which existing components can likely be restyled/restructured in place versus which need to be rebuilt, and surfaces concrete bugs to fix during the rebuild rather than after.

### Bugs Found During Audit (fix during rebuild, not separately)
1. **Broken sticky-card layout on at least one hostel detail page** (observed on "YESU MO") — large empty gap in the left column, and the price/booking card renders at the bottom of the page instead of staying pinned, unlike other hostels' detail pages which render correctly. Root cause to be confirmed during rebuild — likely a conditional layout/CSS issue tied to specific hostel data.
2. **Placeholder/test images showing as hostel photos** on the homepage grid (a logo, an org chart, a bouquet graphic, an unrelated poster all appearing where real hostel photos should be). Needs a proper fallback-image strategy and real photo requirements enforced at hostel registration.
3. **"0.0 ★" displayed as a rating for hostels with zero reviews**, reading as a bad score rather than "no reviews yet." Needs a distinct empty-state treatment (e.g. "No reviews yet" instead of a numeric 0.0).
4. **Data validation gap on pricing** — at least one listing showing "GH₵1" as a price. Not a UI issue, but should be caught by validation on the manager/admin side during the rebuild.

### Mobile-First Requirement (elevated to explicit spec)

Given that the large majority of USTED students will access HostelHQ primarily on mobile, **mobile responsiveness is not a secondary pass after desktop design — it is a first-class requirement for every screen in this overhaul**, including but not limited to: homepage/search, listing grid, hostel detail page, room-selection page, checkout flow, manager dashboard, and login/signup.

Concrete implications for the rebuild:
- Design and test mobile layouts (not just "shrink the desktop layout") for every page in Sections 5a/5b — particularly the sticky booking/CTA card, which needs a mobile-appropriate pattern (e.g. a bottom-anchored sticky bar) rather than a sidebar card that has nowhere sensible to sit on a narrow screen.
- The manager dashboard (currently 1,800 lines, tab-heavy per Section 5b) needs a genuinely usable mobile experience too — hostel managers/owners checking visit requests or bookings from their phone should not be forced into a desktop-only tool.
- Filter bars, image galleries, and multi-column layouts (detail page's two-column Airbnb-style layout, the room-selection grid) all need explicit mobile breakpoints — single-column stacking, touch-friendly tap targets, and a gallery pattern that works with swipe rather than hover.
- Test on real mobile viewport widths during the rebuild, not just via browser dev-tools resizing, before considering any page "done."

---

## 6. Data Model (Key Additions)

```
User
  - existing fields (name, contact, role, etc.)
  - verificationStatus: pending | approved | rejected
  - verificationDocUrl: string
  - verificationReviewedBy: userId
  - verificationReviewedAt: timestamp

VisitRequest (new)
  - studentId
  - hostelId
  - status: pending | approved | rejected
  - requestedAt
  - respondedAt
  - managerNote

Complaint (new)
  - reporterId
  - reporterRole: student | manager
  - targetId (hostelId or studentId depending on direction)
  - category
  - description
  - status: submitted | under_review | resolved
  - createdAt / updatedAt

Room
  - existing fields (type, capacity, price, availability)
  - pendingPrice: number (nullable) — manager-proposed price awaiting future approval workflow

Role enum additions:
  - dean
  - vc
  - pro_vc
  - hostel_coordinator
```

**Removed/deprecated:** `agentId` on Hostel, Agent visit-fee logic, Agent commission logic, Agent dashboard, Ably live GPS-tracking channel/logic tied to guided visits.

**Kept as-is:** Mapbox map display component and the existing `CombinedRoutingService` (OpenRouteService → TomTom → GraphHopper → public OSRM fallback chain) — both already free at this project's scale, no changes needed beyond removing the agent-tracking-specific usage.

---

## 7. Notifications

| Event | Channel (MVP) | Channel (Phase 1.5+) |
|---|---|---|
| Verification pending → Admin | SMS | + WhatsApp |
| Verification approved/rejected → Student | SMS | + WhatsApp |
| Visit request → Manager | SMS + in-app | + WhatsApp |
| Visit approved/rejected → Student | SMS + in-app | + WhatsApp |
| Booking confirmed → Manager/Student | In-app (existing) | + WhatsApp |
| Complaint submitted → Dean | In-app | + SMS/WhatsApp |

WhatsApp requires WhatsApp Business API setup (Twilio/Meta) with an approval process — scoped as a fast-follow, not part of the initial demo, to avoid overpromising.

---

## 8. Success Criteria for Demo

The demo should walk through, end to end:
1. A new student signs up, uploads ID, gets verified (simulate SMS/admin approval).
2. Student browses hostels, requests a visit.
3. Manager receives and approves the request.
4. Student "visits" (in-app directions shown), then books and pays.
5. A complaint is filed by the student, appears on the Dean's dashboard fully linked to hostel details, status updated to Resolved.
6. Pro-VC/VC view shows aggregate numbers only (placements, complaint counts/trend).

This demonstrates the full institutional value proposition: verified access, manager control, university oversight, and student welfare — not just a booking app.

---

## 9. Phased Roadmap

**MVP (next demo):** Sections 4.1–4.4, dashboards in Section 5, data model in Section 6, SMS + in-app notifications.

**Phase 1.5:** WhatsApp Business API integration.

**Phase 2:** Price-change approval UI, automated/AI-assisted document verification, itemized booking fee toggle, hostel compliance/inspection tracking, refund/cancellation policy (pending definition), admission-letter integration (pending Dean's agreement).

---

## 10. Open Questions

1. Who specifically holds the Hostel Coordinator account — a named office/person?
2. Refund/cancellation policy — not yet defined.
3. Should "emergency/safety" complaints be split from routine complaints for faster escalation?

---

*This PRD builds directly on the meeting with the Assistant Dean of Students (Aug 28) and finalized scope decisions (Aug 29). It supersedes prior informal notes and should be treated as the current source of truth for MVP development.*
