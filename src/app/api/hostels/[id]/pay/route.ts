import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { isAccountBoundToHostel } from "@/lib/payout-accounts";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/hostels/[id]/pay
 * Fetches verified payout accounts strictly scoped to this hostel or global to the manager.
 */
export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(props.params);
    const hostelId = resolvedParams?.id;

    if (!hostelId) {
      return NextResponse.json(
        { error: "Hostel ID is required." },
        { status: 400 }
      );
    }

    // 1. Fetch hostel details to retrieve managerId
    const hostelRef = doc(db, "hostels", hostelId);
    const hostelSnap = await getDoc(hostelRef);

    if (!hostelSnap.exists()) {
      return NextResponse.json(
        { error: "Hostel not found." },
        { status: 404 }
      );
    }

    const hostelData = hostelSnap.data();
    const managerId = hostelData.managerId;

    if (!managerId) {
      return NextResponse.json(
        { error: "No manager assigned to this hostel." },
        { status: 404 }
      );
    }

    // 2. Query payout accounts for this manager
    // Check payout_accounts first, fallback to bankAccounts
    let rawAccounts: any[] = [];
    try {
      const payoutQuery = query(
        collection(db, "payout_accounts"),
        where("managerId", "==", managerId)
      );
      const snap = await getDocs(payoutQuery);
      if (!snap.empty) {
        rawAccounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Could not query payout_accounts, checking bankAccounts:", err);
    }

    if (rawAccounts.length === 0) {
      const bankQuery = query(
        collection(db, "bankAccounts"),
        where("managerId", "==", managerId)
      );
      const snap = await getDocs(bankQuery);
      rawAccounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // 3. Filter accounts strictly scoped to this hostel or with global scope
    const validAccounts = rawAccounts
      .filter((acc) => {
        if (acc.isActive === false || acc.status === "inactive") return false;
        return isAccountBoundToHostel(acc, hostelId);
      })
      .map((acc) => ({
        id: acc.id,
        managerId: acc.managerId,
        accountType: acc.accountType || acc.type || (acc.momoNumber ? "momo" : "bank"),
        bankName: acc.bankName || (acc.momoNetwork ? `${acc.momoNetwork} Mobile Money` : "Bank Account"),
        bankCode: acc.bankCode || "",
        branch: acc.branch || "",
        accountNumber: String(acc.accountNumber || acc.momoNumber || ""),
        accountHolderName: acc.accountHolderName || acc.accountName || acc.momoName || "Hostel Official Account",
        momoNetwork: acc.momoNetwork || "",
        isPrimary: !!acc.isPrimary,
        isVerified: !!(acc.isVerified || acc.verifiedViaPaystack),
        scopeType: acc.scopeType || (acc.hostelId === "all" ? "all_managed_hostels" : "single_hostel"),
        boundHostelIds: acc.boundHostelIds || (acc.hostelId ? [acc.hostelId] : []),
      }));

    return NextResponse.json({
      success: true,
      hostelId,
      hostelName: hostelData.name || "Hostel Property",
      managerId,
      accounts: validAccounts,
    });
  } catch (error: any) {
    console.error("GET /api/hostels/[id]/pay error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load hostel payment accounts." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hostels/[id]/pay
 * Submits a manual payment receipt with strict authorization enforcement.
 */
export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(props.params);
    const targetHostelId = resolvedParams?.id;

    if (!targetHostelId) {
      return NextResponse.json(
        { error: "Hostel ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      accountId,
      amount,
      transactionReference,
      studentName,
      studentPhone,
      studentEmail,
      studentIndexNumber,
      roomNumber,
      roomTier,
      receiptUrl,
      notes,
    } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Payment account ID is required." },
        { status: 400 }
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid payment amount is required." },
        { status: 400 }
      );
    }

    // 1. Verify Hostel Exists
    const hostelRef = doc(db, "hostels", targetHostelId);
    const hostelSnap = await getDoc(hostelRef);

    if (!hostelSnap.exists()) {
      return NextResponse.json(
        { error: "Hostel not found." },
        { status: 404 }
      );
    }

    const hostelData = hostelSnap.data();

    // 2. Fetch Selected Payment Account
    let accountData: any = null;

    // Check payout_accounts
    try {
      const payoutDoc = await getDoc(doc(db, "payout_accounts", accountId));
      if (payoutDoc.exists()) {
        accountData = { id: payoutDoc.id, ...payoutDoc.data() };
      }
    } catch {
      // Ignore
    }

    // Fallback to bankAccounts
    if (!accountData) {
      const bankDoc = await getDoc(doc(db, "bankAccounts", accountId));
      if (bankDoc.exists()) {
        accountData = { id: bankDoc.id, ...bankDoc.data() };
      }
    }

    if (!accountData) {
      return NextResponse.json(
        { error: "Payment account not found." },
        { status: 404 }
      );
    }

    // 3. Strict Authorization Enforcement
    // Check if account belongs to this hostel manager and is bound to this hostel
    if (accountData.managerId && hostelData.managerId && accountData.managerId !== hostelData.managerId) {
      return NextResponse.json(
        {
          error: "Unauthorized: This payment account belongs to a different hostel manager.",
          code: "MANAGER_MISMATCH",
        },
        { status: 403 }
      );
    }

    const isBound = isAccountBoundToHostel(accountData, targetHostelId);
    if (!isBound) {
      return NextResponse.json(
        {
          error: "Unauthorized: This payment account is not linked to the selected hostel.",
          code: "ACCOUNT_UNBOUND",
        },
        { status: 403 }
      );
    }

    // 4. Save Payment Receipt
    const receiptRecord = {
      hostelId: targetHostelId,
      hostelName: hostelData.name || "Hostel",
      managerId: hostelData.managerId || accountData.managerId,
      accountId: accountData.id,
      accountHolderName: accountData.accountHolderName || accountData.accountName || accountData.momoName || "Official Account",
      accountNumber: String(accountData.accountNumber || accountData.momoNumber || ""),
      bankName: accountData.bankName || (accountData.momoNetwork ? `${accountData.momoNetwork} MoMo` : "Bank Account"),
      accountType: accountData.accountType || accountData.type || "momo",
      amount: Number(amount),
      currency: "GHS",
      transactionReference: transactionReference?.trim() || `DEP-${Date.now()}`,
      studentName: studentName?.trim() || "Student",
      studentPhone: studentPhone?.trim() || "",
      studentEmail: studentEmail?.trim() || "",
      studentIndexNumber: studentIndexNumber?.trim() || "",
      roomNumber: roomNumber || "",
      roomTier: roomTier || "",
      receiptUrl: receiptUrl || null,
      notes: notes?.trim() || "",
      status: "pending_verification",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const depositRef = await addDoc(collection(db, "manual_deposits"), receiptRecord);

    return NextResponse.json({
      success: true,
      message: "Payment receipt submitted successfully and is awaiting manager verification.",
      receiptId: depositRef.id,
      data: {
        id: depositRef.id,
        ...receiptRecord,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/hostels/[id]/pay error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit payment receipt." },
      { status: 500 }
    );
  }
}
