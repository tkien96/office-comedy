# PROGRESS

Ghi lại tiến độ để tiếp tục được khi phiên làm việc bị gián đoạn. Mục mới nhất ở trên cùng.

## Trạng thái hiện tại

- Giai đoạn: **Bộ hình ảnh 2D dùng lại đã xong**, có video mẫu 10 giây (chưa có âm thanh/TTS).
- Bước tiếp theo: chọn giải pháp giọng đọc tiếng Việt (TTS), đồng bộ phụ đề theo thời gian lời nói, dựng composition tập 60 giây.

## Nhật ký

### 2026-11-10 — Bộ hình ảnh 2D

- [x] Rig nhân vật SVG/React dùng chung (`src/characters/`): đầu, mắt, mày, miệng, tay (2 khớp), thân, chân tách riêng. 3 thiết kế: Nam, Linh, Sếp.
- [x] 6 biểu cảm (bình thường, vui, nghi ngờ, bất ngờ, bực, ngượng) và 4 tư thế (đứng, ngồi máy tính, cầm điện thoại, chỉ tay). Chuyển tư thế, ánh nhìn và độ nghiêng được nội suy; biểu cảm đổi có hiệu ứng nảy; mắt chớp theo lịch cố định.
- [x] 3 bối cảnh (`src/backgrounds/`): văn phòng, phòng họp, pantry, kèm hàng bàn làm việc phía trước.
- [x] Font Be Vietnam Pro (OFL) qua `@remotion/google-fonts`. Phụ đề tối đa 2 dòng, đo bằng font thật; quá 2 dòng thì render báo lỗi. Mặt nhân vật lấn vào dải phụ đề cũng báo lỗi.
- [x] Kịch bản tách khỏi code: `src/episodes/demo-notification.ts` (dữ liệu), `src/scenes/ScriptedScene.tsx` (bộ dựng chung).
- [x] Xuất và kiểm tra:
  - `out/character-sheet.png` (2800x2860) và `out/background-sheet.png`.
  - `out/demo-notification.mp4`: h264 yuv420p bt709, 1080x1920, 30fps, 300 khung, aac (im lặng), 10.005 giây, giải mã không lỗi.
  - Render hai lần cho 300/300 khung giống hệt nhau (so framemd5).
- Ghi chú: font tải từ Google Fonts khi render, nên máy cần có mạng. Nếu cần render offline, chuyển sang file font cục bộ trong `public/fonts`.
- Ghi chú: `Config.setEnforceAudioTrack(true)` giúp file luôn có track AAC, kể cả khi chưa có TTS.

### 2026-11-10 — Khởi tạo

- [x] Kiểm tra môi trường: Node 24.6.0, npm 11.5.1, Git 2.41, FFmpeg/ffprobe 9.0.2, Chrome/Edge 157.
- [x] Khởi tạo Remotion 4.0.542 + TypeScript bằng `create-video --blank --no-tailwind` (template chính thức).
- [x] Cài Remotion Agent Skills cho Claude Code trong phạm vi dự án (`.claude/skills/`, `skills-lock.json`).
- [x] Tạo CLAUDE.md, README.md, PROGRESS.md, .env.example, cập nhật .gitignore.
- [x] Render video kiểm tra kỹ thuật 5 giây `out/tech-check.mp4` (composition `TechCheck`) và kiểm tra bằng ffprobe: h264 yuv420p bt709, 1080x1920, 30fps, 150 khung hình, aac, 5.013 giây (phần lẻ 13 ms là đệm AAC), giải mã toàn bộ không lỗi.
- Ghi chú: mặc định Remotion xuất `yuvj420p` (dải đầy đủ, không gắn thông tin màu), nên đã đặt `Config.setColorSpace("bt709")` để ra `yuv420p` chuẩn.
- Ghi chú: các file trong dự án chưa được commit (Git chỉ có commit gốc của `create-video`).

## Việc tồn đọng

- [x] Bộ nhân vật 2D (tối đa 2 nhân vật thoại + người kể).
- [x] Schema dữ liệu cảnh (`src/episodes/types.ts`). Cần mở rộng thành nhiều cảnh nối tiếp cho tập 60 giây.
- [ ] Giọng đọc tiếng Việt (TTS) và phụ đề đồng bộ.
- [ ] Thêm tư thế nếu kịch bản cần (đi bộ, khoanh tay, cầm cốc...).
- [ ] Composition tập 60 giây (1800 khung hình) và tập thử đầu tiên.
