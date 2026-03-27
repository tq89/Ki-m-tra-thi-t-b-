'use strict';

const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware xác thực JWT.
 * SECURITY: Không để lộ lý do cụ thể khi token lỗi (tránh information leakage).
 */
function authenticate(req, res, next) {
  if (!JWT_SECRET) {
    logger.error('JWT_SECRET chưa được cấu hình — từ chối mọi request');
    return res.status(500).json({ error: 'Lỗi cấu hình server' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu xác thực' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'pccc-system',
    });

    // Kiểm tra người dùng còn tồn tại & chưa bị khoá
    const db = getDb();
    const user = db.prepare(
      'SELECT id, vai_tro, trang_thai FROM nguoi_dung WHERE id = ?'
    ).get(payload.sub);

    if (!user || user.trang_thai !== 'hoat_dong') {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
    }

    req.user = { id: user.id, vai_tro: user.vai_tro };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Phiên đăng nhập hết hạn', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('JWT verify thất bại', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: 'Yêu cầu xác thực' });
  }
}

/**
 * Factory: kiểm tra vai trò người dùng.
 * @param {...string} roles - Danh sách vai trò được phép
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Yêu cầu xác thực' });
    if (!roles.includes(req.user.vai_tro)) {
      logger.warn('Từ chối truy cập do không đủ quyền', {
        userId: req.user.id, vai_tro: req.user.vai_tro, required: roles,
      });
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
