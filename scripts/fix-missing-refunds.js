require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to:', mongoose.connection.name);

    const WalletTransaction = require('../src/models/WalletTransaction');
    const MarketWallet = require('../src/models/MarketWallet');

    // Find all declined/failed withdrawals
    const failedWithdrawals = await WalletTransaction.find({
        type: 'withdrawal',
        status: 'failed'
    }).lean();

    console.log(`Found ${failedWithdrawals.length} declined withdrawals`);

    let fixed = 0;
    for (const tx of failedWithdrawals) {
        // Check if a reversal already exists
        const reversal = await WalletTransaction.findOne({
            reference: `REV-${tx.reference}`
        }).lean();

        if (reversal) {
            console.log(`✓ ${tx.reference} — reversal already exists (₦${reversal.amount}), skipping`);
            continue;
        }

        // No reversal — wallet was never refunded
        const refundAmount = tx.metadata?.walletDebitAmount
            || tx.metadata?.originalAmount
            || tx.amount;

        if (!refundAmount || refundAmount <= 0) {
            console.log(`✗ ${tx.reference} — cannot determine refund amount, skipping`);
            continue;
        }

        console.log(`→ ${tx.reference} — no reversal found, crediting ₦${refundAmount} back to user ${tx.userId}`);

        // Credit the wallet
        const wallet = await MarketWallet.findOneAndUpdate(
            { userId: tx.userId },
            { $inc: { balance: refundAmount }, $set: { lastTransactionAt: new Date() } },
            { new: true }
        );

        if (!wallet) {
            console.log(`  ✗ Wallet not found for user ${tx.userId}`);
            continue;
        }

        // Record the reversal
        await WalletTransaction.create({
            userId: tx.userId,
            type: 'deposit',
            amount: refundAmount,
            balanceBefore: wallet.balance - refundAmount,
            balanceAfter: wallet.balance,
            reference: `REV-${tx.reference}`,
            description: `Refund: declined withdrawal ${tx.reference}`,
            status: 'completed',
            paymentGateway: 'system',
            metadata: {
                originalTransactionId: tx._id,
                reason: tx.metadata?.declineReason || 'Declined by admin - retroactive refund'
            }
        });

        console.log(`  ✓ ₦${refundAmount} credited. New balance: ₦${wallet.balance}`);
        fixed++;
    }

    console.log(`\nDone. Fixed ${fixed} missing refund(s).`);
    await mongoose.disconnect();
}

run().catch(console.error);
