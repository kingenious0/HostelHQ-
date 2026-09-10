import { NextRequest, NextResponse } from "next/server";
import { getPaystackKeys, verifyPaystackToken } from "@/lib/paystack-utils";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      accountId,
      managerId,
      managerEmail,
      type = "momo",
      bankName,
      bankCode,
      accountNumber,
      accountName,
      momoNetwork,
      momoNumber,
      momoName,
      hostelId = "all",
      hostelName = "All Managed Hostels",
      branch,
      isPrimary = false,
      verificationToken,
    } = body;

    if (!managerId) {
      return NextResponse.json(
        { status: false, error: "Authentication required: managerId is missing." },
        { status: 401 }
      );
    }

    const isBank = type === "bank";
    const targetNumber = (isBank ? accountNumber : momoNumber)?.trim();
    const targetBankCode = (isBank ? bankCode : (momoNetwork || bankCode))?.trim();
    const targetName = (isBank ? accountName : (momoName || accountName))?.trim();

    if (!targetNumber || !targetName || !targetBankCode) {
      return NextResponse.json(
        { status: false, error: "Incomplete account details provided." },
        { status: 400 }
      );
    }

    // Backend Validation Check: Reject any payload without a verified status token
    if (!verificationToken) {
      return NextResponse.json(
        {
          status: false,
          error:
            "Verification required: This account has not been verified via Paystack Banking Engine.",
        },
        { status: 400 }
      );
    }

    const { secretKey } = await getPaystackKeys();

    // Verify cryptographic token against Paystack secret
    const isTokenValid = verifyPaystackToken(
      targetNumber,
      targetBankCode,
      targetName,
      verificationToken,
      secretKey
    );

    if (!isTokenValid) {
      console.warn(
        `[Payout Bypass Prevention] Invalid or tampered verification token for ${targetNumber} (${targetName})`
      );
      return NextResponse.json(
        {
          status: false,
          error:
            "Security validation failed: The account name does not match Paystack's official resolution record or was tampered with.",
        },
        { status: 403 }
      );
    }

    // Handle primary account demotion for siblings if isPrimary is set
    if (isPrimary) {
      try {
        const q = query(
          collection(db, "bankAccounts"),
          where("managerId", "==", managerId),
          where("isPrimary", "==", true)
        );
        const snap = await getDocs(q);
        for (const siblingDoc of snap.docs) {
          if (siblingDoc.id !== accountId) {
            await updateDoc(siblingDoc.ref, {
              isPrimary: false,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.warn("Could not demote existing primary accounts:", err);
      }
    }

    const accountData: any = {
      managerId,
      managerEmail: managerEmail || "",
      type,
      bankName: bankName || (isBank ? "Bank Account" : `${momoNetwork} Mobile Money`),
      bankCode: targetBankCode,
      accountNumber: targetNumber,
      accountName: targetName,
      isPrimary: !!isPrimary,
      isVerified: true,
      verifiedViaPaystack: true,
      verificationToken,
      verificationTimestamp: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      status: "active",
      hostelId: hostelId || "all",
      hostelName: hostelName || "All Managed Hostels",
    };

    if (isBank) {
      accountData.branch = branch ? branch.trim() : "";
      accountData.momoNetwork = null;
      accountData.momoNumber = null;
      accountData.momoName = null;
    } else {
      accountData.branch = null;
      accountData.momoNetwork = momoNetwork || targetBankCode;
      accountData.momoNumber = targetNumber;
      accountData.momoName = targetName;
    }

    let savedId = accountId;

    if (accountId) {
      // Update existing document
      const accountRef = doc(db, "bankAccounts", accountId);
      await updateDoc(accountRef, accountData);
    } else {
      // Create new document
      accountData.createdAt = serverTimestamp();
      const newDocRef = await addDoc(collection(db, "bankAccounts"), accountData);
      savedId = newDocRef.id;
    }

    // Manager MoMo Identity Binding
    if (managerId) {
      try {
        const userRef = doc(db, "users", managerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          const updatePayload: Record<string, any> = {
            contactPhone: targetNumber,
            isIdentityVerified: true,
            updatedAt: new Date().toISOString(),
          };
          if (!uData.fullName || !uData.isIdentityVerified) {
            updatePayload.fullName = targetName;
          }
          if (!uData.phone) {
            updatePayload.phone = targetNumber;
          }
          await updateDoc(userRef, updatePayload);
        }
      } catch (bindErr) {
        console.warn("[Identity Binding] Failed to bind manager identity in payouts/update:", bindErr);
      }
    }

    return NextResponse.json({
      status: true,
      message: accountId
        ? "Account details updated successfully."
        : "Payment account created successfully.",
      data: {
        id: savedId,
        ...accountData,
      },
    });
  } catch (error: any) {
    console.error("Payout Account Update API Error:", error);
    return NextResponse.json(
      {
        status: false,
        error: error.message || "Failed to update payment account.",
      },
      { status: 500 }
    );
  }
}
