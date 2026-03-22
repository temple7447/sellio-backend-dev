const discordLogger = require('../utils/discordLogger');

const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    discordLogger.request(req);
    
    const originalSend = res.send;
    res.send = function(body) {
        res.send = originalSend;
        const responseTime = Date.now() - start;
        
        let responseData = null;
        try {
            if (body) {
                responseData = typeof body === 'string' ? JSON.parse(body) : body;
            }
        } catch (e) {
            responseData = body;
        }
        
        const statusCode = res.statusCode || 200;
        if (statusCode >= 400) {
            discordLogger.response(req, res, responseData);
        }
        
        return res.send(body);
    };
    
    next();
};

module.exports = requestLogger;
