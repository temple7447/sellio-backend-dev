const axios = require('axios');

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485350586651115550/nesJUH0_gt2wEkB19378JBpl7uweCj1IPSDNmXh7lG4XdfCM6lKUsOUDbe0vXTcDgTGt';

const colors = {
    ERROR: 15158332,
    WARNING: 15105570,
    INFO: 3447003,
    SUCCESS: 3066993,
    DEBUG: 9807270
};

class DiscordLogger {
    constructor() {
        this.webhookUrl = DISCORD_WEBHOOK_URL;
    }

    async send(embed) {
        try {
            await axios.post(this.webhookUrl, { embeds: [embed] });
        } catch (error) {
            console.error('Failed to send Discord log:', error.message);
        }
    }

    formatTimestamp() {
        return new Date().toISOString();
    }

    async error(message, details = null) {
        const embed = {
            title: '❌ Error',
            description: message,
            color: colors.ERROR,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async warning(message, details = null) {
        const embed = {
            title: '⚠️ Warning',
            description: message,
            color: colors.WARNING,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async info(message, details = null) {
        const embed = {
            title: 'ℹ️ Info',
            description: message,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async success(message, details = null) {
        const embed = {
            title: '✅ Success',
            description: message,
            color: colors.SUCCESS,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async debug(message, details = null) {
        const embed = {
            title: '🔍 Debug',
            description: message,
            color: colors.DEBUG,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async authLog(action, email, ip, success, details = null) {
        const status = success ? '✅ SUCCESS' : '❌ FAILED';
        const color = success ? colors.SUCCESS : colors.ERROR;

        const embed = {
            title: `🔐 Auth: ${action}`,
            description: `**Status:** ${status}\n**Email:** \`${email}\``,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            },
            fields: [
                {
                    name: 'IP Address',
                    value: ip || 'Unknown',
                    inline: true
                }
            ]
        };

        if (details) {
            embed.fields.push(...this.formatDetails(details));
        }

        await this.send(embed);
    }

    async orderLog(action, orderId, status, details = null) {
        const embed = {
            title: `🛒 Order: ${action}`,
            description: `**Order ID:** \`${orderId}\`\n**Status:** ${status}`,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async paymentLog(action, amount, status, details = null) {
        const statusIcon = status === 'success' ? '✅' : (status === 'failed' ? '❌' : '⏳');
        const color = status === 'success' ? colors.SUCCESS : (status === 'failed' ? colors.ERROR : colors.WARNING);

        const embed = {
            title: `💰 Payment: ${action}`,
            description: `**Amount:** ₦${amount}\n**Status:** ${statusIcon} ${status}`,
            color: color,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async adminAction(action, adminEmail, targetEmail, details = null) {
        const embed = {
            title: `👮 Admin Action: ${action}`,
            description: `**Admin:** \`${adminEmail}\`\n**Target:** \`${targetEmail || 'N/A'}\``,
            color: colors.WARNING,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    async sellerVerification(sellerEmail, action, details = null) {
        const embed = {
            title: `🏪 Seller Verification: ${action}`,
            description: `**Seller:** \`${sellerEmail}\``,
            color: colors.INFO,
            timestamp: this.formatTimestamp(),
            footer: {
                text: 'Sellio Marketplace API'
            }
        };

        if (details) {
            embed.fields = this.formatDetails(details);
        }

        await this.send(embed);
    }

    formatDetails(details) {
        if (typeof details === 'string') {
            return [{ name: 'Details', value: details, inline: false }];
        }

        if (typeof details === 'object') {
            return Object.entries(details).map(([key, value]) => ({
                name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                value: String(value).substring(0, 1024),
                inline: true
            }));
        }

        return [];
    }
}

module.exports = new DiscordLogger();
