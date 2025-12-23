
import { PAYSTACK_PUBLIC_KEY } from "./paystack";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY is not defined in environment variables.");
}

const getHeaders = () => ({
    authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'content-type': 'application/json',
});

// TYPES

export type PaystackBank = {
    name: string;
    slug: string;
    code: string;
    longcode: string;
    gateway: string;
    pay_with_bank: boolean;
    active: boolean;
    is_deleted: boolean;
    country: string;
    currency: string;
    type: string;
    id: number;
    createdAt: string;
    updatedAt: string;
};

export type TransferRecipientPayload = {
    type: 'mobile_money' | 'nuban';
    name: string;
    account_number: string;
    bank_code: string;
    currency?: 'GHS' | 'NGN';
    description?: string;
    metadata?: any;
};

export type TransferRecipientResponse = {
    status: boolean;
    message: string;
    data: {
        active: boolean;
        createdAt: string;
        currency: string;
        domain: string;
        id: number;
        integration: number;
        name: string;
        recipient_code: string;
        type: string;
        updatedAt: string;
        is_deleted: boolean;
        details: {
            authorization_code: string | null;
            account_number: string;
            account_name: string | null;
            bank_code: string;
            bank_name: string;
        };
    };
};

export type InitiateTransferPayload = {
    source: 'balance';
    amount: number; // In kobo/pesewas
    recipient: string; // recipient_code
    reason?: string;
    reference?: string;
};

export type InitiateBulkTransferPayload = {
    source: 'balance';
    transfers: {
        amount: number;
        recipient: string;
        reference?: string;
        reason?: string;
    }[];
};

export type PaystackBalanceResponse = {
    status: boolean;
    message: string;
    data: {
        currency: string;
        balance: number;
    }[];
};


// API FUNCTIONS

/**
 * List available banks/providers.
 * @param country - 'ghana' or 'nigeria'
 */
export async function listBanks(country: string = 'ghana'): Promise<PaystackBank[]> {
    try {
        const response = await fetch(`${BASE_URL}/bank?country=${country}&currency=GHS`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store' // Ensure fresh data
        });

        if (!response.ok) {
            throw new Error(`Failed to list banks: ${response.statusText}`);
        }

        const json = await response.json();
        if (!json.status) throw new Error(json.message);

        return json.data;
    } catch (error) {
        console.error("Error listing banks:", error);
        throw error;
    }
}

/**
 * Create a Transfer Recipient.
 */
export async function createTransferRecipient(payload: TransferRecipientPayload): Promise<TransferRecipientResponse['data']> {
    try {
        const response = await fetch(`${BASE_URL}/transferrecipient`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        const json = await response.json();
        if (!response.ok || !json.status) {
            console.error("Create Transfer Recipient Error:", json);
            throw new Error(json.message || "Failed to create transfer recipient");
        }

        return json.data;
    } catch (error) {
        console.error("Error creating transfer recipient:", error);
        throw error;
    }
}

/**
 * Initiate a Single Transfer.
 */
export async function initiateTransfer(payload: InitiateTransferPayload) {
    try {
        const response = await fetch(`${BASE_URL}/transfer`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        const json = await response.json();
        if (!response.ok || !json.status) {
            console.error("Initiate Transfer Error:", json);
            throw new Error(json.message || "Failed to initiate transfer");
        }

        return json.data;
    } catch (error) {
        console.error("Error initiating transfer:", error);
        throw error;
    }
}

/**
 * Initiate a Bulk Transfer.
 */
export async function initiateBulkTransfer(payload: InitiateBulkTransferPayload) {
    try {
        const response = await fetch(`${BASE_URL}/transfer/bulk`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        const json = await response.json();
        if (!response.ok || !json.status) {
            console.error("Initiate Bulk Transfer Error:", json);
            throw new Error(json.message || "Failed to initiate bulk transfer");
        }

        return json.data;
    } catch (error) {
        console.error("Error initiating bulk transfer:", error);
        throw error;
    }
}

/**
 * Check Paystack Balance.
 */
export async function checkPaystackBalance() {
    try {
        const response = await fetch(`${BASE_URL}/balance`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store'
        });

        const json = await response.json();
        if (!response.ok || !json.status) {
            console.error("Check Balance Error:", json);
            throw new Error(json.message || "Failed to check balance");
        }

        return json.data; // Returns array of balances (different currencies)
    } catch (error) {
        console.error("Error checking balance:", error);
        throw error;
    }
}
