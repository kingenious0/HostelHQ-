
"use server";

import { db } from "@/lib/firebase";
import {
    createTransferRecipient,
    initiateTransfer,
    checkPaystackBalance,
    initiateBulkTransfer
} from "@/lib/paystack-payouts";
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, Timestamp, runTransaction, writeBatch, setDoc } from "firebase/firestore";
import { revalidatePath } from "next/cache";

// TYPES

export type PayoutRequest = {
    id: string;
    userId: string;
    userName: string;
    amount: number; // In pesewas
    phonenumber: string;
    network: string; // 'MTN', 'VOD', 'ATL'
    recipientCode: string;
    status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
    requestedAt: string;
    processedAt?: string;
    reference?: string;
    transferCode?: string;
    adminNote?: string;
};

// ACTIONS

/**
 * Register a user as a Paystack Transfer Recipient.
 * Call this when a Manager/Agent sets up their payout details.
 */
export async function registerPaystackRecipient(userId: string, name: string, accountNumber: string, bankCode: string) {
    try {
        // 1. Create Recipient on Paystack
        const recipientData = await createTransferRecipient({
            type: 'mobile_money',
            name: name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'GHS',
            metadata: {
                user_id: userId
            }
        });

        // 2. Save recipient_code to User Profile
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            paystackRecipientCode: recipientData.recipient_code,
            momoNumber: accountNumber, // Store for display
            momoProviderName: recipientData.details.bank_name // Store bank name for display
        });

        return { success: true, message: "Payout method linked successfully!", recipientCode: recipientData.recipient_code };

    } catch (error: any) {
        console.error("Register Paystack Recipient Failed:", error);
        return { success: false, message: error.message || "Failed to link payout method." };
    }
}

/**
 * Get the current wallet balance for a user.
 * Assumes 'walletBalance' field exists on user doc (in pesewas).
 */
export async function getUserWalletBalance(userId: string) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("User not found");
        }

        const data = userSnap.data();
        return {
            balance: data.walletBalance || 0, // in pesewas
            currency: 'GHS',
            recipientCode: data.paystackRecipientCode,
            momoNumber: data.momoNumber,
            momoProviderName: data.momoProviderName
        };

    } catch (error: any) {
        console.error("Get Wallet Balance Failed:", error);
        return { balance: 0, currency: 'GHS', error: error.message };
    }
}

/**
 * System Settings Actions
 */
export async function getSystemSettings() {
    try {
        const docRef = doc(db, 'system_settings', 'payouts');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return { autoApprove: false }; // Default
    } catch (error) {
        console.error("Get Settings Failed:", error);
        return { autoApprove: false };
    }
}

export async function setPayoutAutoApprove(enabled: boolean) {
    try {
        const docRef = doc(db, 'system_settings', 'payouts');
        await setDoc(docRef, { autoApprove: enabled }, { merge: true });
        revalidatePath('/admin/payouts');
        return { success: true };
    } catch (error: any) {
        console.error("Set Settings Failed:", error);
        return { success: false, message: error.message };
    }
}


/**
 * Request a Payout (Withdrawal).
 * Deducts (holds) balance conceptually (or checks it), creates a request.
 */
