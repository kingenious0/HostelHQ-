# HostelHQ — Requirements & Scope Document (v2)
**Prepared for:** Follow-up meeting with Assistant Dean of Students (and Prof., if present)
**Date:** August 29, 2026 (revised)
**Based on:** Meeting recording (Aug 28) + audit of current HostelHQ codebase + dev-scoping session on agent removal, verification, complaints, and maps/navigation

---

## 1. Project Direction (Updated)

**Previous framing:** A platform for students to find and book hostels without agents.

**Updated framing:** A university-controlled off-campus accommodation platform that connects verified students directly with registered hostel managers, while giving the university (Dean of Students, Pro-VC, VC) visibility into placements, pricing, availability, and student welfare complaints.

This is a stronger institutional proposition than the original pitch, and it's what should anchor the presentation: **the system solves a university problem (oversight, accountability, agent-fee abuse, student welfare), not just a student convenience problem.**

---

## 2. What's Already Built (Codebase Audit)

The platform is further along than a from-scratch build. Existing and working:

- Four user roles: student, agent, hostel_manager, admin
- Hostel listing, search, and detail pages with photos, amenities, room types, pricing
- Hostel registration/approval workflow (`pendingHostels` → admin review → `hostels`)
- Self-visit vs. agent-guided visit booking flow
- Paystack payment integration (visit fees + room booking/rent)
- Tenancy agreement auto-generation (PDF)
- Real-time agent GPS tracking during visits (Ably + Mapbox)
- Admin dashboard: KPIs, approval queues, user/listing management
- Manager dashboard: revenue, bookings, booking trend chart
- Owner payout/withdrawal system (admin-approved)
- Review/rating system with moderation
- Face-verification anti-impersonation check at login
- OTP / WebAuthn support

**Bottom line:** this is a retrofit and extension project, not a greenfield build. That should be reflected in how the project is pitched — the foundation is proven; the remaining work is the university-oversight layer.

---

## 3. Requirements Register

### 🔴 Confirmed requirements (explicitly stated by the Dean)

| # | Requirement | Status in current build |
|---|---|---|
| 1 | System targets off-campus hostels, not university halls | ✅ Already the scope |
| 2 | Students log in and browse registered hostels remotely | ✅ Built |
| 3 | Registered hostels show location, phone, contact info | ✅ Built |
| 4 | Availability shown; students know when full | ✅ Built (`Available` / `Limited` / `Full`) |
| 5 | Reduce dependence on third-party agents | ⚠️ Conflict — see Section 4 |
| 6 | Reduce/eliminate unauthorized agent markup fees | ⚠️ Conflict — see Section 4 |
| 7 | Pricing transparency for students | ⚠️ Partial — prices shown, but no change history |
| 8 | Online payment as part of the flow | ✅ Built (Paystack) |
| 9 | Complaints submitted electronically | ❌ Not built |
| 10 | Complaints routed directly to authorized officials | ❌ Not built |
| 11 | Complaint auto-links to hostel (name, owner, phone) | ❌ Not built |
| 12 | University official accounts (Dean, Pro-VC, VC) | ❌ Not built — only admin/agent/manager/student roles exist |
| 13 | System becomes university property once adopted | 📋 Governance/documentation matter, not code |

### 🟡 Proposed but not finalized (needs Dean's confirmation next meeting)

| # | Open item | Why it matters |
|---|---|---|
| 1 | Visit fee: reduce it, or fold into room price? | Affects payment flow design |
| 2 | Price changes: does the university want *approval* or just *visibility/history*? | Determines whether managers can self-edit prices or need sign-off |
| 3 | Student verification method — university login vs. document upload vs. manual review | Determines auth architecture |
| 4 | Admission-letter link to hostel directory — was raised, **not agreed on** | Don't build until confirmed |
| 5 | Refunds/cancellations | Not addressed at all in the meeting |
| 6 | Who owns the payment account — university, platform, or direct to hostel? | Payout architecture depends on this |

---

## 4. Decisions Finalized (Owner sign-off, Aug 29)

These supersede the open questions raised in the previous draft:

| Area | Decision |
|---|---|
| Agent role | **Removed entirely.** No agent listing, no agent visits, no agent commission. Fully offline as a concept. |
| Visit fee | **Free to visit.** No payment until the student decides to book. The platform/booking fee is folded silently into the total room price at final payment (not itemized to the student for now). An itemized "booking fee" line can be switched on later without a data-model change. |
| Price increases | Manager-submitted price changes require **Dean/Hostel Coordinator approval** before going live. The approval *hook* is built into the data model now (price changes write to a pending state); the approval **UI/dashboard is deferred** to Phase 2 to avoid cluttering the MVP. |
| Student verification | No access to a live university database. Verification is **document-based**: student uploads Admission Letter or Student ID at sign-up → account status `pending` → admin(s) notified via SMS (WhatsApp when available) → manual review against sign-up details → approve/reject → student notified. Path to automate (OCR/document matching) is designed for, not built yet. |
| Visit workflow | **Request-based, not instant.** Student requests a visit → manager is notified (SMS + in-app now; WhatsApp when available) → manager reviews the student's profile (verified badge, uploaded ID, contact info) → approves or rejects → student notified either way → approved student uses in-app map/navigation to the hostel. |
| University roles | Full role set: **Dean of Students, VC, Pro-VC, Hostel Coordinator.** Each gets dashboard access scoped to their level (operational vs. executive). |
| Complaints | **Two-directional.** Students can report hostels; managers/owners can report students. Both route to the same complaint pipeline. |
| Executive visibility | University-side dashboards must show: students per hostel, total students accommodated, total complaints, and leading complaint categories/trends. |
| Maps/navigation | **Stays on the existing free/open-source stack — no provider switch needed.** Audit confirmed the repo already has a `CombinedRoutingService` with a free fallback chain (OpenRouteService primary → TomTom → GraphHopper → public OSRM → manual fallback) for directions. Map *display* stays on Mapbox (`mapbox-gl`), which is free at this project's scale. Google Maps was considered but dropped after hitting a $30 mandatory prepayment wall on Google Cloud billing — not worth it when a free, already-integrated alternative exists. Only remaining map-related work is removing the Mapbox+Ably live GPS-tracking code tied to the agent-visit feature being retired. |

