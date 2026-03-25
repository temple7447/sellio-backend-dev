const discordLogger = require('../utils/discordLogger');

const actionMappings = {
    'POST /api/auth/register': { category: 'Auth', action: 'New User Registration' },
    'POST /api/auth/login': { category: 'Auth', action: 'User Login' },
    'POST /api/auth/admin/login': { category: 'Auth', action: 'Admin Login' },
    'POST /api/auth/otp/send': { category: 'Auth', action: 'OTP Sent' },
    'POST /api/auth/otp/verify': { category: 'Auth', action: 'OTP Verified' },
    'POST /api/auth/password/forgot': { category: 'Auth', action: 'Password Reset Request' },
    'POST /api/auth/password/reset': { category: 'Auth', action: 'Password Reset' },
    'PATCH /api/auth/password': { category: 'Auth', action: 'Password Changed' },
    'GET /api/wallet/balance': { category: 'Wallet', action: 'Wallet Balance Checked' },
    'GET /api/wallet/transactions': { category: 'Wallet', action: 'Wallet Transactions Viewed' },
    'GET /api/wallet/summary': { category: 'Wallet', action: 'Wallet Summary Viewed' },
    'POST /api/orders': { category: 'Order', action: 'New Order Placed' },
    'PATCH /api/orders/:id/status': { category: 'Order', action: 'Order Status Updated' },
    'POST /api/orders/:id/cancel': { category: 'Order', action: 'Order Cancelled' },
    'POST /api/wallet/deposit/initialize': { category: 'Payment', action: 'Wallet Deposit Initiated' },
    'GET /api/wallet/deposit/verify/:reference': { category: 'Payment', action: 'Wallet Deposit Verified' },
    'POST /api/wallet/withdraw': { category: 'Payment', action: 'Withdrawal Requested' },
    'POST /api/wallet/trusted-badge/purchase': { category: 'Payment', action: 'Trusted Badge Purchased' },
    'POST /api/wallet/credit': { category: 'Payment', action: 'Wallet Credited (Admin)' },
    'POST /api/wallet/debit': { category: 'Payment', action: 'Wallet Debited (Admin)' },
    'GET /api/products/public': { category: 'Product', action: 'Products Browsed' },
    'GET /api/products/seller/products': { category: 'Product', action: 'Seller Products Viewed' },
    'POST /api/products': { category: 'Product', action: 'New Product Created' },
    'PATCH /api/products/:id': { category: 'Product', action: 'Product Updated' },
    'DELETE /api/products/:id': { category: 'Product', action: 'Product Deleted' },
    'POST /api/cart/checkout': { category: 'Cart', action: 'Cart Checkout' },
    'POST /api/cart/clear': { category: 'Cart', action: 'Cart Cleared' },
    'GET /api/cart': { category: 'Cart', action: 'Cart Viewed' },
    'POST /api/addresses': { category: 'Address', action: 'New Address Added' },
    'PATCH /api/addresses/:id': { category: 'Address', action: 'Address Updated' },
    'DELETE /api/addresses/:id': { category: 'Address', action: 'Address Deleted' },
    'GET /api/addresses': { category: 'Address', action: 'Addresses Viewed' },
    'POST /api/admin/sellers/:sellerId/trusted-badge': { category: 'Admin', action: 'Seller Trusted Badge Toggled' },
    'POST /api/admin/users/:userId/activate': { category: 'Admin', action: 'User Activated' },
    'POST /api/admin/users/:userId/deactivate': { category: 'Admin', action: 'User Deactivated' },
    'POST /api/admin/orders/:orderId/approve': { category: 'Admin', action: 'Order Approved' },
    'POST /api/admin/orders/:orderId/reject': { category: 'Admin', action: 'Order Rejected' },
    'POST /api/admin/withdrawals/:transactionId/approve': { category: 'Admin', action: 'Withdrawal Approved' },
    'POST /api/admin/withdrawals/:transactionId/decline': { category: 'Admin', action: 'Withdrawal Declined' },
    'POST /api/referrals/claim': { category: 'Referral', action: 'Referral Claimed' },
    'POST /api/wishlist': { category: 'Wishlist', action: 'Added to Wishlist' },
    'DELETE /api/wishlist/:productId': { category: 'Wishlist', action: 'Removed from Wishlist' },
    'GET /api/wishlist': { category: 'Wishlist', action: 'Wishlist Viewed' },
    'POST /api/reviews': { category: 'Review', action: 'Review Submitted' },
    'GET /api/reviews/product/:productId': { category: 'Review', action: 'Product Reviews Viewed' },
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
            const details = {
                Status: isSuccess ? 'Success' : 'Failed',
                ResponseTime: `${responseTime}ms`,
                IP: req.ip || req.connection?.remoteAddress || 'Unknown',
            };
            
            if (req.user?.email) {
                details.User = req.user.email;
            }
            
            if (req.body?.amount) {
                details.Amount = `₦${req.body.amount}`;
            }
            
            if (req.body?.productId || req.params?.id) {
                details.ProductID = req.body.productId || req.params.id;
            }
            
            const title = isSuccess 
                ? `✅ ${actionInfo.category}: ${actionInfo.action}`
                : `❌ ${actionInfo.category}: ${actionInfo.action} Failed`;
            
            discordLogger.info(title, details);
        } else if (statusCode >= 400) {
            discordLogger.error(`${req.method} ${req.path} - Error ${statusCode}`, {
                IP: req.ip || req.connection?.remoteAddress || 'Unknown',
                ResponseTime: `${responseTime}ms`,
            });
        }
        
        return res.send(body);
    };
    
    next();
};

module.exports = requestLogger;
