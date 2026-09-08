/**
 * Sanction & Accreditation Utilities
 * Enforces student-side runtime protections and status checks for properties
 * marked with Executive Sanction or Accreditation Revoked.
 */

export interface HostelSanctionFields {
  accreditationStatus?: string | null;
  sanctionStatus?: string | null;
  status?: string | null;
  sanctionReason?: string | null;
  [key: string]: any;
}

/**
 * Returns true if property accreditation has been revoked
 */
export function isHostelRevoked(hostel?: HostelSanctionFields | null): boolean {
  if (!hostel) return false;
  return (
    hostel.accreditationStatus === 'Accreditation Revoked' ||
    hostel.sanctionStatus === 'revoked' ||
    hostel.status === 'revoked'
  );
}

/**
 * Returns true if property is under formal Executive Sanction
 */
export function isHostelSanctioned(hostel?: HostelSanctionFields | null): boolean {
  if (!hostel) return false;
  return (
    hostel.accreditationStatus === 'Executive Sanction' ||
    hostel.accreditationStatus === 'sanctioned' ||
    hostel.sanctionStatus === 'sanctioned'
  );
}

/**
 * Returns true if property has any active restriction (Revoked or Executive Sanction)
 */
export function isHostelRestricted(hostel?: HostelSanctionFields | null): boolean {
  return isHostelRevoked(hostel) || isHostelSanctioned(hostel);
}

export const SANCTION_MESSAGES = {
  EXECUTIVE_SANCTION:
    "⚠️ Executive Notice: This property is currently under formal welfare and regulatory investigation by the Dean of Students. Bookings are temporarily paused.",
  ACCREDITATION_REVOKED:
    "🚫 Statutory Notice: University charter accreditation has been revoked for this property by executive authority. All student bookings and payment gateways are permanently disabled.",
  ACTION_DENIED:
    "Action Denied: This property is sanctioned and cannot accept student bookings.",
} as const;
