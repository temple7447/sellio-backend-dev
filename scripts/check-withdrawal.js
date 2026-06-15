require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to:', mongoose.connection.name);

    const WalletTransaction = require('../src/models/WalletTransaction');
    const MarketWallet = require('../src/models/MarketWallet');

    // Find recent withdrawal transactions regardless of DB name
    const txs = await WalletTransaction.find({ type: 'withdrawal' }).sort({ createdAt: -1 }).limit(10).lean();
    console.log('Total withdrawals found:', txs.length);

    for (const tx of txs) {
        console.log(`\nRef: ${tx.reference} | Status: ${tx.status} | Amount: ${tx.amount}`);
        console.log(`  walletDebitAmount: ${tx.metadata?.walletDebitAmount}`);
        console.log(`  declineReason: ${tx.metadata?.declineReason}`);
        console.log(`  createdAt: ${tx.createdAt}`);
        const reversal = await WalletTransaction.findOne({ reference: `REV-${tx.reference}` }).lean();
        const wallet = await MarketWallet.findOne({ userId: tx.userId }).lean();
        console.log(`  Reversal exists: ${!!reversal} | Current wallet balance: ${wallet?.balance}`);
    }

    await mongoose.disconnect();
}

run().catch(console.error);
