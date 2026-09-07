import { NextRequest, NextResponse } from "next/server";
import { getPaystackKeys } from "@/lib/paystack-utils";

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

    return NextResponse.json({
      status: true,
      message: "Account name resolved successfully.",
      data: {
        account_number: data.data.account_number,
        account_name: data.data.account_name,
        bank_id: data.data.bank_id,
        bank_code: bankCode,
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
