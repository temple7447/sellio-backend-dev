const https = require('https');
const config = require('../config/config');

class PaystackService {
    verifyTransaction(reference) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.paystack.co',
                port: 443,
                path: `/transaction/verify/${reference}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`
                }
            };

            const req = https.request(options, res => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', error => {
                reject(error);
            });

            req.end();
        });
    }

    getTransactionStatus(status) {
        const statusMap = {
            'abandoned': 'cancelled',
            'failed': 'failed',
            'ongoing': 'processing',
            'pending': 'pending',
            'processing': 'processing',
            'queued': 'pending',
            'reversed': 'refunded',
            'success': 'completed'
        };
        return statusMap[status] || 'pending';
    }
}

module.exports = new PaystackService();