export async function requestWithdrawal(userId: string, amount: number) {
    try {
        // 1. Check Auto-Approve Setting
        const settings = await getSystemSettings();
        const autoApprove = settings?.autoApprove || false;

        const userRef = doc(db, 'users', userId);
        const newRequestRef = doc(collection(db, 'payout_requests'));
        let requestData: any = {};

        // 2. Initial Transaction: Deduct Balance & Create Pending Request
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("User does not exist!");

            const userData = userDoc.data();
            const currentBalance = userData.walletBalance || 0;

            if (currentBalance < amount) {
                throw new Error("Insufficient funds in wallet.");
            }

            if (!userData.paystackRecipientCode) {
                throw new Error("No payout method linked. Please link a MoMo number first.");
            }

            // Deduct from wallet immediately
            transaction.update(userRef, {
                walletBalance: currentBalance - amount,
                frozenBalance: (userData.frozenBalance || 0) + amount
            });

            // Create Payout Request
            requestData = {
                userId,
                userName: userData.fullName || "User",
                amount,
                phonenumber: userData.momoNumber,
                recipientCode: userData.paystackRecipientCode,
                status: 'pending', // Initially pending
                requestedAt: new Date().toISOString(),
            };

            transaction.set(newRequestRef, requestData);
        });

        // 3. Auto-Approve Logic (Post-Transaction)
        if (autoApprove) {
            try {
                // Check Admin Balance
                const balances = await checkPaystackBalance();
                const ghsBalance = balances.find((b: any) => b.currency === 'GHS');

                if (ghsBalance && ghsBalance.balance >= amount) {
                    // Initiate Transfer
                    const transferResult = await initiateTransfer({
                        source: 'balance',
                        amount: amount,
                        recipient: requestData.recipientCode,
                        reason: "HostelHQ Payout (Auto)"
                    });

                    // Update Request to Approved
                    await updateDoc(newRequestRef, {
                        status: 'approved',
                        processedAt: new Date().toISOString(),
                        transferCode: transferResult.transfer_code,
                        reference: transferResult.reference,
                        adminNote: 'Auto-approved by system'
                    });

                    revalidatePath('/manager/dashboard');
                    return { success: true, message: "Withdrawal processed instantly!" };
                } else {
                    console.warn("Auto-approve failed due to insufficient admin balance. Leaving as pending.");
                    // Leave as pending, let admin handle it manually.
                }

            } catch (transferError: any) {
                console.error("Auto-approve transfer failed:", transferError);
                // Update with error note but keep as pending/failed so admin knows
                await updateDoc(newRequestRef, {
                    adminNote: `Auto-approve failed: ${transferError.message || 'Unknown error'}`
                });
            }
        }

        revalidatePath('/manager/dashboard');
        return { success: true, message: "Withdrawal request submitted successfully!" };

    } catch (error: any) {
        console.error("Request Withdrawal Failed:", error);
        return { success: false, message: error.message || "Failed to request withdrawal." };
    }
}

// ADMIN ACTIONS

/**
 * ADMIN: Get all pending withdrawal requests.
 */
