# EP001 — Báo cáo kiểm tra âm thanh

Cập nhật 2026-11-11 theo quy tắc thời lượng mới. Trạng thái: **ĐÃ DUYỆT (2026-11-11)** kịch bản và âm thanh. Chưa render video, chưa tạo hình mới.

## 1. Thời lượng (timeline thực tế)

| Hạng mục | Giá trị |
|---|---|
| Điểm kết thúc nội dung (`contentEndSec`) | **63,27 s** |
| `durationInFrames` = ceil(63,27 × 30) | **1899** khung hình (63,300 s) |
| So với quy tắc | ≥ 60 s; nằm trong khoảng mục tiêu 60–90 s |
| Thành phần | Clip thoại 53,25 s (trong đó có lời 48,03 s) + 9 nhịp hành động 9,40 s + khoảng nghỉ chèn giữa câu 0,62 s |
| Đệm cuối | 0,03 s, chỉ để âm thanh kết thúc đúng ranh giới khung hình cuối |

Thời lượng từng cảnh (theo nội dung, không chia đều):

| Cảnh | Từ–đến (s) |
|---|---|
| S1 | 0,17–4,51 |
| S2 | 4,51–13,18 |
| S3 | 13,18–34,17 |
| S4 | 34,17–38,04 |
| S5 | 38,04–50,10 |
| S6 | 50,10–63,27 |

### Các thay đổi so với bản trước (bản 60,000 s)

1. **Bỏ ép đủ 60 s.** Bản trước kéo các nhịp hành động trong khoảng min–max để lấp đúng 60 s, và cắt 2 mẫu lặng ở cuối. Giờ mỗi nhịp hành động có độ dài cố định theo nội dung (0,7–1,4 s), không còn khoảng min–max.
2. **Ở nhịp tự nhiên, bản cũ chỉ dài 58,56 s, dưới 60 s.** Mình bổ sung diễn biến thay vì chèn lặng. Hai câu mới trong S3, khi Kiên tìm cách né viết báo cáo:
   - Kiên: "Hay em gửi công cụ luôn, bấm thử là thấy liền."
   - Sếp: "Công cụ thì anh không đọc. Anh đọc báo cáo."

   Nhịp này làm rõ nghịch lý trước khi Kiên hỏi lại. Chỉ hai câu này được tạo mới.
3. **Lỗi clip ở câu Sếp mới (s03b).** Lần tạo đầu có clip thật ngay trong bản TTS gốc: đỉnh 0 dBFS, 14 mẫu liền nhau bị cắt phẳng. Đây là lỗi âm thanh rõ ràng, nên bản đó được chuyển sang `cache/tts/rejected/` và câu được tạo lại. Bản mới không có mẫu nào vượt −1 dBFS.
4. **Kết quả cuối:** 25/26 câu dùng lại từ cache, chỉ s03b là bản tạo mới.

### Kiểm tra lại các câu có từ bản trước

- **Không câu nào bị tăng tốc, time-stretch hay đổi pitch.** Code không có lệnh nào làm việc đó (đã tìm `atempo`, `rubberband`, `asetrate`, `setpts`).
- **Mỗi câu chỉ bị bỏ khoảng lặng ở đuôi** (0–0,23 s), luôn giữ 60 ms tắt dần + 120 ms sau lời. Không câu nào bị cắt đầu.
- **Bản thô trùng khớp hoàn toàn với bản trong cache.** Vì vậy không cần khôi phục gì từ bản gốc.

## 2. Kiểm tra kỹ thuật

| Hạng mục | Kết quả |
|---|---|
| `dialogue-preview.wav` | WAV PCM16 48 kHz mono, 63,300 s (3.038.400 mẫu), giải mã không lỗi |
| Clip trong bản TTS gốc (26 câu) | Không còn (đã xử lý s03b) |
| Cờ QC từng câu (lặng bất thường, cắt cuối, clip, tốc độ) | Không có |
| Khoảng lặng dài | Không có khoảng ≥ 1,6 s. Dài nhất là nhịp montage a06 (1,4 s) |
| Khoảng lặng giữa lời | 0,22 s giữa các lượt; 0,20 s trong cùng lượt; 0,35 s trước câu chốt cuối |
| Tốc độ đọc (âm tiết/s) | Kiên 4,17–5,26 · lời dẫn 4,17–5,00 · Sếp 3,94–4,79 · Trinh 3,65–4,14 |
| Âm lượng | Mọi câu −21,1 LUFS. File −21,4 LUFS, true peak −1,5 dBTP |
| Phụ đề `captions.srt` | 26 cue theo timeline mới, tuần tự, không chồng; cue cuối kết thúc ở 62,07 s |

