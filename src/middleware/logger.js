const chalk = require('chalk');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Create a write stream for access logs
const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

// Custom token for response body
morgan.token('body', (req) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive data
        if (sanitizedBody.password) sanitizedBody.password = '***';
        if (sanitizedBody.token) sanitizedBody.token = '***';
        if (sanitizedBody.oldPassword) sanitizedBody.oldPassword = '***';
        if (sanitizedBody.newPassword) sanitizedBody.newPassword = '***';

        return JSON.stringify(sanitizedBody);
    }
    return '';
});

// Custom format
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :body';

// Development logger - log all requests
const devLogger = morgan(morganFormat, {
    stream: {
        write: (message) => console.log(chalk.cyan(`➜ ${message.trim()}`))
    }
});

// Production logger - log errors
const prodLogger = morgan(morganFormat, {
    skip: (req, res) => res.statusCode < 400,
    stream: accessLogStream
});

const requestLogger = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return prodLogger(req, res, next);
    }
    return devLogger(req, res, next);
};

module.exports = requestLogger;
