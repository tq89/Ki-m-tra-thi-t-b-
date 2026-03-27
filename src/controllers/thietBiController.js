'use strict';

const { body, param, query } = require('express-validator');
const ThietBiModel = require('../models/ThietBiModel');
const { getDb } = require('../config/database');

// Validation rules
const createRules = [
  body('ma_thiet_bi').trim().notEmpty().withMessage('Mã thiết bị là bắt buộc')
    .isLength({ max: 50 }).withMessage('Mã thiết bị tối đa 50 ký tự'),
  body('ten').trim().notEmpty().withMessage('Tên thiết bị là bắt buộc'),
  body('loai_id').isUUID().withMessage('Loại thiết bị không hợp lệ'),
  body('toa_nha_id').isUUID().withMessage('Tòa nhà không hợp lệ'),
  body('vi_tri').trim().notEmpty().withMessage('Vị trí là bắt buộc'),
  body('ngay_lap_dat').isDate().withMessage('Ngày lắp đặt không hợp lệ'),
  body('ngay_het_han').optional({ nullable: true }).isDate().withMessage('Ngày hết hạn không hợp lệ'),
  body('nam_san_xuat').optional({ nullable: true }).isInt({ min: 1990, max: 2100 }),
];

const updateRules = [
  param('id').isUUID(),
  body('trang_thai').optional().isIn(['tot', 'can_kiem_tra', 'hong', 'bao_tri', 'thanh_ly']),
  body('ngay_het_han').optional({ nullable: true }).isDate(),
  body('ngay_kiem_tra_tiep_theo').optional({ nullable: true }).isDate(),
];

async function list(req, res, next) {
  try {
    const result = ThietBiModel.list({
      toa_nha_id: req.query.toa_nha_id,
      loai_id:    req.query.loai_id,
      trang_thai: req.query.trang_thai,
      qua_han:    req.query.qua_han,
      page:  parseInt(req.query.page)  || 1,
      limit: parseInt(req.query.limit) || 20,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const tb = ThietBiModel.findById(req.params.id);
    if (!tb) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
    res.json(tb);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    // Kiểm tra mã thiết bị trùng
    if (ThietBiModel.findByMa(req.body.ma_thiet_bi)) {
      return res.status(409).json({ error: `Mã thiết bị '${req.body.ma_thiet_bi}' đã tồn tại` });
    }
    // Kiểm tra loai_id và toa_nha_id tồn tại
    const db = getDb();
    if (!db.prepare('SELECT id FROM loai_thiet_bi WHERE id = ?').get(req.body.loai_id)) {
      return res.status(422).json({ error: 'Loại thiết bị không tồn tại' });
    }
    if (!db.prepare('SELECT id FROM toa_nha WHERE id = ?').get(req.body.toa_nha_id)) {
      return res.status(422).json({ error: 'Tòa nhà không tồn tại' });
    }
    const result = ThietBiModel.create(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const tb = ThietBiModel.findById(req.params.id);
    if (!tb) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
    const result = ThietBiModel.update(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function stats(req, res, next) {
  try {
    res.json(ThietBiModel.stats());
  } catch (err) { next(err); }
}

async function listQuaHan(req, res, next) {
  try {
    res.json(ThietBiModel.getQuaHan());
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, stats, listQuaHan, createRules, updateRules };