### Lưu ý kỹ thuật

- **Âm lượng thấp hơn mục tiêu −18 LUFS.** Ba câu (n03, k05, k04) có đỉnh gần 0 dBFS. Để giữ trần −1,5 dBTP mà không nén làm đổi âm sắc, cả bài được hạ đều. Chuẩn hoá cuối sẽ làm ở bước dựng video.
- **Ngắt giữa câu 0,38–0,41 s** ở s02, s05, s06 (sau dấu chấm). Chưa tới ngưỡng cờ; bạn nghe xem nhịp có tự nhiên không.
- **Bốn ghi chú "khoảng lặng tự nhiên > mục tiêu"** chỉ lệch ≤ 0,01 s do làm tròn.

## 3. Phụ đề: mức độ chính xác

- Mốc phụ đề **chính xác theo câu**: mỗi câu là một file riêng, nên mốc lấy từ lúc bắt đầu tới lúc kết thúc lời thật.
- **Không có mốc theo từng từ** (VieNeu không trả timestamp; mình không chia đều thời gian cho từng từ).
- Mỗi câu ≤ 58 ký tự. Kiểm tra hiển thị 2 dòng bằng font thật sẽ chạy khi dựng video (component `Subtitle` báo lỗi nếu vượt).

## 4. Phần cần bạn nghe lại

1. **Hai câu mới** k05a và s03b (23,8–28,3 s): nhịp, độ tự nhiên, câu Sếp có ra giọng Bắc điềm tĩnh không.
2. **Bỏ hoặc lặp từ:** chưa có ASR nên chưa kiểm tra tự động. Nghe đặc biệt các câu nhanh: k01, k02, k05, k05a.
3. **Giọng miền Nam** của Kiên, Trinh và lời dẫn có tự nhiên không. **Giọng Bắc** của Sếp và cảm giác trên 50 tuổi có đạt không.
4. **Lời dẫn và Kiên chung giọng:** hiện chỉ phân biệt bằng nội dung câu.
5. **Câu rất ngắn** k03 "Ờ, cũng được.": sắc thái cả nể.
6. **Nhịp hài:** các nhịp hành động (ghi trong `script.md`) và khoảng nghỉ trước câu chốt.
7. **Đọc số và từ:** "ba tiếng", "bảy buổi", "thứ Hai", "kế toán", "nhân sự", "biên bản".

## 5. Phong cách hình ảnh hiện lưu trong dự án

- Dự án lưu: hoạt hình 2D, có biểu cảm và hành động, dựng bằng bộ rig SVG phẳng có sẵn.
- **Không có quyết định nào về phong cách Ghibli.**

## 6. File bàn giao

- `episodes/EP001/script/script.md`: lời thoại, hành động, biểu cảm, mốc thời gian thật.
- `episodes/EP001/audio/dialogue-preview.wav`: bản nghe 63,3 s, không nhạc, không tiếng cười.
- `episodes/EP001/audio/lines/`: 26 câu đã cân âm lượng (`01_n01_narrator.wav` … `26_n05_narrator.wav`). `lines/raw/` là bản thô.
- `episodes/EP001/script/timeline.json`:
  - `contentEndSec`, `durationInFrames`, `durationStatus`.
  - Mốc từng câu và nhịp (giây, khung hình), voice ID, loudness, QC.
- `episodes/EP001/exports/EP001.srt`: phụ đề theo câu, theo timeline mới.
- `episodes/EP001/script/script.json`: dữ liệu nguồn của kịch bản (`duration.minSec = 60`, `targetRangeSec = [60, 90]`).
