/**
 * Payout & Payment Account Schema and Utility Helpers
 * Supports hostel-specific scoping and global portfolio binding.
 */

export type ScopeType = "single_hostel" | "all_managed_hostels";

export interface PayoutAccount {
  id: string;
  managerId: string;
  managerEmail?: string;
  accountType: "bank" | "momo";
  bankName?: string;
  bankCode?: string;
  branch?: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary: boolean;
  isVerified: boolean;
  
  // Scope fields:
  scopeType: ScopeType;
  boundHostelIds: string[]; // Array of hostel IDs this account services

  // Backward compatibility fields with legacy bankAccounts collection
  type?: "bank" | "momo";
  accountName?: string;
  hostelId?: string;
  hostelName?: string;
  momoNetwork?: string;
  momoNumber?: string;
  momoName?: string;
  verificationToken?: string;
  verifiedViaPaystack?: boolean;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Checks whether an account is authorized to receive payments for a specific hostel.
 */
export function isAccountBoundToHostel(
  account: Partial<PayoutAccount>,
  targetHostelId: string
): boolean {
  if (!targetHostelId) return false;

  // Global scope applies to all hostels managed by this manager
  if (account.scopeType === "all_managed_hostels" || account.hostelId === "all") {
    return true;
  }

  // Scoped array check
  if (Array.isArray(account.boundHostelIds) && account.boundHostelIds.includes(targetHostelId)) {
    return true;
  }

  // Legacy single hostelId check
  if (account.hostelId === targetHostelId) {
    return true;
  }

  return false;
}

/**
 * Filters a list of accounts to only those authorized for a target hostel.
 */
export function filterAccountsForHostel(
  accounts: PayoutAccount[],
  targetHostelId: string,
  expectedManagerId?: string
): PayoutAccount[] {
  return accounts.filter((acc) => {
    // If managerId is specified, ensure strict ownership match
    if (expectedManagerId && acc.managerId && acc.managerId !== expectedManagerId) {
      return false;
    }

    return isAccountBoundToHostel(acc, targetHostelId);
  });
}
