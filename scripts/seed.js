#!/usr/bin/env node
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = new Database(process.env.DB_PATH || './data/pccc.db');
db.pragma('foreign_keys = ON');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

console.log('[SEED] Bắt đầu tạo dữ liệu mẫu...');

const seedAll = db.transaction(() => {
  // ---- Loại thiết bị ----
  const loaiList = [
    { id: uuidv4(), ten: 'Bình chữa cháy xách tay',   chu_ky: 180 },
    { id: uuidv4(), ten: 'Bình chữa cháy xe đẩy',     chu_ky: 180 },
    { id: uuidv4(), ten: 'Đầu phun Sprinkler',          chu_ky: 365 },
    { id: uuidv4(), ten: 'Họng nước chữa cháy',        chu_ky: 90  },
    { id: uuidv4(), ten: 'Cảm biến khói',              chu_ky: 90  },
    { id: uuidv4(), ten: 'Chuông/đèn báo cháy',        chu_ky: 90  },
    { id: uuidv4(), ten: 'Bơm chữa cháy',              chu_ky: 30  },
    { id: uuidv4(), ten: 'Đèn exit / đèn sự cố',       chu_ky: 90  },
  ];

  const insLoai = db.prepare(`
    INSERT OR IGNORE INTO loai_thiet_bi(id, ten, chu_ky_kiem_tra_ngay)
    VALUES (@id, @ten, @chu_ky)
  `);
  loaiList.forEach(l => insLoai.run(l));
  console.log('[SEED] ✓ Loại thiết bị:', loaiList.length);

  // ---- Tòa nhà ----
  const toaNhaList = [
    { id: uuidv4(), ten: 'Tòa nhà A - Văn phòng', dia_chi: '123 Nguyễn Huệ, Q1, TP.HCM', so_tang: 15 },
    { id: uuidv4(), ten: 'Kho hàng B',            dia_chi: '45 Bình Dương',                so_tang: 2  },
    { id: uuidv4(), ten: 'Nhà máy C',             dia_chi: '78 KCN Biên Hòa, Đồng Nai',   so_tang: 3  },
  ];
  const insToaNha = db.prepare(`
    INSERT OR IGNORE INTO toa_nha(id, ten, dia_chi, so_tang)
    VALUES (@id, @ten, @dia_chi, @so_tang)
  `);
  toaNhaList.forEach(t => insToaNha.run(t));
  console.log('[SEED] ✓ Tòa nhà:', toaNhaList.length);

  // ---- Người dùng ----
  const users = [
    { id: uuidv4(), ho_ten: 'Admin Hệ Thống',      email: 'admin@pccc.vn',    password: 'Admin@123456', vai_tro: 'admin' },
    { id: uuidv4(), ho_ten: 'Nguyễn Văn Quản Lý',  email: 'quanly@pccc.vn',   password: 'QuanLy@123',  vai_tro: 'quan_ly' },
    { id: uuidv4(), ho_ten: 'Trần Thị Kiểm Tra A', email: 'ktv1@pccc.vn',     password: 'KiemTra@123', vai_tro: 'kiem_tra_vien' },
    { id: uuidv4(), ho_ten: 'Lê Văn Kiểm Tra B',   email: 'ktv2@pccc.vn',     password: 'KiemTra@456', vai_tro: 'kiem_tra_vien' },
  ];
  const insUser = db.prepare(`
    INSERT OR IGNORE INTO nguoi_dung(id, ho_ten, email, mat_khau, vai_tro)
    VALUES (@id, @ho_ten, @email, @mat_khau, @vai_tro)
  `);
  users.forEach(u => {
    const hash = bcrypt.hashSync(u.password, BCRYPT_ROUNDS);
    insUser.run({ ...u, mat_khau: hash });
  });
  console.log('[SEED] ✓ Người dùng:', users.length);
  console.log('[SEED]   Tài khoản mẫu:');
  users.forEach(u => console.log(`[SEED]     ${u.email} / ${u.password} (${u.vai_tro})`));

  // ---- Thiết bị mẫu ----
  const binhCC = loaiList[0].id;
  const hopHong = loaiList[3].id;
  const camBienKhoi = loaiList[4].id;
  const bom = loaiList[6].id;

  const thietBiList = [
    { id: uuidv4(), ma: 'BCH-A-001', ten: 'Bình CO2 3kg Tầng 1', loai_id: binhCC,    toa_nha_id: toaNhaList[0].id, vi_tri: 'Hành lang tầng 1', so_serial: 'SN2024001', ngay_lap_dat: '2024-01-15', ngay_het_han: '2026-01-15', trang_thai: 'tot',        ngay_tiep: '2026-04-15', created_by: users[0].id },
    { id: uuidv4(), ma: 'BCH-A-002', ten: 'Bình Bột ABC 4kg Tầng 3', loai_id: binhCC, toa_nha_id: toaNhaList[0].id, vi_tri: 'Phòng server tầng 3', so_serial: 'SN2024002', ngay_lap_dat: '2024-01-15', ngay_het_han: '2026-01-15', trang_thai: 'can_kiem_tra', ngay_tiep: '2026-01-01', created_by: users[0].id },
    { id: uuidv4(), ma: 'HN-A-001',  ten: 'Họng nước tầng 5',       loai_id: hopHong,   toa_nha_id: toaNhaList[0].id, vi_tri: 'Cuối hành lang tầng 5', so_serial: null, ngay_lap_dat: '2023-06-01', ngay_het_han: null, trang_thai: 'hong',         ngay_tiep: '2025-12-01', created_by: users[0].id },
    { id: uuidv4(), ma: 'CBK-B-001', ten: 'Cảm biến khói Kho B',    loai_id: camBienKhoi, toa_nha_id: toaNhaList[1].id, vi_tri: 'Khu vực chứa hàng A', so_serial: 'CBK-2023', ngay_lap_dat: '2023-03-20', ngay_het_han: null, trang_thai: 'tot',        ngay_tiep: '2026-06-20', created_by: users[0].id },
    { id: uuidv4(), ma: 'BOM-C-001', ten: 'Bơm chữa cháy chính',    loai_id: bom,     toa_nha_id: toaNhaList[2].id, vi_tri: 'Phòng bơm tầng hầm', so_serial: 'PUMP-001', ngay_lap_dat: '2022-11-10', ngay_het_han: null, trang_thai: 'bao_tri',    ngay_tiep: '2026-04-10', created_by: users[0].id },
  ];

  const insThietBi = db.prepare(`
    INSERT OR IGNORE INTO thiet_bi(id, ma_thiet_bi, ten, loai_id, toa_nha_id, vi_tri, so_serial, ngay_lap_dat, ngay_het_han, trang_thai, ngay_kiem_tra_tiep_theo, created_by)
    VALUES (@id, @ma, @ten, @loai_id, @toa_nha_id, @vi_tri, @so_serial, @ngay_lap_dat, @ngay_het_han, @trang_thai, @ngay_tiep, @created_by)
  `);
  thietBiList.forEach(t => insThietBi.run(t));
  console.log('[SEED] ✓ Thiết bị:', thietBiList.length);

  return { users, loaiList, toaNhaList, thietBiList };
});

try {
  seedAll();
  console.log('[SEED] ✓ Hoàn thành — Database sẵn sàng sử dụng');
} catch (err) {
  console.error('[SEED] ✗ Lỗi:', err.message);
  process.exit(1);
} finally {
  db.close();
}
