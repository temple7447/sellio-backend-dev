const axios = require('axios');

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485350586651115550/nesJUH0_gt2wEkB19378JBpl7uweCj1IPSDNmXh7lG4XdfCM6lKUsOUDbe0vXTcDgTGt';

const colors = {
    ERROR: 15158332,
    WARNING: 15105570,
    INFO: 3447003,
    SUCCESS: 3066993,
    DEBUG: 9807270,
    REQUEST: 7506394,
    RESPONSE: 16776960,
    DATABASE: 11141290,
    REGISTER: 65535,
    LOGIN: 3447003,
    PURCHASE: 3066993,
    WITHDRAWAL: 15105570
};

class DiscordLogger {
    constructor() {
        this.webhookUrl = DISCORD_WEBHOOK_URL;
        this.enabled = true;
        this.lastRequestTime = 0;
        this.minInterval = 1000;
    }

    async send(embed) {
        if (!this.enabled) return;

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
        }

        try {
            this.lastRequestTime = Date.now();
            await axios.post(this.webhookUrl, { embeds: [embed] }, {
                timeout: 5000,
                maxRedirects: 5
            });
        } catch (error) {
            // Silently fail - logging should not affect app performance
        }
    }

    formatTimestamp() {
        return new Date().toISOString();
    }

    formatDetails(details) {
        if (typeof details === 'string') {
            return [{ name: 'Details', value: details, inline: false }];
        }

        if (typeof details === 'object' && details !== null) {
            return Object.entries(details)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => ({
                    name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    value: String(value).substring(0, 1024),
                    inline: true
                }));
        }

        return [];
    }

    async error(message, details = null) {
        const embed = {
            title: '❌ Error',
            description: message,
            color: colors.ERROR,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async warning(message, details = null) {
        const embed = {
            title: '⚠️ Warning',
            description: message,
            color: colors.WARNING,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async info(message, details = null) {
        const embed = {
            title: 'ℹ️ Info',
            description: message,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async success(message, details = null) {
        const embed = {
            title: '✅ Success',
            description: message,
            color: colors.SUCCESS,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async debug(message, details = null) {
        const embed = {
            title: '🔍 Debug',
            description: message,
            color: colors.DEBUG,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async request(req) {
        const embed = {
            title: '📥 Incoming Request',
            color: colors.REQUEST,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' },
            fields: [
                { name: 'Method', value: req.method, inline: true },
                { name: 'Path', value: req.path || req.url, inline: true },
                { name: 'IP', value: req.ip || req.connection?.remoteAddress || 'Unknown', inline: true },
                { name: 'User Agent', value: (req.headers?.['user-agent'] || 'Unknown').substring(0, 100), inline: false }
            ]
        };

        if (req.body && Object.keys(req.body).length > 0) {
            const safeBody = { ...req.body };
            if (safeBody.password) safeBody.password = '***';
            if (safeBody.otp) safeBody.otp = '***';
            if (safeBody.oldPassword) safeBody.oldPassword = '***';
            if (safeBody.newPassword) safeBody.newPassword = '***';
            embed.fields.push({
                name: 'Body',
                value: JSON.stringify(safeBody).substring(0, 1000),
                inline: false
            });
        }

        this.send(embed);
    }

    async response(req, res, responseData = null) {
        const statusCode = res.statusCode || 200;
        const isError = statusCode >= 400;
        
        const embed = {
            title: isError ? '📤 Error Response' : '📤 Response',
            color: isError ? colors.ERROR : colors.SUCCESS,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' },
            fields: [
                { name: 'Method', value: req.method, inline: true },
                { name: 'Path', value: req.path || req.url, inline: true },
                { name: 'Status', value: String(statusCode), inline: true }
            ]
        };

        if (responseData && typeof responseData === 'object') {
            const summary = JSON.stringify(responseData).substring(0, 1000);
            embed.fields.push({
                name: 'Response',
                value: summary,
                inline: false
            });
        }

        this.send(embed);
    }

    async authLog(action, email, ip, success, details = null) {
        const status = success ? '✅ SUCCESS' : '❌ FAILED';
        const color = success ? colors.SUCCESS : colors.ERROR;

        const embed = {
            title: `🔐 Auth: ${action}`,
            description: `**Status:** ${status}\n**Email:** \`${email || 'Unknown'}\``,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' },
            fields: [
                { name: 'IP Address', value: ip || 'Unknown', inline: true }
            ]
        };

        if (details) embed.fields.push(...this.formatDetails(details));
        this.send(embed);
    }

    async orderLog(action, orderId, status, details = null) {
        const embed = {
            title: `🛒 Order: ${action}`,
            description: `**Order ID:** \`${orderId}\`\n**Status:** ${status}`,
            color: colors.ORDER,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async paymentLog(action, amount, status, details = null) {
        const statusIcon = status === 'success' ? '✅' : (status === 'failed' ? '❌' : '⏳');
        const color = status === 'success' ? colors.SUCCESS : (status === 'failed' ? colors.ERROR : colors.WARNING);

        const embed = {
            title: `💰 Payment: ${action}`,
            description: `**Amount:** ₦${amount || 'N/A'}\n**Status:** ${statusIcon} ${status}`,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async adminAction(action, adminEmail, targetEmail, details = null) {
        const embed = {
            title: `👮 Admin: ${action}`,
            description: `**Admin:** \`${adminEmail || 'Unknown'}\`\n**Target:** \`${targetEmail || 'N/A'}\``,
            color: colors.WARNING,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async sellerVerification(sellerEmail, action, details = null) {
        const embed = {
            title: `🏪 Seller: ${action}`,
            description: `**Seller:** \`${sellerEmail || 'Unknown'}\``,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async userRegistration(userType, email, details = null) {
        const embed = {
            title: `👤 New ${userType} Registration`,
            description: `**Email:** \`${email || 'Unknown'}\``,
            color: colors.REGISTER,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async productLog(action, productId, productName, details = null) {
        const embed = {
            title: `📦 Product: ${action}`,
            description: `**Product:** ${productName || 'Unknown'}\n**ID:** \`${productId || 'N/A'}\``,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async walletLog(action, userId, amount, balance, details = null) {
        const embed = {
            title: `💳 Wallet: ${action}`,
            description: `**User:** \`${userId || 'Unknown'}\`\n**Amount:** ₦${amount || 0}\n**Balance:** ₦${balance || 0}`,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async withdrawalLog(action, userId, amount, status, details = null) {
        const color = status === 'approved' ? colors.SUCCESS : (status === 'rejected' ? colors.ERROR : colors.WARNING);

        let description = `**User:** \`${userId || 'Unknown'}\`\n**Amount:** ₦${amount || 0}\n**Status:** ${status}`;
        if (details?.feeAmount) {
            description += `\n**Fee:** ₦${details.feeAmount} (${details.feePercentage}%)`;
            description += `\n**After Fee:** ₦${details.amountAfterFee}`;
        }

        const embed = {
            title: `🏧 Withdrawal: ${action}`,
            description: description,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async databaseLog(operation, collection, details = null) {
        const embed = {
            title: `🗄️ Database: ${operation}`,
            description: `**Collection:** \`${collection || 'Unknown'}\``,
            color: colors.DATABASE,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async emailLog(action, to, subject, success, details = null) {
        const color = success ? colors.SUCCESS : colors.ERROR;
        
        const embed = {
            title: `📧 Email: ${action}`,
            description: `**To:** \`${to || 'Unknown'}\`\n**Subject:** ${subject || 'N/A'}\n**Status:** ${success ? '✅ Sent' : '❌ Failed'}`,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace API' }
        };

        if (details) embed.fields = this.formatDetails(details);
        this.send(embed);
    }

    async sendOTP(email, otp) {
        const embed = {
            title: '🔐 Admin Login OTP',
            description: `**Email:** \`${email}\``,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: { text: 'Sellio Marketplace - Admin Login' },
            fields: [
                { name: 'Your OTP Code', value: `||${otp}||`, inline: false },
                { name: 'Expires in', value: '5 minutes', inline: true },
                { name: 'Action Required', value: 'Verify your login at the admin portal', inline: false }
            ]
        };

        this.send(embed);
    }

    disable() {
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
    }
}

module.exports = new DiscordLogger();
