const paystack = require('./src/utils/paystack');
const fs = require('fs');

async function exportBanks() {
    try {
        const result = await paystack.getBanks();
        fs.writeFileSync('all_banks.json', JSON.stringify(result, null, 2));
        console.log('Exported all banks to all_banks.json');
    } catch (error) {
        console.error('Error:', error);
    }
}

exportBanks();
