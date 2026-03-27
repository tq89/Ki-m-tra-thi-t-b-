# CLAUDE.md — Tài liệu hệ thống (System Context)

> File này được Claude Code tự động đọc ở mỗi phiên làm việc.
> Cập nhật lần cuối: 2026-03-27

---

## 1. Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | Kiểm tra thiết bị PCCC |
| **Tên repository** | Ki-m-tra-thi-t-b- |
| **Chủ sở hữu** | tq89 |
| **License** | GNU GPLv3 |
| **Trạng thái** | Khởi tạo (chưa có source code) |
| **Ngày tạo** | 2025-10-21 |

**Mô tả:** Ứng dụng quản lý kiểm tra, thử nghiệm thiết bị PCCC (Phòng Cháy Chữa Cháy — Fire Safety Equipment). Mục tiêu là số hóa quy trình kiểm tra, theo dõi thiết bị và lập báo cáo tuân thủ an toàn phòng cháy.

---

## 2. Cấu trúc thư mục hiện tại

```
Ki-m-tra-thi-t-b-/
├── CLAUDE.md          ← File này (context cho Claude Code)
├── README.md          ← Mô tả ngắn dự án
└── LICENSE            ← GNU GPLv3
```

> **Lưu ý:** Chưa có source code. Cần bổ sung khi bắt đầu phát triển.

---

## 3. Git Branches

| Branch | Mục đích |
|---|---|
| `main` | Production / stable |
| `claude/document-system-structure-SvzB5` | Branch làm việc hiện tại |

**Remote:** `origin` → `https://github.com/tq89/ki-m-tra-thi-t-b-`

---

## 4. Tech Stack (chưa xác định)

Chưa có quyết định về công nghệ. Các lựa chọn tiềm năng phù hợp với domain:

- **Backend:** Node.js / Python (Django/FastAPI) / Go
- **Frontend:** React / Vue.js
- **Database:** PostgreSQL / MySQL / SQLite
- **Mobile:** React Native / Flutter (nếu cần app di động cho kiểm tra hiện trường)

---

## 5. Domain Logic — Kiểm tra thiết bị PCCC

### 5.1 Các thực thể chính (dự kiến)

```
ThietBi (Equipment)
  - id, ten, loai, serial, vi_tri, ngay_lap_dat
  - trang_thai (hoat_dong / hu_hong / bao_tri)

DotKiemTra (Inspection Round)
  - id, ngay_kiem_tra, nguoi_kiem_tra, ghi_chu

KetQuaKiemTra (Inspection Result)
  - id, dot_kiem_tra_id, thiet_bi_id, ket_qua, hinh_anh, ghi_chu

NguoiDung (User)
  - id, ten, vai_tro (admin / kiem_tra_vien / quan_ly)

ToaNha / KhuVuc (Building / Zone)
  - id, ten, dia_chi, so_tang
```

### 5.2 Quy trình nghiệp vụ (dự kiến)

1. **Quản lý thiết bị:** Nhập danh sách thiết bị PCCC (bình chữa cháy, hệ thống sprinkler, báo cháy, v.v.)
2. **Lập lịch kiểm tra:** Tạo lịch kiểm tra định kỳ theo quy định
3. **Thực hiện kiểm tra:** Ghi nhận kết quả tại hiện trường (đạt/không đạt, ảnh chụp)
4. **Quản lý sự cố:** Theo dõi thiết bị hỏng, yêu cầu bảo trì
5. **Báo cáo:** Xuất báo cáo tuân thủ, thống kê tình trạng thiết bị

### 5.3 Loại thiết bị PCCC thường gặp

- Bình chữa cháy (xách tay, xe đẩy)
- Hệ thống sprinkler (đầu phun)
- Hộp họng nước chữa cháy
- Chuông/đèn báo cháy
- Cảm biến khói/nhiệt
- Bơm chữa cháy
- Đèn exit / đèn sự cố

---

## 6. Hướng dẫn làm việc với Claude Code

### Khi bắt đầu phiên mới:
- Đọc file này để nắm context
- Kiểm tra branch hiện tại: `git branch`
- Xem trạng thái repo: `git status`

### Quy tắc phát triển:
- Mọi thay đổi phát triển trên branch được chỉ định (xem phần Git Branches)
- Commit message rõ ràng bằng tiếng Việt hoặc tiếng Anh
- Push lên remote sau khi hoàn thành

### Cập nhật file này:
Mỗi khi có thay đổi quan trọng (thêm module mới, thay đổi kiến trúc, quyết định công nghệ), cập nhật CLAUDE.md để giữ context luôn chính xác.

---

## 7. Lịch sử phát triển

| Ngày | Sự kiện |
|---|---|
| 2025-10-21 | Khởi tạo repository, thêm README và LICENSE |
| 2026-03-27 | Tạo CLAUDE.md — tổng hợp cấu trúc và context hệ thống |

---

## 8. Liên kết quan trọng

- **Repository:** https://github.com/tq89/ki-m-tra-thi-t-b-
- **License:** GNU GPLv3 (xem file LICENSE)
