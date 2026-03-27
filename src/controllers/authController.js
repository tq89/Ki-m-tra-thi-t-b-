'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { body } = require('express-validator');
const UserModel = require('../models/UserModel');
const { getDb } = require('../config/database');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, vai_tro: user.vai_tro },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN, issuer: 'pccc-system' }
  );
  const refreshToken = uuidv4() + '-' + crypto.randomBytes(32).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Lưu refresh token (hash) vào DB, expire 7 ngày
  getDb().prepare(`
    INSERT INTO refresh_tokens(id, nguoi_dung_id, token_hash, expires_at)
    VALUES (?, ?, ?, datetime('now', '+7 days'))
  `).run(uuidv4(), user.id, refreshHash);

  return { accessToken, refreshToken };
}

// Validation rules
const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
  body('mat_khau').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
];

async function login(req, res, next) {
  try {
    const { email, mat_khau } = req.body;
    const user = UserModel.findByEmail(email);

    // SECURITY: Luôn trả thông báo chung, không phân biệt "sai email" hay "sai mật khẩu"
    if (!user || !UserModel.verifyPassword(mat_khau, user.mat_khau)) {
      logger.warn('Đăng nhập thất bại', { email, ip: req.ip });
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    if (user.trang_thai !== 'hoat_dong') {
      return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    }

    UserModel.updateLastLogin(user.id);
    const { accessToken, refreshToken } = generateTokens(user);

    logger.info('Đăng nhập thành công', { userId: user.id, ip: req.ip });

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: JWT_EXPIRES_IN,
      user: { id: user.id, ho_ten: user.ho_ten, email: user.email, vai_tro: user.vai_tro },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token là bắt buộc' });

    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const db = getDb();
    const stored = db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')
    `).get(hash);

    if (!stored) return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });

    // Rotate: vô hiệu hoá token cũ
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);

    const user = UserModel.findById(stored.nguoi_dung_id);
    if (!user || user.trang_thai !== 'hoat_dong') {
      return res.status(401).json({ error: 'Tài khoản không hợp lệ' });
    }

    const tokens = generateTokens(user);
    res.json({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      getDb().prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(hash);
    }
    res.json({ message: 'Đăng xuất thành công' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = UserModel.findById(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, me, loginRules };
