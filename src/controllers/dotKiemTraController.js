'use strict';

const { body, param } = require('express-validator');
const DotKiemTraModel = require('../models/DotKiemTraModel');

const createRules = [
  body('ten').trim().notEmpty().withMessage('Tên đợt kiểm tra là bắt buộc'),
  body('ngay_bat_dau').isDate().withMessage('Ngày bắt đầu không hợp lệ'),
  body('toa_nha_id').optional().isUUID(),
];

const ketQuaRules = [
  param('id').isUUID(),
  body('thiet_bi_id').isUUID().withMessage('ID thiết bị không hợp lệ'),
  body('ket_qua').isIn(['dat', 'khong_dat', 'can_theo_doi', 'khong_kiem_tra_duoc'])
    .withMessage('Kết quả không hợp lệ'),
  body('muc_do_uu_tien').optional().isIn(['thap', 'binh_thuong', 'cao', 'khan_cap']),
];

async function list(req, res, next) {
  try {
    const result = DotKiemTraModel.list({
      trang_thai:     req.query.trang_thai,
      nguoi_kiem_tra: req.query.nguoi_kiem_tra,
      toa_nha_id:     req.query.toa_nha_id,
      page:  parseInt(req.query.page)  || 1,
      limit: parseInt(req.query.limit) || 20,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const dot = DotKiemTraModel.findById(req.params.id);
    if (!dot) return res.status(404).json({ error: 'Không tìm thấy đợt kiểm tra' });
    res.json(dot);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const result = DotKiemTraModel.create(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function getKetQua(req, res, next) {
  try {
    const dot = DotKiemTraModel.findById(req.params.id);
    if (!dot) return res.status(404).json({ error: 'Không tìm thấy đợt kiểm tra' });
    res.json(DotKiemTraModel.getKetQua(req.params.id));
  } catch (err) { next(err); }
}

async function addKetQua(req, res, next) {
  try {
    const dot = DotKiemTraModel.findById(req.params.id);
    if (!dot) return res.status(404).json({ error: 'Không tìm thấy đợt kiểm tra' });
    if (!['moi', 'dang_kiem_tra'].includes(dot.trang_thai)) {
      return res.status(409).json({ error: 'Đợt kiểm tra đã kết thúc, không thể ghi thêm kết quả' });
    }

    // Cập nhật trạng thái đợt → đang_kiem_tra nếu còn 'moi'
    if (dot.trang_thai === 'moi') {
      DotKiemTraModel.updateTrangThai(req.params.id, 'dang_kiem_tra');
    }

    const result = DotKiemTraModel.addKetQua(req.params.id, req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Thiết bị này đã có kết quả trong đợt kiểm tra' });
    }
    next(err);
  }
}

async function hoanThanh(req, res, next) {
  try {
    const dot = DotKiemTraModel.findById(req.params.id);
    if (!dot) return res.status(404).json({ error: 'Không tìm thấy đợt kiểm tra' });

    const validTransitions = {
      quan_ly: { from: ['moi', 'dang_kiem_tra', 'cho_phe_duyet'], to: 'hoan_thanh' },
      admin:   { from: ['moi', 'dang_kiem_tra', 'cho_phe_duyet'], to: 'hoan_thanh' },
      kiem_tra_vien: { from: ['dang_kiem_tra'], to: 'cho_phe_duyet' },
    };

    const rule = validTransitions[req.user.vai_tro];
    if (!rule || !rule.from.includes(dot.trang_thai)) {
      return res.status(409).json({ error: 'Không thể chuyển trạng thái đợt kiểm tra này' });
    }

    const result = DotKiemTraModel.updateTrangThai(req.params.id, rule.to, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, getKetQua, addKetQua, hoanThanh, createRules, ketQuaRules };
