# HostelHQ — Fix Batch: Hero Simplification + Bottom Nav Overlay Bug

Standalone addendum — feed to Antigravity alongside the existing codebase. Does not require re-reading the full PRD.

---

## 1. Bug: Bottom Navigation Bar Overlaps Page Content

**Confirmed via screenshot.** The mobile bottom tab bar (Home / Bookings / Payments / Roommates / Profile) is rendering as a fixed overlay on top of page content instead of being properly docked with content flowing above it. Result: content near the bottom of the viewport (e.g. a shortlist/compare strip on the homepage) is partially hidden underneath the nav bar.

**Fix:**
- The bottom nav bar's container should be `position: fixed` at the bottom with a defined height.
- The scrollable page content wrapper must have `padding-bottom` (or margin) equal to the nav bar's actual rendered height, so the last visible content in any scrollable page is never obscured by the fixed bar.
- Apply this padding-bottom rule globally wherever the bottom nav is present — not just the homepage — since this will affect every page with content near the fold.
- Verify fix by scrolling to the bottom of the homepage (where the shortlist/compare strip lives) and confirming it's fully visible above the nav bar, not clipped behind it.

**Note on the nav bar itself:** the 5-icon bottom tab pattern (Home/Bookings/Payments/Roommates/Profile) is fine as a mobile navigation pattern — no need to redesign it, this is purely a layout/z-index fix.

---

## 2. Hero Section — Simplify

**Remove:** the stat row showing "100% Verified Listings / GH₵0 Hidden Fees / 24/7 Support" (or equivalent three-stat block). Decision: not worth the visual clutter — a clean headline and CTA carries more weight without it.

**Remove:** the small 3-step explainer cards ("Explore Registered Hostels" / "Request a Live Visit" / "Book with Peace of Mind") currently overlapping the hero background image as a semi-transparent floating block. This creates visual noise competing with the headline. If this 3-step explainer is still wanted, it should live as its own clearly separated section further down the page (see PRD Section 5a's "How It Works" strip reference) — not layered on top of the hero photo.

**Add:** replace the current hero background treatment with a **real, high-quality photo** of student housing/hostel life (a well-lit dorm room, students socializing, or a clean hostel exterior) — matching the Student.com reference already chosen in PRD Section 5a. This should read as premium and inviting, not busy or dark-overlay-heavy like the current version.

**Resulting hero structure (simplified):**
1. Real background photo (full-bleed, subtle dark gradient overlay for text legibility only — not a heavy dark scrim)
2. Headline + one-line subtext
3. Single primary CTA
4. Search bar, integrated as part of the hero section (not a separately floating card awkwardly positioned between hero and listings)

---

*This is a standalone fix batch. Does not change data model, routes, or business logic — UI/layout only.*
