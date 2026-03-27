'use strict';
/**
 * TEST SUITE: Mô phỏng quy trình nghiệp vụ đầy đủ
 * Kịch bản thực: KTV tạo đợt → ghi kết quả → nộp → Admin phê duyệt
 *                + cảnh báo tự động khi thiết bị không đạt
 */

const TEST_DB = './data/test-workflow.db';
process.env.NODE_ENV = 'test';
process.env.DB_PATH  = TEST_DB;
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.BCRYPT_ROUNDS = '1';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_FILE  = './logs/test.log';

const { createTestDb, cleanupTestDb } = require('../helpers/setupTestEnv');
const ids = createTestDb(TEST_DB);

const request = require('supertest');
jest.resetModules();
const { app } = require('../../src/app');

let adminToken, kvToken;
let dotId, dot2Id;

beforeAll(async () => {
  const [rA, rK] = await Promise.all([
    request(app).post('/api/v1/auth/login').send({ email: 'admin@pccc.vn', mat_khau: 'Admin@123456' }),
    request(app).post('/api/v1/auth/login').send({ email: 'ktv1@pccc.vn',  mat_khau: 'KiemTra@123' }),
  ]);
  adminToken = rA.body.access_token;
  kvToken    = rK.body.access_token;
});

afterAll(() => cleanupTestDb(TEST_DB));

// ─────────────────────────────────────────────────────────
describe('[WORKFLOW] Luồng kiểm tra đầy đủ: Tạo → Ghi kết quả → Phê duyệt', () => {

  test('STEP 1: KTV tạo đợt kiểm tra → trạng thái "moi"', async () => {
    const res = await request(app)
      .post('/api/v1/dot-kiem-tra')
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ ten: 'Đợt kiểm tra Q1/2026', ngay_bat_dau: '2026-03-27', toa_nha_id: ids.toaNhaId });
    expect(res.status).toBe(201);
    expect(res.body.trang_thai).toBe('moi');
    dotId = res.body.id;
  });

  test('STEP 2: Ghi kết quả "đạt" → đợt chuyển "dang_kiem_tra"', async () => {
    const res = await request(app)
      .post(`/api/v1/dot-kiem-tra/${dotId}/ket-qua`)
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ thiet_bi_id: ids.tbId, ket_qua: 'dat', ghi_chu: 'Áp suất bình thường' });
    expect(res.status).toBe(201);
    expect(res.body.ket_qua).toBe('dat');

    const dotRes = await request(app)
      .get(`/api/v1/dot-kiem-tra/${dotId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dotRes.body.trang_thai).toBe('dang_kiem_tra');
  });

  test('STEP 3: Ghi trùng thiết bị → 409', async () => {
    const res = await request(app)
      .post(`/api/v1/dot-kiem-tra/${dotId}/ket-qua`)
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ thiet_bi_id: ids.tbId, ket_qua: 'dat' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/đã có kết quả/);
  });

  test('STEP 4: Lấy danh sách kết quả → đầy đủ', async () => {
    const res = await request(app)
      .get(`/api/v1/dot-kiem-tra/${dotId}/ket-qua`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty('ma_thiet_bi', 'BCH-TEST-001');
  });

  test('STEP 5: KTV nộp đợt → chuyển "cho_phe_duyet"', async () => {
    const res = await request(app)
      .patch(`/api/v1/dot-kiem-tra/${dotId}/hoan-thanh`)
      .set('Authorization', `Bearer ${kvToken}`);
    expect(res.status).toBe(200);
    expect(res.body.trang_thai).toBe('cho_phe_duyet');
  });

  test('STEP 6: Admin phê duyệt → chuyển "hoan_thanh"', async () => {
    const res = await request(app)
      .patch(`/api/v1/dot-kiem-tra/${dotId}/hoan-thanh`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.trang_thai).toBe('hoan_thanh');
  });

  test('STEP 7: Ghi kết quả vào đợt đã hoàn thành → 409 block', async () => {
    const res = await request(app)
      .post(`/api/v1/dot-kiem-tra/${dotId}/ket-qua`)
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ thiet_bi_id: ids.tbQuaHanId, ket_qua: 'dat' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/đã kết thúc/);
  });
});

describe('[WORKFLOW] Cảnh báo tự động khi "không đạt"', () => {

  test('Tạo đợt kiểm tra thứ 2', async () => {
    const res = await request(app)
      .post('/api/v1/dot-kiem-tra')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ten: 'Đợt test cảnh báo', ngay_bat_dau: '2026-03-27' });
    expect(res.status).toBe(201);
    dot2Id = res.body.id;
  });

  test('Ghi thiết bị "khong_dat" → trạng thái thiết bị → "hong" + cảnh báo DB', async () => {
    const res = await request(app)
      .post(`/api/v1/dot-kiem-tra/${dot2Id}/ket-qua`)
      .set('Authorization', `Bearer ${kvToken}`)
      .send({
        thiet_bi_id: ids.tbQuaHanId,
        ket_qua: 'khong_dat',
        mo_ta_loi: 'Van rỉ sét, bình xẹp',
        muc_do_uu_tien: 'khan_cap',
      });
    expect(res.status).toBe(201);

    // Thiết bị phải chuyển → hong
    const tbRes = await request(app)
      .get(`/api/v1/thiet-bi/${ids.tbQuaHanId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(tbRes.body.trang_thai).toBe('hong');

    // Cảnh báo phải tồn tại trong DB
    const Database = require('better-sqlite3');
    const db = new Database(TEST_DB);
    const alert = db.prepare(
      "SELECT * FROM canh_bao WHERE thiet_bi_id = ? AND loai = 'khong_dat'"
    ).get(ids.tbQuaHanId);
    db.close();

    expect(alert).not.toBeNull();
    expect(alert.muc_do).toBe('khan_cap');
    expect(alert.trang_thai).toBe('moi');
  });

  test('Ghi "can_theo_doi" → trạng thái thiết bị → "can_kiem_tra"', async () => {
    // Dùng tbId (đã được reset → bao_tri từ test trước, dùng 1 đợt mới)
    const dotRes = await request(app)
      .post('/api/v1/dot-kiem-tra')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ten: 'Đợt test can_theo_doi', ngay_bat_dau: '2026-03-27' });
    const dot3Id = dotRes.body.id;

    const res = await request(app)
      .post(`/api/v1/dot-kiem-tra/${dot3Id}/ket-qua`)
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ thiet_bi_id: ids.tbId, ket_qua: 'can_theo_doi', mo_ta_loi: 'Cần theo dõi áp suất' });
    expect(res.status).toBe(201);

    const tbRes = await request(app)
      .get(`/api/v1/thiet-bi/${ids.tbId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(tbRes.body.trang_thai).toBe('can_kiem_tra');
  });
});

describe('[SECURITY] Kiểm soát truy cập đợt kiểm tra', () => {
  test('Không có token → 401', async () => {
    const res = await request(app).get('/api/v1/dot-kiem-tra');
    expect(res.status).toBe(401);
  });

  test('Đợt không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/v1/dot-kiem-tra/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('Tạo đợt thiếu trường bắt buộc → 422', async () => {
    const res = await request(app)
      .post('/api/v1/dot-kiem-tra')
      .set('Authorization', `Bearer ${kvToken}`)
      .send({ mo_ta: 'Thiếu ten và ngay_bat_dau' });
    expect(res.status).toBe(422);
  });
});
