'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

const UserModel = {
  findByEmail(email) {
    return getDb().prepare(
      'SELECT * FROM nguoi_dung WHERE email = ?'
    ).get(email.toLowerCase().trim());
  },

  findById(id) {
    return getDb().prepare(
      'SELECT id, ho_ten, email, vai_tro, trang_thai, created_at, last_login FROM nguoi_dung WHERE id = ?'
    ).get(id);
  },

  list({ vai_tro, trang_thai, page = 1, limit = 20 } = {}) {
    let where = [];
    let params = [];
    if (vai_tro)    { where.push('vai_tro = ?');   params.push(vai_tro);   }
    if (trang_thai) { where.push('trang_thai = ?'); params.push(trang_thai); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const db = getDb();
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM nguoi_dung ${whereClause}`).get(...params).cnt;
    const rows  = db.prepare(
      `SELECT id, ho_ten, email, vai_tro, trang_thai, created_at, last_login
       FROM nguoi_dung ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return { data: rows, total, page, limit };
  },

  create({ ho_ten, email, password, vai_tro }) {
    const id = uuidv4();
    const mat_khau = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    getDb().prepare(
      'INSERT INTO nguoi_dung(id, ho_ten, email, mat_khau, vai_tro) VALUES (?, ?, ?, ?, ?)'
    ).run(id, ho_ten, email.toLowerCase().trim(), mat_khau, vai_tro);
    return this.findById(id);
  },

  updateLastLogin(id) {
    getDb().prepare(
      "UPDATE nguoi_dung SET last_login = datetime('now','localtime') WHERE id = ?"
    ).run(id);
  },

  setTrangThai(id, trang_thai) {
    return getDb().prepare(
      'UPDATE nguoi_dung SET trang_thai = ? WHERE id = ?'
    ).run(trang_thai, id);
  },

  verifyPassword(plain, hash) {
    return bcrypt.compareSync(plain, hash);
  },

  changePassword(id, newPassword) {
    const hash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    return getDb().prepare(
      'UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?'
    ).run(hash, id);
  },
};

module.exports = UserModel;
