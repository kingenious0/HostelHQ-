import { cookies, headers } from 'next/headers';
import { adminAuth, isFirebaseAdminConfigured, adminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: string;
  fullName?: string;
  displayName?: string;
  phoneNumber?: string;
  phone?: string;
}

/**
 * Extracts and verifies the authenticated user from the current request context.
 * Inspects both the `__session` cookie and `Authorization: Bearer <token>` header.
 */
export async function getAuthenticatedUser(req?: Request): Promise<AuthenticatedUser | null> {
  try {
    let token: string | undefined;

    // 1. Try extracting Bearer token from request headers
    if (req) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }

      // Check request cookie
      if (!token) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.match(/__session=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

    // 2. Next.js Server Action / Route Handler context via next/headers
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get('__session')?.value;
      } catch {
        // cookies() might fail if called outside request context
      }
    }

    if (!token) {
      try {
        const headerStore = await headers();
        const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }
      } catch {
        // headers() might fail if called outside request context
      }
    }

    if (!token) {
      return null;
    }

    let uid: string | null = null;
    let email: string | undefined;

    // 3. Verify token with Firebase Admin
    if (isFirebaseAdminConfigured()) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        email = decoded.email;
      } catch (adminErr) {
        console.warn('Firebase Admin verifyIdToken error, attempting fallback verification:', adminErr);
      }
    }

    // 4. Fallback verification via Google API if Admin credentials unavailable or threw
    if (!uid) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (apiKey) {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
          const data = await resp.json();
          if (resp.ok && data.users && data.users.length > 0) {
            uid = data.users[0].localId;
            email = data.users[0].email;
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback token verification failed:', fallbackErr);
      }
    }

    if (!uid) {
      return null;
    }

    // 5. Look up user profile & role from Firestore
    let role = 'student';
    let fullName: string | undefined;
    let phoneNumber: string | undefined;

    if (isFirebaseAdminConfigured()) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          role = uData.role || 'student';
          fullName = uData.fullName || uData.name;
          phoneNumber = uData.phoneNumber || uData.phone;
          if (!email && uData.email) email = uData.email;
        }
      } catch (fsErr) {
        console.warn('AdminDb user profile lookup note:', fsErr);
      }
    } else {
      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data() || {};
          role = uData.role || 'student';
          fullName = uData.fullName || uData.name;
          phoneNumber = uData.phoneNumber || uData.phone;
          if (!email && uData.email) email = uData.email;
        }
      } catch (fsErr) {
        console.warn('Client Db user profile lookup note:', fsErr);
      }
    }

    return {
      uid,
      email,
      role,
      fullName,
      displayName: fullName,
      phoneNumber,
      phone: phoneNumber,
    };
  } catch (error) {
    console.error('getAuthenticatedUser error:', error);
    return null;
  }
}

/**
 * Authorized roles permitted to perform institutional accreditation reviews,
 * provisional passes, approvals, and rejections.
 */
export const ACCREDITATION_AUTHORIZED_ROLES = [
  "admin",
  "superadmin",
  "hostel_coordinator",
  "coordinator",
  "dean"
];

/**
 * Normalizes system role strings to standard canonical form.
 */
export function normalizeRole(role?: string): string {
  if (!role) return "student";
  const r = role.toLowerCase().trim();
  if (r === "hostel_coordinator" || r === "coordinator") return "coordinator";
  if (r === "superadmin" || r === "admin") return "admin";
  if (r === "hostel_manager" || r === "manager") return "manager";
  return r;
}

/**
 * Checks if a user or role has accreditation permissions.
 */
export function canAccreditHostel(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole.role;
  if (!role) return false;
  return ACCREDITATION_AUTHORIZED_ROLES.includes(role.toLowerCase().trim());
}

/**
 * Enforces that the caller must be authenticated.
 * Throws an Error with code 401 if unauthenticated.
 */
export async function requireAuth(req?: Request): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }
  return user;
}

/**
 * Enforces that the caller must be authenticated with one of the allowed roles.
 * Supports role aliases ('coordinator' <-> 'hostel_coordinator', 'admin' <-> 'superadmin', 'manager' <-> 'hostel_manager').
 * Throws an Error if unauthenticated (401) or forbidden (403).
 */
export async function requireRole(allowedRoles: string[], req?: Request): Promise<AuthenticatedUser> {
  const user = await requireAuth(req);
  
  // Expand allowedRoles to include recognized aliases/variants
  const expandedAllowed = new Set<string>();
  for (const r of allowedRoles) {
    const lower = r.toLowerCase().trim();
    expandedAllowed.add(lower);
    if (lower === "coordinator" || lower === "hostel_coordinator") {
      expandedAllowed.add("coordinator");
      expandedAllowed.add("hostel_coordinator");
    }
    if (lower === "admin" || lower === "superadmin") {
      expandedAllowed.add("admin");
      expandedAllowed.add("superadmin");
    }
    if (lower === "manager" || lower === "hostel_manager") {
      expandedAllowed.add("manager");
      expandedAllowed.add("hostel_manager");
    }
  }

  const userRoleLower = (user.role || "").toLowerCase().trim();
  if (!expandedAllowed.has(userRoleLower)) {
    throw new Error(`Forbidden: Role '${user.role}' does not have permission for this operation`);
  }
  return user;
}
