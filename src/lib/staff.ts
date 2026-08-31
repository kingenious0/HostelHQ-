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

export const ALLOWED_STAFF_ROLES: StaffRole[] = ["dean", "hostel_coordinator", "pro_vc", "vc", "admin"];
