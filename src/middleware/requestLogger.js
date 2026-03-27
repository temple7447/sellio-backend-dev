const discordLogger = require('../utils/discordLogger');

const actionMappings = {
    'POST /api/auth/register': { category: '👤 New User', action: 'Someone just signed up' },
    'POST /api/auth/login': { category: '🔑 Login', action: 'User logged into their account' },
    'POST /api/auth/admin/login': { category: '🔐 Admin', action: 'Admin logged in' },
    'POST /api/auth/otp/send': { category: '📧 OTP', action: 'Verification code sent' },
    'POST /api/auth/otp/verify': { category: '✅ Verification', action: 'Account verified successfully' },
    'POST /api/auth/password/forgot': { category: '🔐 Password', action: 'Password reset requested' },
    'POST /api/auth/password/reset': { category: '🔐 Password', action: 'Password reset completed' },
    'PATCH /api/auth/password': { category: '🔐 Password', action: 'Password changed' },
    'GET /api/wallet/balance': { category: '💰 Wallet', action: 'Checked wallet balance' },
    'GET /api/wallet/transactions': { category: '💰 Wallet', action: 'Viewed transaction history' },
    'GET /api/wallet/summary': { category: '💰 Wallet', action: 'Viewed wallet summary' },
    'POST /api/orders': { category: '🛒 Order', action: 'New order placed' },
    'PATCH /api/orders/:id/status': { category: '📦 Order', action: 'Order status changed' },
    'POST /api/orders/:id/cancel': { category: '❌ Order', action: 'Order cancelled' },
    'POST /api/wallet/deposit/initialize': { category: '💳 Deposit', action: 'Started adding money to wallet' },
    'GET /api/wallet/deposit/verify/:reference': { category: '💳 Deposit', action: 'Wallet deposit completed' },
    'POST /api/wallet/withdraw': { category: '🏧 Withdrawal', action: 'Requested to withdraw money' },
    'POST /api/wallet/trusted-badge/purchase': { category: '⭐ Badge', action: 'Purchased trusted seller badge' },
    'POST /api/wallet/credit': { category: '💰 Wallet', action: 'Money added to wallet (Admin)' },
    'POST /api/wallet/debit': { category: '💰 Wallet', action: 'Money deducted from wallet (Admin)' },
    'GET /api/products/public': { category: '🛍️ Shop', action: 'Browsed products' },
    'GET /api/products/seller/products': { category: '📦 Products', action: 'Seller viewed their products' },
    'POST /api/products': { category: '➕ Product', action: 'Listed a new product for sale' },
    'PATCH /api/products/:id': { category: '✏️ Product', action: 'Updated a product' },
    'DELETE /api/products/:id': { category: '🗑️ Product', action: 'Deleted a product' },
    'POST /api/cart/checkout': { category: '🛒 Cart', action: 'Completed checkout' },
    'POST /api/cart/clear': { category: '🛒 Cart', action: 'Cleared cart' },
    'GET /api/cart': { category: '🛒 Cart', action: 'Viewed cart' },
    'POST /api/addresses': { category: '📍 Address', action: 'Added new delivery address' },
    'PATCH /api/addresses/:id': { category: '📍 Address', action: 'Updated delivery address' },
    'DELETE /api/addresses/:id': { category: '🗑️ Address', action: 'Removed delivery address' },
    'GET /api/addresses': { category: '📍 Address', action: 'Viewed delivery addresses' },
    'POST /api/admin/sellers/:sellerId/trusted-badge': { category: '⭐ Badge', action: 'Trusted badge updated for seller' },
    'POST /api/admin/users/:userId/activate': { category: '👤 User', action: 'User account activated' },
    'POST /api/admin/users/:userId/deactivate': { category: '👤 User', action: 'User account deactivated' },
    'POST /api/admin/orders/:orderId/approve': { category: '✅ Order', action: 'Order approved' },
    'POST /api/admin/orders/:orderId/reject': { category: '❌ Order', action: 'Order rejected' },
    'POST /api/admin/withdrawals/:transactionId/approve': { category: '✅ Withdrawal', action: 'Withdrawal request approved' },
    'POST /api/admin/withdrawals/:transactionId/decline': { category: '❌ Withdrawal', action: 'Withdrawal request declined' },
    'POST /api/referrals/claim': { category: '🎁 Referral', action: 'Claimed referral reward' },
    'POST /api/wishlist': { category: '❤️ Wishlist', action: 'Added item to wishlist' },
    'DELETE /api/wishlist/:productId': { category: '💔 Wishlist', action: 'Removed item from wishlist' },
    'GET /api/wishlist': { category: '❤️ Wishlist', action: 'Viewed wishlist' },
    'POST /api/reviews': { category: '⭐ Review', action: 'Left a review' },
    'GET /api/reviews/product/:productId': { category: '⭐ Review', action: 'Viewed product reviews' },
};

const getActionInfo = (method, path) => {
    const fullKey = `${method} ${path}`;
    
    for (const [pattern, info] of Object.entries(actionMappings)) {
        const [patMethod, patPath] = pattern.split(' ');
        if (patMethod === method) {
            const regex = new RegExp('^' + patPath.replace(/:[^/]+/g, '[^/]+') + '$');
            if (regex.test(path)) {
                return info;
            }
        }
    }
    
    return null;
};

const requestLogger = (req, res, next) => {
    const start = Date.now();
    const actionInfo = getActionInfo(req.method, req.path);
    
    const originalSend = res.send;
    res.send = function(body) {
        res.send = originalSend;
        const responseTime = Date.now() - start;
        const statusCode = res.statusCode || 200;
        const isSuccess = statusCode >= 200 && statusCode < 400;
        
        if (actionInfo) {
            const details = {};
            
            if (isSuccess) {
                details.Status = '✅ Done';
            } else {
                details.Status = '❌ Failed';
            }
            
            details.Time = `${responseTime}ms`;
            
            if (req.user?.email) {
                details.User = req.user.email;
            }
            
            if (req.body?.amount) {
                details.Amount = `₦${Number(req.body.amount).toLocaleString()}`;
            }
            
            if (req.body?.productId || req.params?.id) {
                details.Item = req.body.productId || req.params.id;
            }
            
            if (req.body?.comment) {
                details.Review = req.body.comment.substring(0, 50) + (req.body.comment.length > 50 ? '...' : '');
            }
            
            if (req.body?.rating) {
                details.Rating = req.body.rating + ' ⭐';
            }
            
            const title = isSuccess 
                ? `${actionInfo.category}: ${actionInfo.action}`
                : `${actionInfo.category}: ${actionInfo.action} - Error`;
            
            if (isSuccess) {
                discordLogger.success(title, details);
            } else {
                discordLogger.error(title, details);
            }
        } else if (statusCode >= 400) {
            discordLogger.error(`${req.method} ${req.path} - Error ${statusCode}`, {
                Time: `${responseTime}ms`,
            });
        }
        
        return res.send(body);
    };
    
    next();
};

module.exports = requestLogger;
