# Brand Management Workflow

This document outlines how we can evolve the static partner strip into an admin-managed feature with Cloudinary-backed uploads.

## Data model

- `BrandPartner`: `{ id: string; name: string; logoUrl: string; published: boolean; createdAt: Date; updatedAt: Date }`
- Store in existing database (e.g., Postgres via Prisma) or a lightweight Firestore/Planetscale table.

## API surface

1. `POST /api/brand-partners`
   - Auth: restrict to admin session/JWT or Clerk role.
   - Payload: `{ name: string; file: FormData }`.
   - Flow:
     1. Validate `name`, ensure unique.
     2. Upload image to Cloudinary via server action/API route.
     3. Persist record with Cloudinary secure URL + public ID.
2. `GET /api/brand-partners`
   - Returns published partners, ordered by priority.
3. `PATCH /api/brand-partners/:id`
   - Update name, toggle publish status, or replace logo (delete old Cloudinary asset when replaced).

## Admin UI sketch

- Add `/admin/brands` route.
- Components:
  - Table listing partners (`name`, preview, status, last updated).
  - “Add brand” dialog with:
    - Text input for `name`.
    - File picker that previews the chosen image.
    - Submit button wired to the POST endpoint, showing upload progress.
  - Row actions: edit (rename), replace logo, toggle publish, delete.
- Use the existing design system (`Button`, `Input`, `Dialog`) for consistent styling.

## Upload flow

1. Admin clicks “Add brand”.
2. Client creates `FormData` with `file` and `name` and calls `/api/brand-partners`.
3. API uploads to Cloudinary using the official SDK (`cloudinary.uploader.upload_stream`), stores the resulting `secure_url`.
4. Frontend invalidates SWR/React Query cache or revalidates the relevant Next.js segment to reflect the new brand immediately.

## Frontend consumption

- Replace the current static `brandPartners` array with data fetched from `GET /api/brand-partners`.
- Provide a graceful fallback: if API fails, default to the static three-brand list so the UI never looks empty.
- Logos continue to live in the `/public/brands` folder for local development and as placeholders during CMS/API outages.

## Operational considerations

- Configure Cloudinary presets to enforce max dimensions (e.g., 320×120) and optimize to WEBP/PNG.
- Log every admin action (audit trail) to detect unauthorized edits.
- Use incremental static regeneration or route segment revalidation after mutations to keep the marketing page up to date without redeploys.