export async function getPendingWithdrawals() {
    try {
        const q = query(
            collection(db, 'payout_requests'),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    } catch (error) {
        console.error("Fetch Pending Withdrawals Failed:", error);
        return [];
    }
}

/**
 * ADMIN: Process (Approve & Pay) a single withdrawal.
 */
export async function processWithdrawalAction(requestId: string) {
    try {
        // 1. Fetch Request
        const requestRef = doc(db, 'payout_requests', requestId);
        const requestSnap = await getDoc(requestRef);

        if (!requestSnap.exists()) return { success: false, message: "Request not found" };
        const requestData = requestSnap.data() as PayoutRequest;

        if (requestData.status !== 'pending') {
            return { success: false, message: "Request is not pending." };
        }

        // 2. Check Admin's Paystack Balance
        const balances = await checkPaystackBalance();
        const ghsBalance = balances.find((b: any) => b.currency === 'GHS');

        if (!ghsBalance || ghsBalance.balance < requestData.amount) {
            return { success: false, message: `Insufficient Admin Playstack Balance. Available: ${ghsBalance?.balance / 100} GHS` };
        }

        // 3. Init Transfer
        const transferResult = await initiateTransfer({
            source: 'balance',
            amount: requestData.amount,
            recipient: requestData.recipientCode,
            reason: "HostelHQ Payout"
        });

        // 4. Update Request Status
        await updateDoc(requestRef, {
            status: 'approved', // Or 'processed' - initially 'success' means queued at Paystack
            processedAt: new Date().toISOString(),
            transferCode: transferResult.transfer_code,
            reference: transferResult.reference
        });

        // Note: You should listen to webhooks for final 'success'/'failed' status of the transfer
        // But for this PRD, "Approve & Release" is the step.

        revalidatePath('/admin/payouts');
        return { success: true, message: "Funds released successfully!" };

    } catch (error: any) {
        console.error("Process Withdrawal Failed:", error);
        return { success: false, message: error.message || "Failed to process payout." };
    }
}

/**
 * ADMIN: Reject a withdrawal request.
 * Refunds the money back to user wallet.
 */
export async function rejectWithdrawalAction(requestId: string, reason: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const requestRef = doc(db, 'payout_requests', requestId);
            const requestDoc = await transaction.get(requestRef);

            if (!requestDoc.exists()) throw new Error("Request not found");
            const requestData = requestDoc.data() as PayoutRequest;

            if (requestData.status !== 'pending') throw new Error("Request is not pending");

            const userRef = doc(db, 'users', requestData.userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) throw new Error("User not found");
            const userData = userDoc.data();

            // Refund logic
            transaction.update(userRef, {
                walletBalance: (userData.walletBalance || 0) + requestData.amount,
                frozenBalance: Math.max(0, (userData.frozenBalance || 0) - requestData.amount)
            });

            transaction.update(requestRef, {
                status: 'rejected',
                adminNote: reason,
                processedAt: new Date().toISOString()
            });
        });

        revalidatePath('/admin/payouts');
        return { success: true, message: "Request rejected and funds refunded." };

    } catch (error: any) {
        console.error("Reject Withdrawal Failed:", error);
        return { success: false, message: error.message };
    }
}

/**
 * ADMIN: Process Bulk Withdrawal (Pay all pending).
 */
export async function processBulkWithdrawalAction(requestIds: string[]) {
    try {
        if (!requestIds.length) return { success: false, message: "No requests selected" };

        // 1. Fetch all requests to verify and prep payload
        const transfers = [];
        const validRequestIds = [];

        // Check balance first
        const balances = await checkPaystackBalance();
        const ghsBalance = balances.find((b: any) => b.currency === 'GHS');
        let totalAmount = 0;

        for (const id of requestIds) {
            const requestRef = doc(db, 'payout_requests', id);
            const requestSnap = await getDoc(requestRef);
            if (requestSnap.exists()) {
                const data = requestSnap.data() as PayoutRequest;
                if (data.status === 'pending') {
                    transfers.push({
                        amount: data.amount,
                        recipient: data.recipientCode,
                        reference: `BULK_${id}_${Date.now()}`,
                        reason: "HostelHQ Bulk Payout"
                    });
                    validRequestIds.push(id);
                    totalAmount += data.amount;
                }
            }
        }

        if (transfers.length === 0) return { success: false, message: "No valid pending requests found." };

        if (!ghsBalance || ghsBalance.balance < totalAmount) {
            return { success: false, message: `Insufficient Admin Playstack Balance. Needed: ${totalAmount / 100}, Available: ${ghsBalance?.balance / 100} GHS` };
        }

        // 2. Call Paystack Bulk API
        const bulkResponse = await initiateBulkTransfer({
            source: 'balance',
            transfers: transfers
        });

        // 3. Update all requests status
        const batch = writeBatch(db);
        validRequestIds.forEach(id => {
            const ref = doc(db, 'payout_requests', id);
            batch.update(ref, {
                status: 'approved', // Assuming immediate success for logic flow
                processedAt: new Date().toISOString(),
            });
        });
        await batch.commit();

        revalidatePath('/admin/payouts');
        return { success: true, message: `Successfully initiated ${transfers.length} transfers!` };

    } catch (error: any) {
        console.error("Bulk Process Failed:", error);
        return { success: false, message: error.message || "Failed to process bulk payout." };
    }
}

