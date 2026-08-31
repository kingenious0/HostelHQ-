"use server";

import crypto from "crypto";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import {
  type StaffRole,
  type StaffInvite,
  STAFF_ROLE_TITLES,
  STAFF_ROLE_DESCRIPTIONS,
  ALLOWED_STAFF_ROLES,
} from "@/lib/staff";

import { requireRole } from "@/lib/auth-guard";

/**
 * Generate a new role-locked, time-limited (24 hours) staff invitation link.
 * Initiated strictly by an authenticated administrator.
 * Does NOT require an invitee email upfront; uses an internal tempEmail label.
 */
export async function createStaffInviteAction(params: {
  role: StaffRole;
  adminName?: string;
  adminUid?: string;
  baseUrl?: string;
}) {
  try {
    const admin = await requireRole(['admin']);
    const { role, baseUrl } = params;
    const adminName = admin.fullName || "System Administrator";
    const adminUid = admin.uid;

    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      return { success: false, error: `Invalid role selected: ${role}` };
    }

    // 1. Generate unique, unguessable cryptographic token
    const token = crypto.randomBytes(24).toString("hex");
    const suffix = token.slice(0, 6);
    
    // 2. Generate unique placeholder temp email for internal tracking
    const roleSlug = role.replace(/_/g, "-");
    const tempEmail = `${roleSlug}-${suffix}@hostelhq.temp`;

    const now = new Date();
    const createdAt = now.toISOString();
    // Valid strictly for 24 hours from creation
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const inviteData: Omit<StaffInvite, "id"> = {
      token,
      role,
      roleTitle: STAFF_ROLE_TITLES[role],
      tempEmail,
      createdBy: adminName,
      createdByUid: adminUid || "",
      createdAt,
      expiresAt,
      used: false,
      usedAt: null,
      usedBy: null,
      registeredEmail: null,
      registeredName: null,
      revoked: false,
      revokedAt: null,
      revokedBy: null,
    };

    // Store in Firestore 'staff_invites' collection using token as document ID
    let saved = false;
    if (isFirebaseAdminConfigured()) {
      try {
        await adminDb.collection("staff_invites").doc(token).set(inviteData);
        saved = true;
      } catch (adminErr) {
        console.warn("adminDb createStaffInvite failed, falling back to client db:", adminErr);
      }
    }

    if (!saved) {
      await setDoc(doc(db, "staff_invites", token), inviteData);
    }

    // Build the invite link (relative path by default or absolute if baseUrl provided)
    const invitePath = `/staff-access/${token}`;
    const fullInviteUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}${invitePath}` : invitePath;

    return {
      success: true,
      data: {
        id: token,
        ...inviteData,
        inviteUrl: fullInviteUrl,
        invitePath,
      },
    };
  } catch (error: any) {
    console.error("createStaffInviteAction error:", error);
    return { success: false, error: error.message || "Failed to create staff invite" };
  }
}

/**
 * Server-side validation of an invitation token.
 * Verifies existence, expiration (24h), un-used status, and non-revocation.
 */
export async function validateStaffInviteAction(token: string) {
  try {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { valid: false, error: "Invalid invitation link." };
    }

    const cleanToken = token.trim();
    let data: StaffInvite | null = null;

    if (isFirebaseAdminConfigured()) {
      try {
        const docSnap = await adminDb.collection("staff_invites").doc(cleanToken).get();
        if (docSnap.exists) {
          data = docSnap.data() as StaffInvite;
        }
      } catch (adminErr) {
        console.warn("adminDb validateStaffInvite failed, falling back to client db:", adminErr);
      }
    }

    if (!data) {
      const snap = await getDoc(doc(db, "staff_invites", cleanToken));
      if (snap.exists()) {
        data = snap.data() as StaffInvite;
      }
    }

    if (!data) {
      return {
        valid: false,
        error: "This staff invitation link does not exist or has expired. Please request a new invitation from university administration.",
      };
    }

    if (data.revoked) {
      return {
        valid: false,
        error: "This invitation link was revoked by a system administrator.",
        revokedAt: data.revokedAt,
      };
    }

    if (data.used) {
      return {
        valid: false,
        error: "This invitation link has already been used to create an account. Tokens are single-use only.",
        usedAt: data.usedAt,
      };
    }

    const now = Date.now();
    const expiresTimestamp = new Date(data.expiresAt).getTime();
    if (now >= expiresTimestamp) {
      return {
        valid: false,
        error: "This invitation link has expired (invitations are strictly valid for 24 hours). Please contact administration for a renewed link.",
        expired: true,
      };
    }

    // Token is valid and ready
    return {
      valid: true,
      role: data.role,
      roleTitle: data.roleTitle || STAFF_ROLE_TITLES[data.role],
      roleDescription: STAFF_ROLE_DESCRIPTIONS[data.role] || "",
      tempEmail: data.tempEmail,
      expiresAt: data.expiresAt,
    };
  } catch (error: any) {
    console.error("validateStaffInviteAction error:", error);
    return { valid: false, error: error.message || "Server error while validating invitation token." };
  }
}

/**
 * Completes staff onboarding by binding the user's real credentials to the token's locked role
 * and burning the single-use token immediately.
 */
export async function completeStaffRegistrationAction(params: {
  token: string;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
}) {
  try {
    const { token, uid, email, fullName, phone } = params;

    if (!token || !uid || !email || !fullName) {
      return { success: false, error: "Missing required registration parameters." };
    }

    const cleanToken = token.trim();
    let inviteData: StaffInvite | null = null;

    if (isFirebaseAdminConfigured()) {
      try {
        const inviteSnap = await adminDb.collection("staff_invites").doc(cleanToken).get();
        if (inviteSnap.exists) {
          inviteData = inviteSnap.data() as StaffInvite;
        }
      } catch (adminErr) {
        console.warn("adminDb completeStaffRegistration get failed, falling back to client db:", adminErr);
      }
    }

    if (!inviteData) {
      const snap = await getDoc(doc(db, "staff_invites", cleanToken));
      if (snap.exists()) {
        inviteData = snap.data() as StaffInvite;
      }
    }

    if (!inviteData) {
      return { success: false, error: "Invitation record not found." };
    }

    if (inviteData.used) {
      return { success: false, error: "This invitation link has already been consumed." };
    }

    if (inviteData.revoked) {
      return { success: false, error: "This invitation link has been revoked." };
    }

    if (Date.now() >= new Date(inviteData.expiresAt).getTime()) {
      return { success: false, error: "This invitation link has expired." };
    }

    const targetRole = inviteData.role;
    const nowIso = new Date().toISOString();

    const userProfileUpdates = {
      uid,
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      phoneNumber: phone.trim(),
      phoneVerified: true,
      role: targetRole,
      verificationStatus: "verified",
      createdAt: nowIso,
      registeredViaInvite: cleanToken,
      tempEmailPlaceholderReplaced: inviteData.tempEmail,
    };

    const tokenBurnUpdates = {
      used: true,
      usedAt: nowIso,
      usedBy: uid,
      registeredEmail: email.trim().toLowerCase(),
      registeredName: fullName.trim(),
    };

    let adminSaved = false;
    if (isFirebaseAdminConfigured()) {
      try {
        await adminDb.collection("users").doc(uid).set(userProfileUpdates, { merge: true });
        await adminDb.collection("staff_invites").doc(cleanToken).update(tokenBurnUpdates);
        adminSaved = true;
      } catch (adminErr) {
        console.warn("adminDb completeStaffRegistration write failed, falling back to client db:", adminErr);
      }
    }

    if (!adminSaved) {
      await setDoc(doc(db, "users", uid), userProfileUpdates, { merge: true });
      await updateDoc(doc(db, "staff_invites", cleanToken), tokenBurnUpdates);
    }

    return {
      success: true,
      role: targetRole,
      roleTitle: STAFF_ROLE_TITLES[targetRole],
    };
  } catch (error: any) {
    console.error("completeStaffRegistrationAction error:", error);
    return { success: false, error: error.message || "Failed to complete staff registration." };
  }
}

/**
 * Revoke an active staff invitation link.
 */
export async function revokeStaffInviteAction(token: string, adminName: string = "System Administrator") {
  try {
    const admin = await requireRole(['admin']);
    if (!token) return { success: false, error: "Token required" };
    const cleanToken = token.trim();
    const effectiveAdminName = admin.fullName || adminName;
    const updates = {
      revoked: true,
      revokedAt: new Date().toISOString(),
      revokedBy: effectiveAdminName,
    };

    let adminSaved = false;
    if (isFirebaseAdminConfigured()) {
      try {
        await adminDb.collection("staff_invites").doc(cleanToken).update(updates);
        adminSaved = true;
      } catch (adminErr) {
        console.warn("adminDb revokeStaffInvite failed, falling back to client db:", adminErr);
      }
    }

    if (!adminSaved) {
      await updateDoc(doc(db, "staff_invites", cleanToken), updates);
    }

    return { success: true };
  } catch (error: any) {
    console.error("revokeStaffInviteAction error:", error);
    return { success: false, error: error.message || "Failed to revoke staff invite" };
  }
}

/**
 * Fetch all staff invites for the Admin Console User Management view.
 */
export async function fetchStaffInvitesAction(): Promise<{ success: boolean; data: StaffInvite[]; error?: string }> {
  try {
    await requireRole(['admin']);
    let invites: StaffInvite[] = [];

    if (isFirebaseAdminConfigured()) {
      try {
        const snap = await adminDb
          .collection("staff_invites")
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();

        invites = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffInvite, "id">),
        }));
      } catch (adminErr) {
        console.warn("adminDb fetchStaffInvitesAction failed, falling back to client db:", adminErr);
      }
    }

    if (invites.length === 0) {
      try {
        const snap = await getDocs(
          query(collection(db, "staff_invites"), orderBy("createdAt", "desc"), limit(100))
        );
        invites = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffInvite, "id">),
        }));
      } catch (clientErr) {
        console.warn("client db fetchStaffInvites error:", clientErr);
      }
    }

    return { success: true, data: invites };
  } catch (error: any) {
    console.error("fetchStaffInvitesAction error:", error);
    return { success: true, data: [], error: error.message || "Failed to fetch staff invites" };
  }
}

