'use strict';

/**
 * Helper chung cho test: tạo DB test riêng biệt (file path) với schema + seed.
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const schema = require('../../src/config/schema.sql.js');

function createTestDb(dbPath) {
  // Xoá file cũ nếu tồn tại
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(schema);

  // ---- Loại thiết bị ----
  const loaiId = uuidv4();
  db.prepare(`INSERT INTO loai_thiet_bi(id, ten, chu_ky_kiem_tra_ngay) VALUES (?, 'Bình chữa cháy', 180)`)
    .run(loaiId);

  // ---- Tòa nhà ----
  const toaNhaId = uuidv4();
  db.prepare(`INSERT INTO toa_nha(id, ten, dia_chi, so_tang) VALUES (?, 'Tòa A', '123 Test St', 5)`)
    .run(toaNhaId);

  // ---- Người dùng ----
  const adminId = uuidv4();
  const qlId    = uuidv4();
  const ktvId   = uuidv4();
  const ROUNDS  = 1; // nhanh cho test

  db.prepare(`INSERT INTO nguoi_dung(id, ho_ten, email, mat_khau, vai_tro) VALUES (?,?,?,?,?)`)
    .run(adminId, 'Admin Test', 'admin@pccc.vn', bcrypt.hashSync('Admin@123456', ROUNDS), 'admin');
  db.prepare(`INSERT INTO nguoi_dung(id, ho_ten, email, mat_khau, vai_tro) VALUES (?,?,?,?,?)`)
    .run(qlId, 'Quản Lý Test', 'quanly@pccc.vn', bcrypt.hashSync('QuanLy@123', ROUNDS), 'quan_ly');
  db.prepare(`INSERT INTO nguoi_dung(id, ho_ten, email, mat_khau, vai_tro) VALUES (?,?,?,?,?)`)
    .run(ktvId, 'KTV Test', 'ktv1@pccc.vn', bcrypt.hashSync('KiemTra@123', ROUNDS), 'kiem_tra_vien');

  // ---- Thiết bị mẫu ----
  const tbId = uuidv4();
  db.prepare(`
    INSERT INTO thiet_bi(id, ma_thiet_bi, ten, loai_id, toa_nha_id, vi_tri, ngay_lap_dat, trang_thai, ngay_kiem_tra_tiep_theo, created_by)
    VALUES (?, 'BCH-TEST-001', 'Bình CO2 Test', ?, ?, 'Tầng 1', '2024-01-01', 'tot', '2026-06-01', ?)
  `).run(tbId, loaiId, toaNhaId, adminId);

  // Thiết bị quá hạn
  const tbQuaHanId = uuidv4();
  db.prepare(`
    INSERT INTO thiet_bi(id, ma_thiet_bi, ten, loai_id, toa_nha_id, vi_tri, ngay_lap_dat, trang_thai, ngay_kiem_tra_tiep_theo, created_by)
    VALUES (?, 'BCH-QUAHAN-001', 'Bình quá hạn', ?, ?, 'Tầng 2', '2023-01-01', 'can_kiem_tra', '2025-01-01', ?)
  `).run(tbQuaHanId, loaiId, toaNhaId, adminId);

  db.close();

  return { loaiId, toaNhaId, adminId, qlId, ktvId, tbId, tbQuaHanId };
}

function cleanupTestDb(dbPath) {
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(f => {
    if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
  });
}

module.exports = { createTestDb, cleanupTestDb };
