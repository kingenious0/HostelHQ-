# HostelHQ Engineering Directive: Preview-to-Production Deployment Workflow

## Objective
Establish a reliable branching and deployment pipeline ensuring all code, database, and architectural changes pass through an isolated preview environment before being promoted to live production, completely eliminating direct-to-production pushes.

---

## 1. Branching Nomenclature & Rules

| Branch Type | Naming Convention | Target / Purpose | Promotion Rule |
| :--- | :--- | :--- | :--- |
| **Production** | `main` | Production live environment (`hostelhq.com`) | Direct pushes **BLOCKED**. Only merged via approved Pull Request. |
| **Feature Branches** | `feature/<feature-name>` (e.g. `feature/payout-scoping`) | New feature implementations, UI enhancements | Deploys isolated **Green Preview URL** on Vercel. |
| **Bug Fix Branches** | `fix/<bug-description>` (e.g. `fix/payout-auth-guard`) | Urgent or scheduled patches | Deploys isolated **Green Preview URL** on Vercel. |
| **Refactor / Perf** | `refactor/<target>` or `perf/<target>` | Performance tuning or architectural cleanup | Deploys isolated **Green Preview URL** on Vercel. |

### Branch Protection Configuration
* **Require Pull Request reviews:** At least 1 peer approval before merging into `main`.
* **Require Status Checks to Pass:** Type check (`npx tsc --noEmit`) and linter must succeed.
* **Require Linear History / Squash Merge:** Keeps git history clean and audit-friendly.

---

## 2. Deployment Pipeline Stages

### Stage 1: Preview Build (The "Green" Environment)
1. **Trigger:** Push any branch matching `feature/*`, `fix/*`, `refactor/*`, or open a Pull Request.
2. **Environment Isolation:**
   - Vercel automatically assigns a dedicated, immutable preview domain (e.g. `https://hostel-hq-git-feature-payout-scoping-xyz.vercel.app`).
   - Uses staging Firebase project credentials or isolated environment configurations.
3. **Verification Checklist:**
   - Test manager account binding under `/manager/bank-accounts`.
   - Test student visibility restrictions under `/hostels/[id]/pay`.
   - Test unauthorized deposit receipts to verify the strict `403 Forbidden` guard.
   - Verify Google SSO "Coming Soon" notification behavior on `/login` and `/signup`.

### Stage 2: Production Promotion (The "Blue" Environment)
1. **Trigger:** PR merge to `main`.
2. **Zero-Downtime Atomic Deployment:**
   - Vercel builds the production bundle and switches DNS traffic atomically.
   - If health checks fail, rollback is instant (1-click rollback to prior deployment hash).

---

## 3. Database & Schema Backward Compatibility Rules

When deploying structural database updates (e.g. scoping payment accounts per hostel or updating room inventory models), all engineering changes must adhere to the **Expand-and-Contract Migration Pattern**:

### A. Dual Write / Backward-Compatible Read
* **Write:** When saving or updating records, write both new fields (`scopeType`, `boundHostelIds`, `payout_accounts`) and legacy fallback fields (`hostelId: 'all'`, `bankAccounts`).
* **Read:** Application code must support legacy structures if new fields are not yet populated:
  ```typescript
  // Backward-compatible scope evaluation
  const isGlobal = account.scopeType === "all_managed_hostels" || account.hostelId === "all" || !account.hostelId;
  const isBound = isGlobal || (account.boundHostelIds && account.boundHostelIds.includes(targetHostelId)) || account.hostelId === targetHostelId;
  ```

### B. Safe Rollback Guarantee
* If a production build is rolled back to a previous version, existing documents containing the new `scopeType` or `boundHostelIds` fields will continue to parse correctly because legacy code ignores unknown fields or relies on standard schema tolerance.
* Structural database changes must never introduce breaking column/field deletions until all active deployments have migrated to the new schema.
