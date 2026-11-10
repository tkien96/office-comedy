# PROGRESS

Ghi lại tiến độ để tiếp tục được khi phiên làm việc bị gián đoạn. Mục mới nhất ở trên cùng.

## Trạng thái hiện tại

- Giai đoạn: **Khởi tạo dự án hoàn tất.** Chưa bắt đầu sản xuất tập nào.
- Bước tiếp theo: thiết kế bộ nhân vật 2D dùng lại, định dạng dữ liệu kịch bản, chọn giải pháp giọng đọc (TTS) và phụ đề.

## Nhật ký

### 2026-11-10 — Khởi tạo

- [x] Kiểm tra môi trường: Node 24.6.0, npm 11.5.1, Git 2.41, FFmpeg/ffprobe 9.0.2, Chrome/Edge 157.
- [x] Khởi tạo Remotion 4.0.542 + TypeScript bằng `create-video --blank --no-tailwind` (template chính thức).
- [x] Cài Remotion Agent Skills cho Claude Code trong phạm vi dự án (`.claude/skills/`, `skills-lock.json`).
- [x] Tạo CLAUDE.md, README.md, PROGRESS.md, .env.example, cập nhật .gitignore.
- [x] Render video kiểm tra kỹ thuật 5 giây `out/tech-check.mp4` (composition `TechCheck`) và kiểm tra bằng ffprobe: h264 yuv420p bt709, 1080x1920, 30fps, 150 khung hình, aac, 5.013 giây (phần lẻ 13 ms là đệm AAC), giải mã toàn bộ không lỗi.
- Ghi chú: mặc định Remotion xuất `yuvj420p` (dải đầy đủ, không gắn thông tin màu), nên đã đặt `Config.setColorSpace("bt709")` để ra `yuv420p` chuẩn.
- Ghi chú: các file trong dự án chưa được commit (Git chỉ có commit gốc của `create-video`).

## Việc tồn đọng

- [ ] Bộ nhân vật 2D (tối đa 2 nhân vật thoại + người kể).
- [ ] Schema dữ liệu kịch bản tập (`src/episodes/`).
- [ ] Giọng đọc tiếng Việt (TTS) và phụ đề đồng bộ.
- [ ] Composition tập 60 giây (1800 khung hình) và tập thử đầu tiên.
