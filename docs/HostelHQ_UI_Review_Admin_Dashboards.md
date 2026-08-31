# HostelHQ — UI Review: Administrative Dashboards (Dean, Coordinator, Executive)

Standalone review + fix list. Feed to Antigravity alongside the codebase. **This reviews the dashboards built via the old (soon-to-be-removed) access method — the review is about visual/UX polish, not the access-control fix, which is covered separately.**

## What's working — keep this

- Consistent visual system across all three dashboards: dark gradient hero banner (role badge + title + one-line description + a primary action button like "Refresh Registry"), followed by 4 KPI stat cards, followed by a tabbed content area. This consistency is a real strength — don't redesign it from scratch, refine it.
- Dean dashboard's complaints table has genuine, working filtering: search bar, direction filter (All/Student→Hostel/Manager→Student), status filter (All/Submitted/Reviewing/Resolved). This is good, functional UX — keep.
- Full-context auto-linking on complaints (student contact info + hostel/manager contact info shown inline) matches the PRD spec well.
- The Executive dashboard's "Data Governance & Student Privacy Compliance" footer notice is a nice touch — reinforces the aggregate-only/no-individual-data design decision visibly to the user, not just enforced silently.

## Fixes needed — in priority order

### 1. Remove internal spec references from user-facing copy (HIGH priority)
The Coordinator dashboard's price-change tab shows a badge reading **"PRD §6 Data Hook"** directly in the UI. This is an internal document reference that a real Hostel Coordinator has no context for — it reads as an unfinished/leaked implementation detail, not professional copy. Replace with plain language, e.g. **"Pending Price Change"** or **"Tariff Revision Request."** Audit the rest of the UI for any other internal spec/dev references that may have leaked into user-facing text.

### 2. Fix the misleading "100% Closed" resolution-efficiency bar (HIGH priority)
On the Executive dashboard, "Resolution Efficiency" shows a fully green bar reading "100% Closed" while both "Resolved" and "In Active Review" show 0. This is a divide-by-zero default, not a real 100% — and it's actively misleading (implies strong performance when there's simply no complaint data yet). Fix: when total disputes = 0, show an explicit "No disputes recorded yet" state instead of a false 100%.

### 3. Fix the empty "Leading Grievance Categories & Trend" panel (HIGH priority)
This panel currently renders as blank white space with just a header and description — no chart, no placeholder. Either implement the actual chart (bar/pie breakdown of complaint categories once data exists) or, when there's no data yet, show a clear empty state (e.g. "No complaints recorded yet — this chart will populate as data comes in") rather than leaving it visually broken-looking.

### 4. Confirm the price-change approval UI is an intentional keep, not accidental scope creep (MEDIUM priority — decision needed, not a pure bug)
The original build instructions specified the price-change feature should be data-hook-only for this pass (a `pendingPrice` field with no approval UI, deferred to Phase 2). The Coordinator dashboard instead shipped a **fully working Authorize/Decline interface** with tariff deltas and manager justification text. This isn't necessarily bad — it's a complete, working feature — but confirm explicitly whether to keep it as-is (in which case, update project docs to reflect Phase 2 already being done here) or hold it back for later. Either is fine; what matters is it's a deliberate choice, not an overlooked instruction.

### 5. Tone down bureaucratic copy (MEDIUM priority)
Headings and descriptions lean heavily formal/governmental — "Institutional Accommodation & Welfare Dashboard," "Directorate of Accommodation," "Operational Housing Affairs," "University Housing Board." This isn't wrong for a university-facing tool, but it risks reading as over-engineered *tone* rather than a clean, usable product. Recommend trimming to more direct, still-professional language — e.g. "Housing Oversight Dashboard" instead of "Institutional Accommodation & Welfare Dashboard." Keep the role-badge concept (it's good for context), just simplify the wording.

### 6. Mobile responsiveness — real specification (HIGH priority, upgraded from earlier draft)

These dashboards must be **genuinely responsive across the full range of screen sizes** — not squeezed on mobile, not awkwardly stretched with empty space on desktop, professional-looking at every breakpoint. Specifics:

**KPI stat cards (all three dashboards):**
- Desktop: 4 cards in a single row.
- Tablet: 2x2 grid.
- Mobile: single column, full-width stack. Cards should not shrink their text to fit — the numbers are the hero of each card, keep them legible (don't drop below ~28-32px for the main figure even on the smallest supported width).

**Data tables (Dean's complaints inbox, Coordinator's registration/price-change queues):**
- Desktop: full table as currently built.
- Mobile: **collapse into stacked cards, one per row** — each card shows the same fields vertically (e.g. subject/category as the card title, then student/hostel context, status badge, and action buttons below). Do not shrink a 6-column table to fit a phone screen by making text tiny or forcing horizontal scroll — that's the "too squeezed" failure mode to explicitly avoid.
- Filters/search (currently pill-style tabs + search bar on Dean's dashboard): on mobile, this can collapse into a single filter icon that opens a bottom sheet or dropdown with the same filter options, rather than five filter pills competing for width on a narrow screen.

**Hero banner (all three dashboards):**
- Desktop: current layout (badge, title, subtitle, action button) is fine as-is.
- Mobile: reduce vertical padding/height so the banner doesn't push KPI cards and real content too far below the fold — a hero banner shouldn't take up most of a phone's first screen. Consider stacking the action button (e.g. "Refresh Registry") below the text on mobile rather than beside it if width is tight.

**Tabs (Registration Approval Queue / Price Change / Accredited Directory, etc.):**
- Desktop: current horizontal tab row is fine.
- Mobile: if tab labels don't comfortably fit the screen width, allow horizontal scroll on the tab row itself (a common, expected mobile pattern) rather than shrinking tab text to illegibility or wrapping awkwardly.

**General target:** at no breakpoint should content feel cramped (tiny unreadable text, elements touching edges with no padding) or feel stretched/sparse (huge empty gaps, oversized elements with nothing to fill the space). Test at common real widths — roughly 375px, 414px (mobile), 768px (tablet), 1280px+ (desktop) — and confirm the layout looks intentional and professional at each, not like a desktop layout that was simply scaled down or a mobile layout stretched wide.

**Reference direction (visual polish, from prior review):**
- **Dean's complaints inbox** → Zendesk's ticket-dashboard pattern is the closest real-world analog: compact row density without feeling cramped, clear status/category color-coding, and a left-side filter rail as an alternative to horizontal pill filters if the mobile-collapse above needs a desktop counterpart refresh too.
- **Executive/Pro-VC dashboard** → Stripe Dashboard's restrained color use (one accent + neutral grays, not multi-color busy-ness), confident large typography on the KPI numbers themselves, and clean empty/skeleton states instead of blank panels — this directly fixes the empty "Leading Grievance Categories" panel bug (Fix #3 above).
- **Coordinator dashboard** is already the strongest of the three as currently built — use it as the template the other two should feel consistent with, rather than pulling in a fourth separate style.

## General direction — not over-engineered, HCI-sound

Keep the review grounded in this principle: the layout structure (hero → KPIs → tabs → table) is already sound and shouldn't be redesigned wholesale. The fixes above are about **polish and correctness** (broken states, leaked internal references, misleading data displays, copy tone, mobile support) — not a request for a new visual direction. Avoid adding additional dashboard sections, extra charts, or new KPIs beyond what's already there unless a real gap is identified — the goal is a clean, trustworthy, professional tool, not a maximalist one.

---

*This is a UI/polish review, separate from the access-control security fix (already specified in a separate doc). Both should be addressed, but the access-control fix is the higher-priority of the two.*
