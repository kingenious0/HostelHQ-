import { NextRequest, NextResponse } from "next/server";
import { getPaystackKeys, generatePaystackVerificationToken } from "@/lib/paystack-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get("account_number")?.trim();
    const bankCode = searchParams.get("bank_code")?.trim();

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        {
          status: false,
          message: "account_number and bank_code query parameters are required.",
        },
        { status: 400 }
      );
    }

    const { secretKey } = await getPaystackKeys();

    if (!secretKey) {
      return NextResponse.json(
        {
          status: false,
          message: "Paystack secret key is not configured on this server.",
        },
        { status: 500 }
      );
    }

    // Call Paystack /bank/resolve API
    const paystackUrl = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
      accountNumber
    )}&bank_code=${encodeURIComponent(bankCode)}`;

    const paystackRes = await fetch(paystackUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      return NextResponse.json(
        {
          status: false,
          message:
            data.message ||
            "Unable to resolve account name. Please verify the account number and provider.",
        },
        { status: paystackRes.status || 400 }
      );
    }

    const resolvedName = data.data.account_name;
    const resolvedNumber = data.data.account_number || accountNumber;
    const verificationToken = generatePaystackVerificationToken(
      resolvedNumber,
      bankCode,
      resolvedName,
      secretKey
    );

    return NextResponse.json({
      status: true,
      message: "Account name resolved successfully.",
      data: {
        account_number: resolvedNumber,
        account_name: resolvedName,
        bank_id: data.data.bank_id,
        bank_code: bankCode,
        verification_token: verificationToken,
        verification_hash: verificationToken,
      },
    });
  } catch (error: any) {
    console.error("Paystack Account Resolution Error:", error);
    return NextResponse.json(
      {
        status: false,
        message: error.message || "Internal server error during account resolution.",
      },
      { status: 500 }
    );
  }
}
