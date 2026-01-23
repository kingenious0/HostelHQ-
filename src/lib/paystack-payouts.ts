
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

const handleNetworkError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    if (error instanceof TypeError && error.message === 'fetch failed') {
        const cause = (error as any).cause;
        if (cause && cause.code === 'ENOTFOUND') {
            throw new Error(`Internet connection error: Unable to reach Paystack servers. Please check your network.`);
        }
        throw new Error(`Connection failed: Paystack servers are unreachable. Please try again later.`);
    }
    throw error;
};

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
        handleNetworkError(error, "listing banks");
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
        handleNetworkError(error, "creating transfer recipient");
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
        handleNetworkError(error, "initiating transfer");
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
        handleNetworkError(error, "initiating bulk transfer");
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
        handleNetworkError(error, "checking balance");
    }
}
