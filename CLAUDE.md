# CLAUDE.md — Tài liệu hệ thống PCCC

> File này được Claude Code tự động đọc ở mỗi phiên làm việc.
> Cập nhật lần cuối: 2026-03-27

---

## 1. Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | Kiểm tra thiết bị PCCC |
| **Repository** | tq89/Ki-m-tra-thi-t-b- |
| **License** | GNU GPLv3 |
| **Trạng thái** | Prototype hoạt động — 43/43 tests pass |
| **Tech stack** | Node.js 18+ · Express 4 · SQLite (better-sqlite3) · JWT |

**Mục đích:** Số hóa quy trình kiểm tra, theo dõi thiết bị PCCC (Phòng Cháy Chữa Cháy).
Quản lý lịch kiểm tra định kỳ, ghi nhận kết quả hiện trường, cảnh báo tự động và báo cáo tuân thủ.

---

## 2. Cấu trúc thư mục

```
Ki-m-tra-thi-t-b-/
├── src/
│   ├── app.js                      ← Entry point Express (start server)
│   ├── config/
│   │   ├── database.js             ← Singleton SQLite connection (WAL mode)
│   │   ├── logger.js               ← Winston logger (file + console)
│   │   └── schema.sql.js           ← Schema SQL dùng chung (migrate + test)
│   ├── middleware/
│   │   ├── auth.js                 ← JWT authenticate + authorize(roles)
│   │   ├── auditLog.js             ← Ghi audit trail mọi thao tác
│   │   ├── errorHandler.js         ← Centralized error handler + 404
│   │   ├── rateLimiter.js          ← generalLimiter + authLimiter (brute-force)
│   │   └── validate.js             ← express-validator result checker
│   ├── models/
│   │   ├── UserModel.js            ← CRUD user, bcrypt, last_login
│   │   ├── ThietBiModel.js         ← CRUD thiết bị, stats, quá hạn
│   │   └── DotKiemTraModel.js      ← CRUD đợt + ghi kết quả (transaction)
│   ├── controllers/
│   │   ├── authController.js       ← login/refresh/logout/me + token rotation
│   │   ├── thietBiController.js    ← REST CRUD thiết bị
│   │   └── dotKiemTraController.js ← REST CRUD đợt + kết quả + state machine
│   └── routes/
│       └── index.js                ← Tất cả routes + middleware chain
├── scripts/
│   ├── migrate.js                  ← Tạo schema + triggers (chạy 1 lần)
│   └── seed.js                     ← Dữ liệu mẫu (4 user, 5 thiết bị)
├── tests/
│   ├── helpers/
│   │   └── setupTestEnv.js         ← Helper tạo/xoá test DB
│   └── integration/
│       ├── auth.test.js            ← 14 tests: auth, security, headers
│       ├── thietbi.test.js         ← 15 tests: CRUD thiết bị
│       └── workflow.test.js        ← 14 tests: nghiệp vụ đầy đủ
├── data/
│   └── pccc.db                     ← SQLite database (WAL mode)
├── logs/
│   ├── app.log                     ← Application log (JSON, rotate 10MB×5)
│   └── error.log                   ← Error-only log
├── .env                            ← Cấu hình local (không commit)
├── .env.example                    ← Template env vars
└── package.json
```

---

## 3. Database Schema

### Bảng chính

| Bảng | Mục đích | Quan hệ |
|---|---|---|
| `nguoi_dung` | Người dùng (admin/quan_ly/kiem_tra_vien) | — |
| `toa_nha` | Tòa nhà/khu vực | — |
| `loai_thiet_bi` | Loại thiết bị (8 loại mặc định) | — |
| `thiet_bi` | Thiết bị PCCC | → loai_thiet_bi, toa_nha |
| `dot_kiem_tra` | Đợt kiểm tra | → nguoi_dung, toa_nha |
| `ket_qua_kiem_tra` | Kết quả từng thiết bị | → dot_kiem_tra, thiet_bi |
| `canh_bao` | Cảnh báo tự động | → thiet_bi |
| `refresh_tokens` | Session management (hash, rotate) | → nguoi_dung |
| `audit_log` | Audit trail mọi thao tác | → nguoi_dung |

### Trạng thái thiết bị
`tot` → `can_kiem_tra` → `hong` / `bao_tri` → `thanh_ly`

Tự động cập nhật khi ghi kết quả kiểm tra:
- `dat` → `tot`
- `can_theo_doi` → `can_kiem_tra`
- `khong_dat` → `hong` + tạo `canh_bao`

### Trạng thái đợt kiểm tra (State Machine)
```
moi → dang_kiem_tra → cho_phe_duyet → hoan_thanh
                   ↘ huy
```
- KTV: `dang_kiem_tra` → `cho_phe_duyet`
- Admin/Quản lý: bất kỳ → `hoan_thanh` hoặc `huy`

---

## 4. API Endpoints

Base URL: `http://localhost:3000/api/v1`

