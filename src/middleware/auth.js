const jwt = require('jsonwebtoken');
const config = require('../config/config');
const chalk = require('chalk');
const { MarketUser } = require('../models/MarketUser');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error();

        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await MarketUser.findById(decoded.id);

        if (!user) throw new Error();

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        console.error(chalk.red('✗ Authentication failed'));
        res.status(401).json({ message: 'Please authenticate.' });
    }
};

// Like `auth`, but never rejects: attaches req.user when a valid token is
// present, otherwise continues anonymously. For public endpoints that tailor
// their response to a logged-in viewer (e.g. "did I mark this helpful?").
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const decoded = jwt.verify(token, config.JWT_SECRET);
            const user = await MarketUser.findById(decoded.id);
            if (user) {
                req.user = user;
                req.token = token;
            }
        }
    } catch (error) {
        // Ignore bad/expired tokens — treat as anonymous.
    }
    next();
};

const isVerified = async (req, res, next) => {
    if (!req.user.isVerified) {
        return res.status(403).json({ message: 'Please verify your account first.' });
    }
    next();
};

const isSeller = async (req, res, next) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Seller access required.' });
    }
    next();
};

const isAdmin = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
};

const isAdminVerified = async (req, res, next) => {
    if (req.user.role === 'seller' && !req.user.adminVerified) {
        return res.status(403).json({
            message: 'Your account is pending admin verification. Please wait for approval.'
        });
    }
    next();
};

const isCustomer = async (req, res, next) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({ message: 'Customer access required.' });
    }
    next();
};

const isStaff = async (req, res, next) => {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Withdrawal access restricted to sellers and admins.' });
    }
    next();
};

module.exports = { auth, optionalAuth, isVerified, isSeller, isAdmin, isAdminVerified, isCustomer, isStaff };
