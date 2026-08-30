# Prompt for Antigravity — HostelHQ UI Overhaul

Copy everything below into Antigravity, alongside the attached PRD (`HostelHQ_PRD_v2.4.md`) and Scope doc (`HostelHQ_Requirements_and_Scope_v2.md`).

---

## Prompt

You are working in the HostelHQ codebase (Next.js + Tailwind + shadcn/ui + Firebase). I've attached the current PRD and Scope document — read both fully before making any changes. This is a **professional-grade UI overhaul** of an existing, functioning app, not a rebuild from scratch. The data layer, Firebase logic, and business rules are correct and should not be broken — this task is about UI/UX restructuring, visual polish, and mobile responsiveness.

### Ground rules

1. **Read the PRD sections 5, 5a, 5b, and 5c fully before touching any code.** They contain the specific design references (Airbnb, Uniplaces, Amber Student, HousingAnywhere, Spotahome, Student.com) and exact pattern-to-page mappings you must follow.
2. **Mobile-first is non-negotiable.** Design and test every page at mobile viewport widths (375px–428px) first, then scale up to tablet/desktop. Do not just shrink desktop layouts — build mobile-appropriate patterns (e.g. a bottom-anchored sticky CTA bar instead of a sidebar card on mobile).
3. **Do not change the data model, Firebase queries, or business logic** unless explicitly required to support a UI change (e.g. adding a `pendingPrice` field per the PRD's data model section). If a UI change requires a data shape change, flag it clearly before implementing.
4. **Fix the following bugs during the rebuild** (do not treat as separate tickets — fold into the relevant page's restructure):
   - Broken sticky booking-card layout on some hostel detail pages (large empty gap in the left column, card not staying pinned) — confirmed on the "YESU MO" listing.
   - Placeholder/test images appearing as real hostel photos on the homepage grid — implement a proper fallback image / empty-state pattern.
   - "0.0 ★" displaying as a rating for hostels with zero reviews — replace with a "No reviews yet" empty state, not a numeric zero.
   - No price validation allowing values like "GH₵1" — add basic sanity-check validation on the manager/admin side.
5. **Remove the Agent role entirely** — no agent listing, agent-guided visits, agent commission logic, or agent dashboard. Also remove the Mapbox + Ably live GPS-tracking code tied to agent-guided visits (per PRD Section 6, "Removed/deprecated").
6. **Do not touch routing/maps infrastructure** — the existing `CombinedRoutingService` (OpenRouteService → TomTom → GraphHopper → OSRM fallback) and Mapbox map display are correct and free at this project's scale. No Google Maps integration.

### Build order (follow this sequence, confirm each step before moving to the next)

1. **Homepage / Hero + Search + Listing grid** (`src/app/page.tsx`)
   - Apply Uniplaces-style "University-Approved ✓" verified badge treatment on hostel cards
   - Add HousingAnywhere-style persistent filter bar (price, room type, distance)
   - Add Amber Student-style shortlist/compare affordance (save 2–3 hostels, compare side by side)
   - Keep the Student.com-style hero + search-first layout, with "X mins from campus" on every card
   - Mobile: single-column card stack, touch-friendly filter drawer instead of inline dropdowns if space-constrained

2. **Hostel Detail Page** (`src/app/hostels/[id]/page.tsx`)
   - Restructure to Airbnb's proven layout: photo gallery grid (hero + thumbnails, "show all photos" expansion) → title/key-facts row → two-column body (left: description/amenities/rooms/reviews scrollable, right: sticky price+CTA card) → amenities as icon grid → each room type as its own mini-listing (photo, price, capacity, availability) → map near the bottom → reviews as a distinct section
   - Mobile: sticky card becomes a bottom-anchored bar, gallery becomes swipeable, single-column stack for the rest

3. **Room Selection Page** (rooms/booking selection flow)
   - Keep the existing grid/list toggle and filter dropdowns, but polish spacing/typography/visual hierarchy to match the target design bar

4. **Booking / Secure Checkout Flow** (`src/app/hostels/[id]/secure/page.tsx`)
   - Restructure to a clear multi-step flow (Review → Pay → Confirm) with a sticky price summary and progress indicator
   - Reflect the new payment model: the booking/platform fee is folded into the total silently (not itemized) per PRD Section 4 decisions
   - This page is now the final step after a Visit Request is approved, not an early entry point — design copy/flow accordingly

5. **Manager Dashboard** (`src/app/manager/dashboard/page.tsx`, ~1,800 lines)
   - Restructure from a dense single scroll into tabbed sections: Listings, Bookings, Visit Requests (new), Payouts
   - Visit Request approval must be a clearly surfaced card showing the student's profile, verified badge, uploaded ID document, and contact info, with Approve/Reject actions
   - Must be genuinely usable on mobile — managers checking requests from their phone should not need a desktop

6. **Login / Signup Flow** (`src/app/login/page.tsx`, `src/app/signup/page.tsx`)
   - Restructure signup into explicit steps: Account Info → Upload ID/Admission Letter → Pending Review confirmation screen
   - Add a distinct "Your account is under review" state
   - Clean, minimal split-screen or single-column mobile-first auth layout

7. **New: Complaints module UI** (student-facing report form + Dean dashboard view) and **new university role dashboards** (Dean, Hostel Coordinator, Pro-VC/VC) — build per PRD Sections 4.4, 5, and 6. Executive (Pro-VC/VC) views show aggregate stats only, no individual complaint drill-down.

### What to deliver at each step

For each page above: show the restructured component code, confirm it builds without errors, and briefly note any data-model or Firebase query changes required (if any) before moving to the next page in the sequence.

### Do not do (explicitly out of scope for this pass)

- Google Maps integration (ruled out — see PRD Section 5c/decision record)
- WhatsApp notification integration (Phase 1.5, not this pass)
- Price-change approval UI (data hook only for now, per PRD Section 4 decisions)
- Automated/AI document verification (manual review only for MVP)
- Hostel compliance/inspection tracking

---

*End of prompt. Attach `HostelHQ_PRD_v2.4.md` and `HostelHQ_Requirements_and_Scope_v2.md` alongside this.*
