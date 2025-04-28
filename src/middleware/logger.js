const chalk = require('chalk');

const requestLogger = (req, res, next) => {
    console.log(chalk.cyan(`➜ ${req.method} ${req.originalUrl}`));
    next();
};

module.exports = requestLogger;
