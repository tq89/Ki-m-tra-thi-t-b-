'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');

const DotKiemTraModel = {
  list({ trang_thai, nguoi_kiem_tra, toa_nha_id, page = 1, limit = 20 } = {}) {
    let where = [];
    let params = [];
    if (trang_thai)       { where.push('d.trang_thai = ?');       params.push(trang_thai); }
    if (nguoi_kiem_tra)   { where.push('d.nguoi_kiem_tra = ?');   params.push(nguoi_kiem_tra); }
    if (toa_nha_id)       { where.push('d.toa_nha_id = ?');       params.push(toa_nha_id); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const db = getDb();
    const total = db.prepare(
      `SELECT COUNT(*) as cnt FROM dot_kiem_tra d ${whereClause}`
    ).get(...params).cnt;

    const rows = db.prepare(`
      SELECT d.*,
        u.ho_ten as ten_nguoi_kiem_tra,
        p.ho_ten as ten_nguoi_phe_duyet,
        tn.ten as ten_toa_nha,
        (SELECT COUNT(*) FROM ket_qua_kiem_tra k WHERE k.dot_kiem_tra_id = d.id) as so_ket_qua,
        (SELECT COUNT(*) FROM ket_qua_kiem_tra k WHERE k.dot_kiem_tra_id = d.id AND k.ket_qua = 'dat') as so_dat,
        (SELECT COUNT(*) FROM ket_qua_kiem_tra k WHERE k.dot_kiem_tra_id = d.id AND k.ket_qua = 'khong_dat') as so_khong_dat
      FROM dot_kiem_tra d
      LEFT JOIN nguoi_dung u  ON d.nguoi_kiem_tra  = u.id
      LEFT JOIN nguoi_dung p  ON d.nguoi_phe_duyet = p.id
      LEFT JOIN toa_nha tn    ON d.toa_nha_id       = tn.id
      ${whereClause}
      ORDER BY d.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { data: rows, total, page, limit };
  },

  findById(id) {
    return getDb().prepare(`
      SELECT d.*,
        u.ho_ten as ten_nguoi_kiem_tra,
        p.ho_ten as ten_nguoi_phe_duyet,
        tn.ten as ten_toa_nha
      FROM dot_kiem_tra d
      LEFT JOIN nguoi_dung u  ON d.nguoi_kiem_tra  = u.id
      LEFT JOIN nguoi_dung p  ON d.nguoi_phe_duyet = p.id
      LEFT JOIN toa_nha tn    ON d.toa_nha_id       = tn.id
      WHERE d.id = ?
    `).get(id);
  },

  create(data, userId) {
    const id = uuidv4();
    getDb().prepare(`
      INSERT INTO dot_kiem_tra(id, ten, mo_ta, toa_nha_id, nguoi_kiem_tra, ngay_bat_dau, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.ten, data.mo_ta || null, data.toa_nha_id || null,
           data.nguoi_kiem_tra || userId, data.ngay_bat_dau, data.ghi_chu || null);
    return this.findById(id);
  },

  updateTrangThai(id, trang_thai, pheduyet_id = null) {
    const db = getDb();
    const now = "datetime('now','localtime')";
    if (trang_thai === 'hoan_thanh' || trang_thai === 'cho_phe_duyet') {
      db.prepare(`
        UPDATE dot_kiem_tra
        SET trang_thai = ?, nguoi_phe_duyet = ?, ngay_phe_duyet = ${now}
        WHERE id = ?
      `).run(trang_thai, pheduyet_id, id);
    } else {
      db.prepare('UPDATE dot_kiem_tra SET trang_thai = ? WHERE id = ?').run(trang_thai, id);
    }
    return this.findById(id);
  },

  getKetQua(dotId) {
    return getDb().prepare(`
      SELECT kq.*, tb.ma_thiet_bi, tb.ten as ten_thiet_bi, tb.vi_tri,
             u.ho_ten as ten_nguoi_kiem_tra
      FROM ket_qua_kiem_tra kq
      LEFT JOIN thiet_bi tb ON kq.thiet_bi_id = tb.id
      LEFT JOIN nguoi_dung u ON kq.nguoi_kiem_tra = u.id
      WHERE kq.dot_kiem_tra_id = ?
      ORDER BY kq.thoi_gian ASC
    `).all(dotId);
  },

  addKetQua(dotId, data, userId) {
    const db = getDb();
    const id = uuidv4();

    // Dùng transaction: ghi kết quả + cập nhật trạng thái thiết bị
    const doInsert = db.transaction(() => {
      db.prepare(`
        INSERT INTO ket_qua_kiem_tra(
          id, dot_kiem_tra_id, thiet_bi_id, ket_qua, mo_ta_loi,
          muc_do_uu_tien, hinh_anh, ghi_chu, nguoi_kiem_tra
        ) VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        id, dotId, data.thiet_bi_id, data.ket_qua,
        data.mo_ta_loi || null, data.muc_do_uu_tien || 'binh_thuong',
        data.hinh_anh || null, data.ghi_chu || null, userId
      );

      // Cập nhật trạng thái thiết bị theo kết quả
      const trangThaiMoi = data.ket_qua === 'khong_dat' ? 'hong'
        : data.ket_qua === 'can_theo_doi' ? 'can_kiem_tra' : 'tot';

      db.prepare('UPDATE thiet_bi SET trang_thai = ? WHERE id = ?')
        .run(trangThaiMoi, data.thiet_bi_id);

      // Nếu không đạt → tạo cảnh báo
      if (data.ket_qua === 'khong_dat') {
        db.prepare(`
          INSERT INTO canh_bao(id, loai, thiet_bi_id, noi_dung, muc_do)
          VALUES (?, 'khong_dat', ?, ?, ?)
        `).run(
          uuidv4(), data.thiet_bi_id,
          `Thiết bị không đạt trong đợt kiểm tra: ${data.mo_ta_loi || ''}`,
          data.muc_do_uu_tien === 'khan_cap' ? 'khan_cap' : 'cao'
        );
      }
    });

    doInsert();
    return db.prepare('SELECT * FROM ket_qua_kiem_tra WHERE id = ?').get(id);
  },
};

module.exports = DotKiemTraModel;