---

## 4a. Maps/Navigation — Decision Record

Google Maps was evaluated as a possible primary map/navigation provider, but ruled out: Google Cloud billing required a mandatory one-time $30 prepayment before free trial credits would even activate (a known requirement for certain billing regions/payment methods). Since the repo audit found routing is **already** handled by a free, multi-provider fallback system (OpenRouteService → TomTom → GraphHopper → public OSRM), and map display already runs on Mapbox's free tier, there was no functional gap to justify paying for or integrating Google Maps. **Decision: keep the existing stack as-is.**

---

## 5. Notification Channels — Practical Note

WhatsApp notifications are not zero-cost or zero-setup: they require the WhatsApp Business API via a provider (Twilio, Meta directly, etc.), with an approval process and small per-message fees. **SMS** (via a local aggregator such as Hubtel or mNotify) and **in-app notifications** are cheap and fast to implement, and should carry the MVP/demo. WhatsApp should be scoped as "Phase 1.5 — add once approved," not promised as already working for the first demo.

---

## 6. Recommended Scope for Next Demo (MVP)

1. **Remove the Agent role** — strip agent listing, agent visit-booking, agent commission logic from the app entirely; remove the associated Mapbox + Ably live GPS-tracking code as part of this cleanup (routing/map display for the remaining self-visit flow already works via the existing OpenRouteService/Mapbox stack — no rebuild needed).
2. **Visit Request flow** — new entity separate from Booking (see data model, Section 8): student requests → manager notified (SMS + in-app) → approve/reject → student notified → map/navigation unlocked on approval.
3. **Verification-pending sign-up** — document upload at registration, account `pending` until admin review, SMS notification to admins, manual approve/reject with SMS confirmation to student.
4. **Fold booking fee into room price** — remove the flat visit fee; add the platform fee as a non-itemized component of the final charged price.
5. **Complaints module (two-directional)** — students → hostel, and managers → student, both routing into one pipeline with status tracking.
6. **University role accounts** — Dean, VC, Pro-VC, Hostel Coordinator, each with a dashboard scoped appropriately (see Section 7).
7. **Price-change hook (data layer only)** — manager price edits write to a `pendingPrice` field; no approval UI yet.

## 7. Dashboard Scoping by Role

| Role | Sees |
|---|---|
| **Dean of Students** | Operational: incoming complaints (both directions) with hostel/student details attached, placements overview, verification queue |
| **Hostel Coordinator** | Operational: hostel registration approvals, (later) price-change approvals |
| **Pro-VC / VC** | Executive: aggregate stats only — total hostels, total students placed, total complaints, complaint trend/leading categories. No individual complaint drill-down needed at this level. |
| **Admin (dev/system)** | Full technical access — everything above, plus verification review queue and system health |

## 8. Data Model Additions Needed

- **`VisitRequest`** — `studentId`, `hostelId`, `status` (pending/approved/rejected), `requestedAt`, `respondedAt`, `managerNote`
- **`User.verificationStatus`** — `pending` / `approved` / `rejected`, plus `verificationDocUrl`, `verificationReviewedBy`, `verificationReviewedAt`
- **`Complaint`** — `reporterId`, `reporterRole` (student/manager), `targetId` (hostelId or studentId), `category`, `description`, `status` (Submitted/Under Review/Resolved), `timestamps`
- **`Room.pendingPrice`** — new field to hold a manager-proposed price awaiting approval (write-only for now, no approval UI in MVP)
- **New roles** — `dean`, `vc`, `pro_vc`, `hostel_coordinator` added to the existing role enum

## 9. Phase 2 (Post-Demo — do not build yet)

- Price-approval **UI** (Dean/Coordinator reviewing `pendingPrice` and approving/rejecting)
- WhatsApp Business API integration
- Automated document verification (OCR/matching)
- Itemized booking fee toggle (visible line-item instead of folded-in)
- Hostel compliance/inspection tracking
- Admission-letter integration with the student portal (still not agreed with the Dean)

## 10. Open Questions Still Worth Confirming

1. Who specifically holds the Hostel Coordinator role/account — a named office?
2. Refund/cancellation policy — still unaddressed.
3. Complaint categories — should "emergency/safety" be split out from routine complaints for faster escalation?

---

*Updated Aug 29, 2026, reflecting finalized decisions from the second working session. Prepared using the meeting transcript (Aug 28), the codebase audit, and owner sign-off on open items.*
