'use strict';
/**
 * TEST SUITE: Quản lý thiết bị PCCC
 */

const TEST_DB = './data/test-thietbi.db';
process.env.NODE_ENV = 'test';
process.env.DB_PATH  = TEST_DB;
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.BCRYPT_ROUNDS = '1';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_FILE  = './logs/test.log';

const { createTestDb, cleanupTestDb } = require('../helpers/setupTestEnv');
const ids = createTestDb(TEST_DB);

const request = require('supertest');
// Import app SAU khi đã set env & tạo DB
jest.resetModules();
const { app } = require('../../src/app');

let adminToken, qlToken, kvToken;

beforeAll(async () => {
  const [rA, rQ, rK] = await Promise.all([
    request(app).post('/api/v1/auth/login').send({ email: 'admin@pccc.vn',  mat_khau: 'Admin@123456' }),
    request(app).post('/api/v1/auth/login').send({ email: 'quanly@pccc.vn', mat_khau: 'QuanLy@123' }),
    request(app).post('/api/v1/auth/login').send({ email: 'ktv1@pccc.vn',   mat_khau: 'KiemTra@123' }),
  ]);
  adminToken = rA.body.access_token;
  qlToken    = rQ.body.access_token;
  kvToken    = rK.body.access_token;
});

afterAll(() => cleanupTestDb(TEST_DB));

// ─────────────────────────────────────────────────────────
describe('[THIET-BI] Danh sách & phân trang', () => {
  test('GET /thiet-bi → 200 với pagination', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  test('Filter trang_thai=tot → chỉ trả thiết bị tốt', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi?trang_thai=tot')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(tb => expect(tb.trang_thai).toBe('tot'));
  });

  test('Filter qua_han=true → trả thiết bị quá hạn', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi?qua_han=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('page quá lớn → data rỗng nhưng không lỗi', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi?page=9999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('[THIET-BI] Thống kê', () => {
  test('GET /stats → cấu trúc đúng', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byTrangThai');
    expect(res.body).toHaveProperty('quaHan');
    expect(res.body).toHaveProperty('sapHan');
    expect(res.body.quaHan).toBeGreaterThanOrEqual(1); // BCH-QUAHAN-001
  });
});

describe('[THIET-BI] Chi tiết', () => {
  test('GET /:id hợp lệ → chi tiết đầy đủ kèm join', async () => {
    const res = await request(app)
      .get(`/api/v1/thiet-bi/${ids.tbId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ids.tbId);
    expect(res.body).toHaveProperty('loai_ten');
    expect(res.body).toHaveProperty('toa_nha_ten');
  });

  test('GET /:id không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('[THIET-BI] Tạo thiết bị', () => {
  const base = {
    ten: 'Bình test mới',
    vi_tri: 'Tầng 3',
    ngay_lap_dat: '2025-06-01',
  };

  test('Admin tạo thiết bị thành công → 201', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, ma_thiet_bi: 'NEW-001', loai_id: ids.loaiId, toa_nha_id: ids.toaNhaId });
    expect(res.status).toBe(201);
    expect(res.body.trang_thai).toBe('tot');
  });

  test('Tạo trùng mã → 409 conflict', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, ma_thiet_bi: 'NEW-001', loai_id: ids.loaiId, toa_nha_id: ids.toaNhaId });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/đã tồn tại/);
  });

  test('Thiếu trường bắt buộc → 422 với chi tiết lỗi', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ten: 'Thiếu nhiều trường' });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('fields');
  });

  test('loai_id không tồn tại → 422', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, ma_thiet_bi: 'NEW-002', loai_id: '00000000-0000-0000-0000-000000000000', toa_nha_id: ids.toaNhaId });
    expect(res.status).toBe(422);
  });

  test('Kiểm tra viên KHÔNG được tạo thiết bị → 403', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ ...base, ma_thiet_bi: 'KTV-001', loai_id: ids.loaiId, toa_nha_id: ids.toaNhaId });
    expect(res.status).toBe(403);
  });

  test('Ngày lắp đặt sai định dạng → 422', async () => {
    const res = await request(app)
      .post('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, ma_thiet_bi: 'NEW-003', loai_id: ids.loaiId, toa_nha_id: ids.toaNhaId, ngay_lap_dat: 'khong-phai-ngay' });
    expect(res.status).toBe(422);
  });
});

describe('[THIET-BI] Cập nhật', () => {
  test('Cập nhật trạng thái → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/thiet-bi/${ids.tbId}`)
      .set('Authorization', `Bearer ${qlToken}`)
      .send({ trang_thai: 'bao_tri', ghi_chu: 'Bảo trì định kỳ' });
    expect(res.status).toBe(200);
    expect(res.body.trang_thai).toBe('bao_tri');
  });

  test('Trạng thái không hợp lệ → 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/thiet-bi/${ids.tbId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trang_thai: 'trang_thai_ao' });
    expect(res.status).toBe(422);
  });

  test('ID không tồn tại → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/thiet-bi/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trang_thai: 'tot' });
    expect(res.status).toBe(404);
  });
});
