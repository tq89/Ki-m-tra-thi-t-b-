'use strict';
/**
 * TEST SUITE: Authentication, Authorization & Security
 */

const TEST_DB = './data/test-auth.db';
process.env.NODE_ENV = 'test';
process.env.DB_PATH  = TEST_DB;
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.BCRYPT_ROUNDS = '1';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_FILE  = './logs/test.log';

const { createTestDb, cleanupTestDb } = require('../helpers/setupTestEnv');
createTestDb(TEST_DB); // Chạy đồng bộ trước khi app load

const request = require('supertest');
const { app }  = require('../../src/app');

let adminToken = null;

afterAll(() => cleanupTestDb(TEST_DB));

// ─────────────────────────────────────────────────────────
describe('[HEALTH] Kiểm tra server', () => {
  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('[AUTH] Đăng nhập', () => {
  test('Đăng nhập thành công → nhận access_token + refresh_token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@pccc.vn', mat_khau: 'Admin@123456' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.user.vai_tro).toBe('admin');
    adminToken = res.body.access_token;
  });

  test('Sai mật khẩu → 401, thông báo chung (không tiết lộ lý do)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@pccc.vn', mat_khau: 'SaiMatKhau!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/email hoặc mật khẩu/i);
  });

  test('Email không tồn tại → 401 (cùng thông báo với sai mật khẩu)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'khong@ton.tai', mat_khau: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/email hoặc mật khẩu/i);
  });

  test('Thiếu email → 422 validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ mat_khau: 'Admin@123' });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('fields');
  });

  test('Email sai định dạng → 422 validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'khong-phai-email', mat_khau: 'Admin@123' });
    expect(res.status).toBe(422);
  });
});

describe('[AUTH] Bảo vệ route', () => {
  test('Không có token → 401', async () => {
    const res = await request(app).get('/api/v1/thiet-bi');
    expect(res.status).toBe(401);
  });

  test('Token giả → 401', async () => {
    const res = await request(app)
      .get('/api/v1/thiet-bi')
      .set('Authorization', 'Bearer fake.jwt.token');
    expect(res.status).toBe(401);
  });

  test('Token hết hạn → 401 + code TOKEN_EXPIRED', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { sub: 'fake', vai_tro: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s', issuer: 'pccc-system' }
    );
    const res = await request(app)
      .get('/api/v1/thiet-bi')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });
});

describe('[AUTH] /me', () => {
  test('GET /me với token hợp lệ → thông tin user, không có mat_khau', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@pccc.vn');
    expect(res.body).not.toHaveProperty('mat_khau');  // SECURITY CHECK
  });
});

describe('[SECURITY] SQL Injection', () => {
  test("SQL Injection trong email → không được trả 200", async () => {
    const payloads = [
      "' OR 1=1; --",
      "' OR '1'='1",
      "admin'--",
      "'; DROP TABLE nguoi_dung; --",
    ];
    for (const payload of payloads) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: payload, mat_khau: 'anything' });
      expect([401, 422]).toContain(res.status);
    }
  });
});

describe('[SECURITY] Headers bảo mật', () => {
  test('Response có X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('Response KHÔNG có X-Powered-By (ẩn tech stack)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('[SECURITY] Path traversal', () => {
  test('Truy cập path không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/v1/khong-ton-tai')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
