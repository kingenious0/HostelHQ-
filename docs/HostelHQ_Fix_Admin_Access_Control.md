# HostelHQ — Fix: Administrative Role Access Control (Security Hardening)

Standalone fix. Feed to Antigravity alongside the codebase. **This addresses a real security gap, not just a UX improvement — treat as high priority.**

## The problem (current state, per Antigravity's own report)

1. **"Method B" — email-pattern role detection is a critical security hole.** Any email containing the substring `admin`, `dean`, `coord`, `vc`, or `exec` currently grants that administrative role automatically. This means anyone can self-sign-up with an email like `mydean123@gmail.com` and gain access to student verification documents, complaint records, and other sensitive data. **This must be removed entirely — not restricted, not hidden, deleted from the codebase.**
2. **"Method A" — manual Firestore role editing** is not a safe or realistic way for non-technical university staff (Dean's office, VC's office) to get access, and shouldn't be the standard provisioning path even for internal testing once real users are involved.
3. **Client-side role checks aren't sufficient on their own.** If dashboard access is only gated by a frontend redirect based on a role read from the client, someone could potentially reach `/dean/dashboard` etc. directly and see data before any check runs, or if the check has a bug. Role verification must also happen server-side.

## The fix — admin-generated, role-locked, time-limited invite link

### Flow

1. **Only an authenticated Admin can initiate this**, from the Admin Console → User Management.
2. Admin selects the role to create (`dean`, `hostel_coordinator`, `pro_vc`, `vc`, or another `admin`) — **that's it, no email entry required from the admin.**
3. System automatically generates:
   - A **unique, single-use invite token** tied to that specific role, valid for **24 hours** from creation.
   - A **placeholder "temp email"** for internal record-keeping only (e.g. `pro-vc-x7k2m9@hostelhq.temp`) — must include a unique suffix (a slice of the token or a short random string), not just the role name alone, so regenerating an invite for the same role later doesn't collide with a previous placeholder. This temp email is never shown to the invitee, never used as a real credential, and is purely a label so the admin's pending-invites list is readable (e.g. "Pro-VC invite — pending, expires in 18h") before a real person exists in the system.
4. System produces a **link containing that token** (e.g. `/staff-access/xxxxxxx`). Admin copies this link and sends it to the invitee however they choose (WhatsApp, email, in person — the delivery channel is the admin's choice, not a system-automated notification).
5. **The signup page this link leads to is hidden/dedicated — not linked from anywhere in normal navigation, not discoverable by browsing the site.** It only exists at that unguessable tokenized URL. There is no visible list of administrative roles anywhere on this page or any public-facing page.
6. **The role is never shown as a choice to the invitee.** The token itself already encodes which role it's for — when they land on the page, the system reads the token, confirms it's valid and unexpired, and silently knows "this is a Dean signup" (or whichever role) without ever displaying a role selector.
7. On that page, the invitee enters their **real email, phone number, and password** to complete account creation — this becomes their actual login credential going forward. The placeholder temp email from step 3 is discarded/replaced at this point; it was only ever an internal label on the pending invite, never a real account. Their role is set automatically from the token — not chosen by them, not visible to them as a field.
8. Once used, the token is immediately invalidated (single-use) — the same link cannot create a second account.
9. **Login stays exactly as it already is** — one login page, system reads the authenticated user's role and redirects to the correct dashboard.

### Important: the hidden page is for account creation only, never for ongoing login

The tokenized `/staff-access/xxxxxxx` page is a **one-time onboarding door** — it exists only to create the account, and becomes useless the moment that's done (token is single-use and expires in 24h regardless). It is never how the person logs in again afterward.

**After account creation, the person uses the normal, existing `/login` page — the same one students and managers already use** — with the real email and password they set during signup. The system reads their stored role and redirects them to the correct dashboard, exactly as it already does today. There is no need for them to ever find or revisit the hidden signup page again, and no separate "hidden login page" needs to be built — only the signup step was ever meant to be hidden.

### Server-side enforcement (still required, unchanged from before)

- Token validation (existence, correct role, not expired, not already used) must happen **server-side**, not just checked in the frontend before rendering the form.
- Role checks for every administrative dashboard/route must be enforced server-side (Firestore security rules and/or backend function checks), independent of frontend redirects — a `student` account should never be able to read Dean-level data even if they somehow reach `/dean/dashboard` directly by URL.

### Explicitly remove

- All email-substring-based role detection (`admin`, `dean`, `coord`, `vc`, `exec` pattern matching) — delete this logic entirely, it should not exist anywhere in the codebase, including behind any "dev mode" flag.
- Any visible role selector on any public or general signup page — administrative role signup only ever happens through the hidden, tokenized link described above.

---

*This is a security-critical fix — prioritize accordingly. Confirm removal of Method B with the same kind of full-codebase verification search used for the agent-removal task (search for the role-detection logic and confirm zero remaining matches).*
