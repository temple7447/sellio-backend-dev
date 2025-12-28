const mongoose = require('mongoose');

const rewardSettingsSchema = new mongoose.Schema({
    // Singleton pattern - only one settings document
    _id: {
        type: String,
        default: 'reward_settings'
    },

    // Referral bonus settings
    referralBonus: {
        enabled: {
            type: Boolean,
            default: true
        },
        amount: {
            type: Number,
            default: 500,
            min: 0
        },
        minPurchase: {
            type: Number,
            default: 5000,
            min: 0
        }
    },

    // Withdrawal settings
    withdrawal: {
        minAmount: {
            type: Number,
            default: 2000,
            min: 0
        }
    },

    // Cashback settings
    cashback: {
        enabled: {
            type: Boolean,
            default: true
        },
        amount: {
            type: Number,
            default: 1000,
            min: 0
        },
        minimumPurchase: {
            type: Number,
            default: 30000,
            min: 0
        }
    },

    // Metadata
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketUser'
    }
}, {
    timestamps: true
});

// Static method to get settings (creates default if doesn't exist)
rewardSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findById('reward_settings');

    if (!settings) {
        // Create default settings
        settings = await this.create({
            _id: 'reward_settings',
            referralBonus: {
                enabled: true,
                amount: 500,
                minPurchase: 5000
            },
            withdrawal: {
                minAmount: 2000
            },
            cashback: {
                enabled: true,
                amount: 1000,
                minimumPurchase: 30000
            }
        });
    }

    return settings;
};

module.exports = mongoose.model('RewardSettings', rewardSettingsSchema);
