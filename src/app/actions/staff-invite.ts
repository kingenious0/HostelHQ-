"use server";

import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";

export type StaffRole = "dean" | "hostel_coordinator" | "pro_vc" | "vc" | "admin";

export interface StaffInvite {
  id: string;
  token: string;
  role: StaffRole;
  roleTitle: string;
  tempEmail: string;
  createdBy: string;
  createdByUid?: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string | null;
  usedBy?: string | null;
  registeredEmail?: string | null;
  registeredName?: string | null;
  revoked?: boolean;
  revokedAt?: string | null;
  revokedBy?: string | null;
}

export const STAFF_ROLE_TITLES: Record<StaffRole, string> = {
  dean: "Dean of Students",
  hostel_coordinator: "University Hostel Coordinator",
  pro_vc: "Pro-Vice-Chancellor",
  vc: "Vice-Chancellor",
  admin: "System Administrator",
};

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  dean: "Student welfare, complaints resolution, disciplinary oversight, and emergency welfare escalations.",
  hostel_coordinator: "Hostel facility vetting, compliance audits, property inspections, and accreditation approvals.",
  pro_vc: "Executive oversight of university student housing policies, quotas, safety protocols, and analytics.",
  vc: "Highest executive oversight of campus life, institutional partnerships, and university housing governance.",
  admin: "Full platform system administration, user roles provisioning, reviews moderation, and platform settings.",
};

const ALLOWED_STAFF_ROLES: StaffRole[] = ["dean", "hostel_coordinator", "pro_vc", "vc", "admin"];

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
    const { role, adminName = "System Administrator", adminUid, baseUrl } = params;

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
    await adminDb.collection("staff_invites").doc(token).set(inviteData);

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
    const docSnap = await adminDb.collection("staff_invites").doc(cleanToken).get();

    if (!docSnap.exists) {
      return {
        valid: false,
        error: "This staff invitation link does not exist or has expired. Please request a new invitation from university administration.",
      };
    }

    const data = docSnap.data() as StaffInvite;

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

    const inviteRef = adminDb.collection("staff_invites").doc(token.trim());
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return { success: false, error: "Invitation record not found." };
    }

    const inviteData = inviteSnap.data() as StaffInvite;

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

    // 1. Create/Update the user's Firestore profile with the TOKEN-LOCKED role
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set(
      {
        uid,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        phoneVerified: true,
        role: targetRole, // STRICTLY derived from the token; cannot be altered
        verificationStatus: "verified",
        createdAt: nowIso,
        registeredViaInvite: token.trim(),
        tempEmailPlaceholderReplaced: inviteData.tempEmail,
      },
      { merge: true }
    );

    // 2. Immediately burn the token (single-use enforcement)
    await inviteRef.update({
      used: true,
      usedAt: nowIso,
      usedBy: uid,
      registeredEmail: email.trim().toLowerCase(),
      registeredName: fullName.trim(),
    });

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
    if (!token) return { success: false, error: "Token required" };
    
    await adminDb.collection("staff_invites").doc(token.trim()).update({
      revoked: true,
      revokedAt: new Date().toISOString(),
      revokedBy: adminName,
    });

    return { success: true };
  } catch (error: any) {
    console.error("revokeStaffInviteAction error:", error);
    return { success: false, error: error.message || "Failed to revoke staff invite" };
  }
}

/**
 * Fetch all staff invites for the Admin Console User Management view.
 */
export async function fetchStaffInvitesAction(): Promise<{ success: boolean; data?: StaffInvite[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection("staff_invites")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const invites: StaffInvite[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<StaffInvite, "id">),
    }));

    return { success: true, data: invites };
  } catch (error: any) {
    console.error("fetchStaffInvitesAction error:", error);
    return { success: false, error: error.message || "Failed to fetch staff invites" };
  }
}
