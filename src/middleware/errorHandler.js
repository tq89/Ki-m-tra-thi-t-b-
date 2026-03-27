'use strict';

const logger = require('../config/logger');

/**
 * Centralized error handler — luôn là middleware cuối cùng.
 * SECURITY: Không trả về stack trace trong production.
 */
function errorHandler(err, req, res, next) {
  // Đã gửi response rồi → delegate cho Express default handler
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  logger[isServerError ? 'error' : 'warn']('Request error', {
    status,
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    stack: isServerError ? err.stack : undefined,
  });

  const body = { error: isServerError ? 'Lỗi hệ thống, vui lòng thử lại' : err.message };

  // Chỉ expose details trong development
  if (process.env.NODE_ENV === 'development' && isServerError) {
    body.detail = err.message;
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

/**
 * Bắt 404 cho các route không tồn tại.
 */
function notFound(req, res) {
  res.status(404).json({ error: `Không tìm thấy: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
