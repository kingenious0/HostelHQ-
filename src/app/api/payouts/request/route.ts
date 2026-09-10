import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-guard";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { requestWithdrawal } from "@/app/actions/payouts";

const ALLOWED_PAYOUT_ROLES = [
  "manager",
  "hostel_manager",
  "property_manager",
  "admin",
  "superadmin"
];

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedUser(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    // Retrieve user document directly or verify decoded session token
    const userDoc = await getDoc(doc(db, "users", session.uid));
    const userRole = (userDoc.data()?.role || session.role || "").toLowerCase().trim();

    if (!ALLOWED_PAYOUT_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Only hostel managers or administrators can request payouts." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId = session.uid, amount, paymentDetails } = body;

    const result = await requestWithdrawal(userId, amount, paymentDetails);
    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Payout request failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Payout request API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
