'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const handler = (req, res) => {
  logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
  res.status(429).json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' });
};

// Giới hạn chung toàn API
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Giới hạn nghiêm hơn cho authentication (chống brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // Chỉ đếm request thất bại
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded — brute force attempt?', { ip: req.ip });
    res.status(429).json({ error: 'Quá nhiều lần đăng nhập sai, thử lại sau 15 phút' });
  },
});

module.exports = { generalLimiter, authLimiter };
