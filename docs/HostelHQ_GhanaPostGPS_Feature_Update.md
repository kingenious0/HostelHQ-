# HostelHQ — Feature Update: GhanaPostGPS Location Integration

**This is NOT a full PRD.** It's a standalone addendum covering only what's new since PRD v2.4 (which has already been built). Feed this to Antigravity alongside the existing codebase — no need to re-read the full PRD.

**Context:** the location-capture method for hostel listings needs to change. What's currently built (from PRD v2.4) likely uses the Mapbox location picker/search as the primary way managers set a hostel's location. **That should now become a hidden fallback.** The new primary method is GhanaPostGPS digital address lookup, tested and confirmed working.

---

## 0. Scope Correction — This Form Isn't Admin-Only

**Important finding:** in the current codebase, hostel listing/registration (`admin/upload`) only exists under the admin role — there is no equivalent for hostel managers. That's backwards for how this product actually works: **managers register their own hostels** (which then go into an approval queue), not admins creating listings on their behalf. Admin's role is to *review and approve* registrations, not to be the only one who can create them.

**So this entire GPS-locator + live-map spec (Section 3 below) must be built once, as a shared/reusable component, and used in at least two places:**
1. **Manager-facing "Add/Edit Hostel" flow** — this is the primary, most-used path. Needs to live somewhere reachable from the manager dashboard (e.g. a "List Your Hostel" or "Add Property" action).
2. **Admin's existing `admin/upload` form** — kept for admin's own ability to create/edit listings directly if needed (e.g. seeding data, editing on a manager's behalf).

Do not build two separate implementations of the location-capture UI — extract it as one shared component (e.g. `<HostelLocationPicker />` or similar) used by both the manager form and the admin form, so the GhanaPostGPS integration, map preview, and fallback logic only need to be written and tested once.

---

## 1. What's changing

**Before (v2.4, already built):** Mapbox picker/search is the primary location-input method on the hostel listing/registration form.

**After (this update):** GhanaPostGPS digital address code becomes the primary input. The manager types/pastes a code (e.g. `AK-238-1489`), the system looks it up via a free API, and a live map preview instantly appears showing the real location — no manual pin-dropping needed in the common case. The Mapbox picker moves behind a "Set location manually" toggle, used only as a fallback.

---

## 2. The API (tested and confirmed working, Aug 29, 2026)

Two endpoints from the same free, unofficial service (SperixLabs' GhanaPostGPS REST API — no API key required, no cost):

### Primary: Digital address → coordinates
- **Endpoint:** `POST https://ghanapostgps.sperixlabs.org/get-location`
- **Body:** `{"address": "AK-238-1489"}` (Content-Type: application/json)
- **Real confirmed response** (tested against USTED's actual GPS address):
```json
{
  "data": { "Table": [{
    "Area": "", "AddressV1": "AKW6446263",
    "CenterLatitude": 6.696904951118171, "CenterLongitude": -1.681533768139603,
    "District": "Kwadaso", "Region": "Ashanti", "PostCode": "AKW644",
    "Street": "Sunyani Road"
  }] },
  "found": true
}
```
- **Use `CenterLatitude` / `CenterLongitude`** for the coordinates to store and map.
- Response time: ~1.5–2.3s observed. Show a loading state — don't block the UI thinking it's instant.
- **Not found:** `{"data": {"Table": null}, "found": false}` — handle explicitly, see Section 4 below.
- **`Street` can be `""` or `"[UNKNOWN]"`** for some areas — fall back to displaying Area/District/Region instead of a blank field.

### Secondary (fallback use only): Coordinates → digital address
- **Endpoint:** `POST https://ghanapostgps.sperixlabs.org/get-address`
- **Body:** `{"lat": "6.6500", "long": "-1.6487"}`
- Useful only if a manager drops a manual pin (via the Mapbox fallback) and you want to show them the resulting digital address for confirmation. Not the primary flow.
- **Field names differ from the primary endpoint** — this one returns `NLat`/`SLat`/`WLong`/`Elong`, not `CenterLatitude`/`CenterLongitude`. Don't reuse the same parsing logic for both.

**Important:** this is an unofficial, reverse-engineered API (not officially supported by Ghana Post). It's confirmed working right now, but build with graceful degradation — timeouts, retries, and a working fallback path — rather than assuming permanent uptime.

---

## 3. UI Spec — Hostel Listing/Registration Form

**Where:** this is a **shared component**, used in both:
- The manager-facing hostel listing/creation flow (new — needs to be built, likely accessible from the manager dashboard)
- The existing admin form (`src/app/admin/upload/page.tsx` in the current repo, or wherever the equivalent now lives after the v2.4 build)

Build the location section once as a reusable component; do not duplicate the logic across two forms.

**Interaction flow:**

1. **GPS digital address field is the primary, top-of-form input** — clearly labeled (e.g. "GhanaPostGPS Digital Address"), placeholder example `AK-238-1489`.
2. On blur (or a small "Locate" button next to the field — not on every keystroke), call `get-location` with the entered code.
3. **The instant a valid response returns, a live map preview loads directly below the field**, same page, centered on `CenterLatitude`/`CenterLongitude` with a pin at that point. This is the core UX goal: type code → map appears immediately with the real location shown, no separate step or page navigation.
4. Below/beside the map, show confirmation text: Area, District, Region, Street (with fallback handling if Street is empty/unknown) — so the manager can visually verify "yes, that's my hostel" before continuing.
5. **Loading state** while the API call is in flight (spinner/skeleton over the map area).
6. **Error/not-found state**: inline message under the field — "We couldn't find that address — check the code, or set your location manually below" — not a silent failure.
7. **"Set location manually" toggle** below the GPS field, collapsed by default, expands to reveal the existing Mapbox picker as a fallback. Visually secondary — the GPS flow is the star.
8. **Mobile:** map preview renders full-width below the field (not side-by-side), kept compact (~200–250px height) so the rest of the listing form stays reachable without excess scrolling.
9. **Submit is blocked** until valid coordinates exist on the form state — via GPS lookup or the manual fallback. No hostel record saves without resolved `lat`/`lng`.

### Overall Form Pacing — Multi-Step Wizard (Airbnb reference)

The listing/registration form as a whole should follow Airbnb's "Become a Host" pattern: **one focused step per screen, not one long single-page scroll.** This does not change what data is collected — same fields, same underlying data model — it's purely about how the form is paced and presented. Concretely:

- Break the existing form into logical steps (e.g. Property Type/Basics → **Location — GPS lookup + map, per Section 3 above** → Rooms/Capacity → Amenities → Photos → Review & Submit). Exact step grouping should follow whatever fields already exist in the current form — no new fields required.
- **Persistent progress indicator** at the top of every step (e.g. "Step 2 of 6") so managers — likely filling this out on mobile, possibly non-technical — always know how much is left.
- **The GPS/map location step gets its own dedicated screen**, not squeezed in among unrelated fields — this matches the emphasis already given to it in Section 3.
- Optional, low-effort addition: small contextual tips near relevant fields (e.g. a one-line hint on the photos step about including room photos, not just the building exterior) — mirrors Airbnb's inline guidance without requiring new backend work.
- This wizard pattern applies to **both** the manager-facing and admin-facing versions of the form, since they share the same underlying component per Section 0.

---

## 4. Data handling rules

1. **Always store both** the digital address (display) and the resolved `lat`/`lng` (routing/maps) on the `Hostel` record.
2. **Never allow a hostel to publish/go live without resolved coordinates** — enforced at form-submit time, not just at a later publish step.
3. Handle `found: false` explicitly with a clear, actionable error — never a silent or generic failure.

---

*This is an addendum to the existing HostelHQ build. It assumes PRD v2.4's features (agent removal, verification flow, visit requests, complaints, dashboards, UI restructure) are already implemented and does not repeat that scope. It does, however, correct a scope gap found during this update: hostel listing/registration must exist for managers, not just admin — see Section 0.*
