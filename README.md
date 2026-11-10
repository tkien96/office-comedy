# Office Comedy

Dự án sản xuất tự động video hài ngắn về công sở và đời thường bằng tiếng Việt, dựng bằng [Remotion](https://www.remotion.dev) + TypeScript.

Thông số mỗi tập: 1080x1920, 30fps, 1800 khung hình (60 giây), MP4 H.264 + AAC. Quy tắc chi tiết nằm trong [CLAUDE.md](CLAUDE.md), tiến độ trong [PROGRESS.md](PROGRESS.md).

## Yêu cầu

- Node.js 20.19+ / 22.13+ / 24+ (máy hiện tại: 24.6.0)
- npm, Git
- FFmpeg + ffprobe trong PATH (kiểm tra kết quả render)
- Remotion tự tải Chrome Headless Shell khi render lần đầu

## Cài đặt (PowerShell, trong thư mục dự án)

```
npm install
Copy-Item .env.example .env
```

Mở `.env` và điền key nếu cần. Không commit `.env`.

## Xem trước (Remotion Studio)

```
npm run dev
```

Studio mở ở `http://localhost:3000`. Chọn composition ở cột trái.

## Render

Video kiểm tra kỹ thuật 5 giây:

```
npm run render:test
```

Kết quả: `out/tech-check.mp4`.

Kiểm tra file đã xuất:

```
npm run probe:test
```

Kết quả mong đợi: `h264` 1080x1920 30/1 với 150 khung hình, `aac`, thời lượng 5.0 giây.

## Lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Mở Remotion Studio |
| `npm run lint` | ESLint + kiểm tra kiểu TypeScript |
| `npm run render:test` | Render `TechCheck` ra `out/tech-check.mp4` |
| `npm run probe:test` | In thông số codec/khung hình/thời lượng của file test |

## Cấu trúc

```
src/Root.tsx           đăng ký composition
src/test/TechCheck.tsx composition kiểm tra kỹ thuật (5 giây)
public/test/           tài nguyên kiểm tra (âm thanh tự tạo bằng FFmpeg)
.claude/skills/        Remotion Agent Skills cho Claude Code (phạm vi dự án)
out/                   video xuất ra (bị Git bỏ qua)
```

## Giấy phép

Remotion miễn phí cho cá nhân và nhóm tối đa 3 người; tổ chức lớn hơn cần giấy phép công ty. Xem https://www.remotion.dev/license.
