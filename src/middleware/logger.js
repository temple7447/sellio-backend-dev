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
    if (req.method === 'POST' || req.method === 'PUT') {
        const sanitizedBody = { ...req.body };
        // Remove sensitive data
        delete sanitizedBody.password;
        delete sanitizedBody.token;
        return JSON.stringify(sanitizedBody);
    }
    return '';
});

// Custom format
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :body';

// Development logger
const devLogger = morgan(morganFormat, {
    skip: (req, res) => res.statusCode < 400,
    stream: {
        write: (message) => console.log(chalk.cyan(`➜ ${message.trim()}`))
    }
});

// Production logger
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
