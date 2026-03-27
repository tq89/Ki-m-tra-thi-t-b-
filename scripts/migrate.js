#!/usr/bin/env node
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/pccc.db';
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Bật WAL mode: tăng hiệu năng read/write đồng thời
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

const schema = `
-- =========================================
-- BẢNG: nguoi_dung (Users)
-- =========================================
CREATE TABLE IF NOT EXISTS nguoi_dung (
  id          TEXT PRIMARY KEY,
  ho_ten      TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  mat_khau    TEXT NOT NULL,
  vai_tro     TEXT NOT NULL CHECK(vai_tro IN ('admin', 'quan_ly', 'kiem_tra_vien')),
  trang_thai  TEXT NOT NULL DEFAULT 'hoat_dong' CHECK(trang_thai IN ('hoat_dong', 'khoa')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_login  TEXT
);

-- =========================================
-- BẢNG: toa_nha (Buildings)
-- =========================================
CREATE TABLE IF NOT EXISTS toa_nha (
  id          TEXT PRIMARY KEY,
  ten         TEXT NOT NULL,
  dia_chi     TEXT NOT NULL,
  so_tang     INTEGER NOT NULL DEFAULT 1,
  mo_ta       TEXT,
  trang_thai  TEXT NOT NULL DEFAULT 'hoat_dong' CHECK(trang_thai IN ('hoat_dong', 'ngung')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =========================================
-- BẢNG: loai_thiet_bi (Equipment Types)
-- =========================================
CREATE TABLE IF NOT EXISTS loai_thiet_bi (
  id          TEXT PRIMARY KEY,
  ten         TEXT NOT NULL UNIQUE,
  mo_ta       TEXT,
  chu_ky_kiem_tra_ngay  INTEGER NOT NULL DEFAULT 90,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =========================================
-- BẢNG: thiet_bi (Equipment)
-- =========================================
CREATE TABLE IF NOT EXISTS thiet_bi (
  id              TEXT PRIMARY KEY,
  ma_thiet_bi     TEXT NOT NULL UNIQUE,
  ten             TEXT NOT NULL,
  loai_id         TEXT NOT NULL REFERENCES loai_thiet_bi(id),
  toa_nha_id      TEXT NOT NULL REFERENCES toa_nha(id) ON DELETE RESTRICT,
  vi_tri          TEXT NOT NULL,
  so_serial       TEXT,
  nha_san_xuat    TEXT,
  nam_san_xuat    INTEGER,
  ngay_lap_dat    TEXT NOT NULL,
  ngay_het_han    TEXT,
  trang_thai      TEXT NOT NULL DEFAULT 'tot' CHECK(trang_thai IN ('tot', 'can_kiem_tra', 'hong', 'bao_tri', 'thanh_ly')),
  ngay_kiem_tra_tiep_theo  TEXT,
  ghi_chu         TEXT,
  created_by      TEXT REFERENCES nguoi_dung(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =========================================
-- BẢNG: dot_kiem_tra (Inspection Rounds)
-- =========================================
CREATE TABLE IF NOT EXISTS dot_kiem_tra (
  id              TEXT PRIMARY KEY,
  ten             TEXT NOT NULL,
  mo_ta           TEXT,
  toa_nha_id      TEXT REFERENCES toa_nha(id),
  nguoi_kiem_tra  TEXT NOT NULL REFERENCES nguoi_dung(id),
  nguoi_phe_duyet TEXT REFERENCES nguoi_dung(id),
  trang_thai      TEXT NOT NULL DEFAULT 'moi' CHECK(trang_thai IN ('moi', 'dang_kiem_tra', 'cho_phe_duyet', 'hoan_thanh', 'huy')),
  ngay_bat_dau    TEXT NOT NULL,
  ngay_ket_thuc   TEXT,
  ngay_phe_duyet  TEXT,
  ghi_chu         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =========================================
-- BẢNG: ket_qua_kiem_tra (Inspection Results)
-- =========================================
CREATE TABLE IF NOT EXISTS ket_qua_kiem_tra (
  id              TEXT PRIMARY KEY,
  dot_kiem_tra_id TEXT NOT NULL REFERENCES dot_kiem_tra(id) ON DELETE CASCADE,
  thiet_bi_id     TEXT NOT NULL REFERENCES thiet_bi(id) ON DELETE RESTRICT,
  ket_qua         TEXT NOT NULL CHECK(ket_qua IN ('dat', 'khong_dat', 'can_theo_doi', 'khong_kiem_tra_duoc')),
  mo_ta_loi       TEXT,
  muc_do_uu_tien  TEXT DEFAULT 'binh_thuong' CHECK(muc_do_uu_tien IN ('thap', 'binh_thuong', 'cao', 'khan_cap')),
  hinh_anh        TEXT,
  ghi_chu         TEXT,
  nguoi_kiem_tra  TEXT NOT NULL REFERENCES nguoi_dung(id),
  thoi_gian       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(dot_kiem_tra_id, thiet_bi_id)
);

-- =========================================
-- BẢNG: canh_bao (Alerts)
-- =========================================
CREATE TABLE IF NOT EXISTS canh_bao (
  id          TEXT PRIMARY KEY,
  loai        TEXT NOT NULL CHECK(loai IN ('qua_han_kiem_tra', 'thiet_bi_hong', 'can_bao_tri', 'khong_dat')),
  thiet_bi_id TEXT REFERENCES thiet_bi(id) ON DELETE CASCADE,
  noi_dung    TEXT NOT NULL,
  muc_do      TEXT NOT NULL DEFAULT 'trung_binh' CHECK(muc_do IN ('thap', 'trung_binh', 'cao', 'khan_cap')),
  trang_thai  TEXT NOT NULL DEFAULT 'moi' CHECK(trang_thai IN ('moi', 'da_xem', 'da_xu_ly')),
  nguoi_nhan  TEXT REFERENCES nguoi_dung(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  xu_ly_luc   TEXT
);

-- =========================================
-- BẢNG: refresh_tokens (Session Management)
-- =========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  nguoi_dung_id TEXT NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  revoked     INTEGER NOT NULL DEFAULT 0
);

-- =========================================
-- BẢNG: audit_log (Audit Trail)
-- =========================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  nguoi_dung_id TEXT REFERENCES nguoi_dung(id),
  hanh_dong   TEXT NOT NULL,
  doi_tuong   TEXT,
  doi_tuong_id TEXT,
  du_lieu_cu  TEXT,
  du_lieu_moi TEXT,
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX IF NOT EXISTS idx_thiet_bi_toa_nha ON thiet_bi(toa_nha_id);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_loai ON thiet_bi(loai_id);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_trang_thai ON thiet_bi(trang_thai);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_kiem_tra_tiep ON thiet_bi(ngay_kiem_tra_tiep_theo);
CREATE INDEX IF NOT EXISTS idx_dot_kiem_tra_nguoi ON dot_kiem_tra(nguoi_kiem_tra);
CREATE INDEX IF NOT EXISTS idx_dot_kiem_tra_toa_nha ON dot_kiem_tra(toa_nha_id);
CREATE INDEX IF NOT EXISTS idx_ket_qua_dot ON ket_qua_kiem_tra(dot_kiem_tra_id);
CREATE INDEX IF NOT EXISTS idx_ket_qua_thiet_bi ON ket_qua_kiem_tra(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_canh_bao_trang_thai ON canh_bao(trang_thai);
CREATE INDEX IF NOT EXISTS idx_audit_nguoi_dung ON audit_log(nguoi_dung_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
`;

try {
  db.exec(schema);
  console.log('[MIGRATE] ✓ Schema khởi tạo thành công');

  // Trigger tự động cập nhật updated_at
  const tables = ['nguoi_dung', 'toa_nha', 'thiet_bi', 'dot_kiem_tra'];
  tables.forEach(table => {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_updated_at
      AFTER UPDATE ON ${table}
      BEGIN
        UPDATE ${table} SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
      END;
    `);
  });
  console.log('[MIGRATE] ✓ Triggers cập nhật timestamp đã tạo');
  console.log('[MIGRATE] ✓ Database sẵn sàng tại:', DB_PATH);
} catch (err) {
  console.error('[MIGRATE] ✗ Lỗi:', err.message);
  process.exit(1);
} finally {
  db.close();
}
