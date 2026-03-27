'use strict';

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const auditLog = require('../middleware/auditLog');

const auth = require('../controllers/authController');
const thietBi = require('../controllers/thietBiController');
const dotKiemTra = require('../controllers/dotKiemTraController');

// ── Auth ──────────────────────────────────────────────────
router.post('/auth/login',   authLimiter, auth.loginRules, validate, auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout',  authenticate, auth.logout);
router.get ('/auth/me',      authenticate, auth.me);

// ── Thiết bị ──────────────────────────────────────────────
router.get ('/thiet-bi',          authenticate, thietBi.list);
router.get ('/thiet-bi/stats',    authenticate, thietBi.stats);
router.get ('/thiet-bi/qua-han',  authenticate, thietBi.listQuaHan);
router.get ('/thiet-bi/:id',      authenticate, thietBi.getOne);
router.post('/thiet-bi',
  authenticate,
  authorize('admin', 'quan_ly'),
  thietBi.createRules, validate,
  auditLog('TAO_THIET_BI', 'thiet_bi'),
  thietBi.create
);
router.patch('/thiet-bi/:id',
  authenticate,
  authorize('admin', 'quan_ly'),
  thietBi.updateRules, validate,
  auditLog('CAP_NHAT_THIET_BI', 'thiet_bi'),
  thietBi.update
);

// ── Đợt kiểm tra ──────────────────────────────────────────
router.get ('/dot-kiem-tra',           authenticate, dotKiemTra.list);
router.get ('/dot-kiem-tra/:id',       authenticate, dotKiemTra.getOne);
router.get ('/dot-kiem-tra/:id/ket-qua', authenticate, dotKiemTra.getKetQua);
router.post('/dot-kiem-tra',
  authenticate,
  authorize('admin', 'quan_ly', 'kiem_tra_vien'),
  dotKiemTra.createRules, validate,
  auditLog('TAO_DOT_KIEM_TRA', 'dot_kiem_tra'),
  dotKiemTra.create
);
router.post('/dot-kiem-tra/:id/ket-qua',
  authenticate,
  authorize('admin', 'quan_ly', 'kiem_tra_vien'),
  dotKiemTra.ketQuaRules, validate,
  auditLog('GHI_KET_QUA', 'ket_qua_kiem_tra'),
  dotKiemTra.addKetQua
);
router.patch('/dot-kiem-tra/:id/hoan-thanh',
  authenticate,
  auditLog('HOAN_THANH_DOT_KIEM_TRA', 'dot_kiem_tra'),
  dotKiemTra.hoanThanh
);

// ── Health check (không cần auth) ─────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

module.exports = router;
