'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');

const ThietBiModel = {
  list({ toa_nha_id, loai_id, trang_thai, qua_han, page = 1, limit = 20 } = {}) {
    let where = [];
    let params = [];
    if (toa_nha_id) { where.push('tb.toa_nha_id = ?'); params.push(toa_nha_id); }
    if (loai_id)    { where.push('tb.loai_id = ?');    params.push(loai_id);    }
    if (trang_thai) { where.push('tb.trang_thai = ?'); params.push(trang_thai); }
    if (qua_han === 'true') {
      where.push("date(tb.ngay_kiem_tra_tiep_theo) < date('now')");
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const db = getDb();
    const total = db.prepare(
      `SELECT COUNT(*) as cnt FROM thiet_bi tb ${whereClause}`
    ).get(...params).cnt;

    const rows = db.prepare(`
      SELECT tb.*, l.ten as loai_ten, tn.ten as toa_nha_ten
      FROM thiet_bi tb
      LEFT JOIN loai_thiet_bi l ON tb.loai_id = l.id
      LEFT JOIN toa_nha tn ON tb.toa_nha_id = tn.id
      ${whereClause}
      ORDER BY tb.ngay_kiem_tra_tiep_theo ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { data: rows, total, page, limit };
  },

  findById(id) {
    return getDb().prepare(`
      SELECT tb.*, l.ten as loai_ten, l.chu_ky_kiem_tra_ngay,
             tn.ten as toa_nha_ten, tn.dia_chi as toa_nha_dia_chi
      FROM thiet_bi tb
      LEFT JOIN loai_thiet_bi l ON tb.loai_id = l.id
      LEFT JOIN toa_nha tn ON tb.toa_nha_id = tn.id
      WHERE tb.id = ?
    `).get(id);
  },

  findByMa(ma_thiet_bi) {
    return getDb().prepare('SELECT id FROM thiet_bi WHERE ma_thiet_bi = ?').get(ma_thiet_bi);
  },

  create(data, userId) {
    const id = uuidv4();
    getDb().prepare(`
      INSERT INTO thiet_bi(
        id, ma_thiet_bi, ten, loai_id, toa_nha_id, vi_tri,
        so_serial, nha_san_xuat, nam_san_xuat, ngay_lap_dat,
        ngay_het_han, trang_thai, ngay_kiem_tra_tiep_theo, ghi_chu, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.ma_thiet_bi, data.ten, data.loai_id, data.toa_nha_id, data.vi_tri,
      data.so_serial || null, data.nha_san_xuat || null, data.nam_san_xuat || null,
      data.ngay_lap_dat, data.ngay_het_han || null,
      data.trang_thai || 'tot',
      data.ngay_kiem_tra_tiep_theo || null,
      data.ghi_chu || null, userId
    );
    return this.findById(id);
  },

  update(id, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'ten','vi_tri','so_serial','nha_san_xuat','nam_san_xuat',
      'ngay_het_han','trang_thai','ngay_kiem_tra_tiep_theo','ghi_chu',
    ];
    allowed.forEach(f => {
      if (data[f] !== undefined) { fields.push(`${f} = ?`); values.push(data[f]); }
    });
    if (!fields.length) return this.findById(id);
    values.push(id);
    getDb().prepare(`UPDATE thiet_bi SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  // Lấy thiết bị quá hạn kiểm tra → tạo cảnh báo
  getQuaHan() {
    return getDb().prepare(`
      SELECT tb.id, tb.ma_thiet_bi, tb.ten, tb.toa_nha_id,
             tb.ngay_kiem_tra_tiep_theo,
             julianday('now') - julianday(tb.ngay_kiem_tra_tiep_theo) as so_ngay_qua_han
      FROM thiet_bi tb
      WHERE date(tb.ngay_kiem_tra_tiep_theo) < date('now')
        AND tb.trang_thai NOT IN ('thanh_ly')
    `).all();
  },

  // Thống kê tổng quan
  stats() {
    const db = getDb();
    const byTrangThai = db.prepare(`
      SELECT trang_thai, COUNT(*) as so_luong FROM thiet_bi GROUP BY trang_thai
    `).all();
    const quaHan = db.prepare(`
      SELECT COUNT(*) as cnt FROM thiet_bi
      WHERE date(ngay_kiem_tra_tiep_theo) < date('now') AND trang_thai != 'thanh_ly'
    `).get().cnt;
    const sapHan = db.prepare(`
      SELECT COUNT(*) as cnt FROM thiet_bi
      WHERE date(ngay_kiem_tra_tiep_theo) BETWEEN date('now') AND date('now', '+30 days')
        AND trang_thai != 'thanh_ly'
    `).get().cnt;

    return { byTrangThai, quaHan, sapHan };
  },
};

module.exports = ThietBiModel;