| Method | Endpoint | Auth | Quyền | Mô tả |
|---|---|---|---|---|
| POST | `/auth/login` | Không | — | Đăng nhập |
| POST | `/auth/refresh` | Không | — | Refresh token |
| POST | `/auth/logout` | JWT | — | Đăng xuất |
| GET  | `/auth/me` | JWT | — | Thông tin bản thân |
| GET  | `/thiet-bi` | JWT | Tất cả | Danh sách (filter+page) |
| GET  | `/thiet-bi/stats` | JWT | Tất cả | Thống kê tổng quan |
| GET  | `/thiet-bi/qua-han` | JWT | Tất cả | Thiết bị quá hạn |
| GET  | `/thiet-bi/:id` | JWT | Tất cả | Chi tiết |
| POST | `/thiet-bi` | JWT | admin, quan_ly | Tạo mới |
| PATCH| `/thiet-bi/:id` | JWT | admin, quan_ly | Cập nhật |
| GET  | `/dot-kiem-tra` | JWT | Tất cả | Danh sách đợt |
| POST | `/dot-kiem-tra` | JWT | Tất cả | Tạo đợt |
| GET  | `/dot-kiem-tra/:id` | JWT | Tất cả | Chi tiết đợt |
| GET  | `/dot-kiem-tra/:id/ket-qua` | JWT | Tất cả | Kết quả trong đợt |
| POST | `/dot-kiem-tra/:id/ket-qua` | JWT | Tất cả | Ghi kết quả |
| PATCH| `/dot-kiem-tra/:id/hoan-thanh` | JWT | Tất cả | Chuyển trạng thái |
| GET  | `/health` | Không | — | Health check |

---

## 5. Tài khoản mẫu (Seed)

| Email | Mật khẩu | Vai trò |
|---|---|---|
| admin@pccc.vn | Admin@123456 | admin |
| quanly@pccc.vn | QuanLy@123 | quan_ly |
| ktv1@pccc.vn | KiemTra@123 | kiem_tra_vien |
| ktv2@pccc.vn | KiemTra@456 | kiem_tra_vien |

---

## 6. Bảo mật đã triển khai

| Layer | Biện pháp |
|---|---|
| HTTP Headers | Helmet: CSP, HSTS, nosniff, XSS filter, no X-Powered-By |
| Auth | JWT HS256, issuer check, user status check mỗi request |
| Token | Refresh token rotation, hash SHA-256 trong DB, revoke khi logout |
| Rate limit | General: 100 req/15min; Auth: 10 fail/15min (chống brute-force) |
| Validation | express-validator trên tất cả input |
| SQL Injection | Chỉ dùng prepared statements (better-sqlite3) |
| Error messages | Thông báo chung (không tiết lộ lý do cụ thể khi sai credentials) |
| CORS | Whitelist origin, credentials, maxAge |
| Audit log | Ghi mọi thao tác tạo/sửa kèm userId + IP |
| Password | bcrypt (12 rounds production, 1 round test) |
| Graceful shutdown | Đóng DB connection khi nhận SIGTERM/SIGINT |

---

## 7. Vận hành hệ thống

### Khởi động lần đầu
```bash
npm install
cp .env.example .env          # Điền JWT_SECRET dài tối thiểu 64 ký tự
node scripts/migrate.js       # Tạo DB schema
node scripts/seed.js          # Tạo dữ liệu mẫu
npm start                     # Production
npm run dev                   # Development (nodemon)
```

### Chạy tests
```bash
npm test                      # Tất cả (43 tests)
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:coverage         # Coverage report
```

### Logs
- `logs/app.log` — JSON format, rotate 10MB × 5 file
- `logs/error.log` — Chỉ lỗi, rotate 10MB × 3 file

---

## 8. Phân tích lỗi & Đề xuất tối ưu

### Lỗi phát hiện qua test
| # | Lỗi | Đã xử lý |
|---|---|---|
| 1 | DB test không có schema → SqliteError | ✅ Tách schema.sql.js dùng chung |
| 2 | Token hết hạn không trả `code: TOKEN_EXPIRED` | ✅ Thêm code field |
| 3 | Ghi kết quả trùng không bắt UNIQUE error đúng | ✅ Bắt message SQLite |
| 4 | State machine đợt kiểm tra thiếu validation | ✅ Thêm validTransitions |
| 5 | X-Powered-By lộ Express version | ✅ Helmet loại bỏ |

### Đề xuất tối ưu (ưu tiên cao → thấp)

**Bảo mật:**
- [ ] Thêm `argon2` thay `bcrypt` (chống timing attack tốt hơn)
- [ ] Implement CSRF protection cho web client
- [ ] Thêm `express-mongo-sanitize` style input sanitization
- [ ] Cấu hình TLS/HTTPS bắt buộc (reverse proxy nginx)
- [ ] Rotate JWT_SECRET định kỳ với key versioning

**Hiệu năng:**
- [ ] Connection pooling nếu chuyển sang PostgreSQL
- [ ] Redis cache cho stats/danh sách thiết bị (TTL 5 phút)
- [ ] Pagination cursor-based thay offset cho dataset lớn
- [ ] SQLite WAL checkpoint tự động (đã bật WAL mode)

**Tính năng còn thiếu:**
- [ ] Upload ảnh kết quả kiểm tra (multer + S3/MinIO)
- [ ] Gửi email cảnh báo (nodemailer)
- [ ] Export báo cáo PDF (puppeteer/pdfkit)
- [ ] API lịch sử kiểm tra theo thiết bị
- [ ] Dashboard thống kê theo thời gian
- [ ] Mobile API cho kiểm tra viên ngoài hiện trường

**Độ ổn định:**
- [ ] Health check endpoint nâng cao (DB ping, disk space)
- [ ] Graceful degradation khi DB bận
- [ ] Backup tự động SQLite DB (script cron)
- [ ] Monitoring: Prometheus metrics endpoint

---

## 9. Git Branches

| Branch | Mục đích |
|---|---|
| `main` | Production / stable |
| `claude/document-system-structure-SvzB5` | Branch phát triển hiện tại |

---

## 10. Lịch sử phát triển

| Ngày | Sự kiện |
|---|---|
| 2025-10-21 | Khởi tạo repository |
| 2026-03-27 | Tạo CLAUDE.md — tổng hợp context |
| 2026-03-27 | Build prototype đầy đủ: DB schema, 9 bảng, REST API, 43 tests |
