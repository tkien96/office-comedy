# Phụ đề EP005: kiểm tra

File: `episodes/EP005/exports/EP005.srt` · hash `7c2d337eb253a14d`

Tạo bằng `npm run episode:captions -- EP005` từ `episodes/EP005/script/timeline.json` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- 35 cue · 0 lỗi · 10 cảnh báo.
- Quy tắc: tối đa 2 dòng, 42 ký tự mỗi dòng. Hiển thị tối thiểu 0.8 s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa 20 ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video nằm trong cue, không có đoạn nói nào thiếu phụ đề.

- **GHI CHÚ** (cue 2): Lời dài 0.61 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 7): Hiển thị 0.65 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 7): Lời dài 0.50 s; giữ chữ trên màn hình 0.65 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 8): Hiển thị 0.71 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 8): Lời dài 0.56 s; giữ chữ trên màn hình 0.71 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 8): Tốc độ đọc 21.0 ký tự/giây > 20.
- **CẢNH BÁO** (cue 13): Hiển thị 0.72 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 13): Lời dài 0.57 s; giữ chữ trên màn hình 0.72 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 13): Tốc độ đọc 20.7 ký tự/giây > 20.
- **CẢNH BÁO** (cue 15): Hiển thị 0.79 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 15): Lời dài 0.64 s; giữ chữ trên màn hình 0.79 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 20): Hiển thị 0.75 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 20): Lời dài 0.62 s; giữ chữ trên màn hình 0.75 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 20): Tốc độ đọc 21.2 ký tự/giây > 20.
- **CẢNH BÁO** (cue 21): Tốc độ đọc 22.4 ký tự/giây > 20.
- **CẢNH BÁO** (cue 28): Hiển thị 0.63 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 28): Lời dài 0.47 s; giữ chữ trên màn hình 0.63 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **GHI CHÚ** (cue 16): Nhắc "sếp" khi nói với đồng nghiệp: "Cỡ… được sếp khen á."
- **GHI CHÚ**: Âm thanh lấy từ video (episodes/EP005/exports/EP005.mp4, 65.98 s). Cue cuối kết thúc 64.820 s; video dài 65.967 s.

## Xưng hô (để đối chiếu nhanh)

- 3. Trinh → Kiên: "Anh ơi, giúp em một phút thôi."
- 4. Trinh → Kiên: "Đổi màu ô này sang xanh giùm em."
- 6. Trinh → Kiên: "Hay quá. Tiện anh căn lề luôn nha."
- 9. Trinh → Kiên: "Thêm cái biểu đồ nữa là đẹp luôn á anh."
- 11. Trinh → Kiên: "Cả hai đi anh. Cho người ta chọn."
- 14. Trinh → Kiên: "Sửa tiêu đề cho sang chút nha anh."
- 15. Kiên → Trinh: "Sang cỡ nào em?"
- 17. Trinh → Kiên: "Xong rồi anh xuất ra PDF giùm em nha."
- 18. Kiên → Trinh: "Hay anh in ra, đóng bìa luôn cho em?"
- 19. Trinh → Kiên: "Dạ được luôn hả? Anh tốt quá!"
- 23. Trinh → Sếp: "Dạ, em làm ạ!"
- 25. Sếp: "Em làm thêm ba trang phân tích nhé."
- 26. Sếp: "Sáng mai anh xem."
- 27. Trinh → Sếp: "Dạ, em làm liền ạ!"
- 28. Trinh → Kiên: "Anh ơi…"
- 29. Kiên → Trinh: "Đừng nói là một phút nha em."
- 32. Kiên → Trinh: "Hôm nay anh phải về sớm mà em."
- 33. Trinh → Kiên: "Dạ, nên em mới nhờ anh làm nhanh đó."

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
| 1 | 00:00:00,250 → 00:00:01,620 | 1.37 s | Kiên (lời dẫn) | Trinh bảo tôi: chỉ một phút thôi. |
| 2 | 00:00:01,820 → 00:00:02,620 | 0.80 s * | Kiên (lời dẫn) | Và tôi đã tin. |
| 3 | 00:00:03,760 → 00:00:05,420 | 1.66 s | Trinh | Anh ơi, giúp em một phút thôi. |
| 4 | 00:00:05,670 → 00:00:07,560 | 1.89 s | Trinh | Đổi màu ô này sang xanh giùm em. |
| 5 | 00:00:07,780 → 00:00:08,820 | 1.04 s | Kiên | Dễ mà. Xong rồi nè. |
| 6 | 00:00:09,040 → 00:00:10,870 | 1.83 s | Trinh | Hay quá. Tiện anh căn lề luôn nha. |
| 7 | 00:00:11,090 → 00:00:11,743 | 0.65 s * | Kiên | Ờ… cũng được. |
| 8 | 00:00:11,810 → 00:00:12,523 | 0.71 s * | Kiên (lời dẫn) | Phút thứ mười lăm. |
| 9 | 00:00:12,590 → 00:00:15,010 | 2.42 s | Trinh | Thêm cái biểu đồ nữa là đẹp luôn á anh. |
| 10 | 00:00:15,250 → 00:00:16,520 | 1.27 s | Kiên | Biểu đồ cột hay biểu đồ tròn? |
| 11 | 00:00:16,740 → 00:00:18,560 | 1.82 s | Trinh | Cả hai đi anh. Cho người ta chọn. |
| 12 | 00:00:18,780 → 00:00:20,710 | 1.93 s | Kiên (lời dẫn) | Việc của tôi thì vẫn / nằm yên ở tab bên cạnh. |
| 13 | 00:00:20,930 → 00:00:21,653 | 0.72 s * | Kiên (lời dẫn) | Phút thứ bốn mươi. |
| 14 | 00:00:21,720 → 00:00:23,640 | 1.92 s | Trinh | Sửa tiêu đề cho sang chút nha anh. |
| 15 | 00:00:23,860 → 00:00:24,653 | 0.79 s * | Kiên | Sang cỡ nào em? |
| 16 | 00:00:24,720 → 00:00:26,190 | 1.47 s | Trinh | Cỡ… được sếp khen á. |
| 17 | 00:00:26,410 → 00:00:29,180 | 2.77 s | Trinh | Xong rồi anh xuất ra PDF giùm em nha. |
| 18 | 00:00:29,400 → 00:00:31,010 | 1.61 s | Kiên | Hay anh in ra, đóng bìa luôn cho em? |
| 19 | 00:00:31,230 → 00:00:32,910 | 1.68 s | Trinh | Dạ được luôn hả? Anh tốt quá! |
| 20 | 00:00:34,410 → 00:00:35,163 | 0.75 s * | Kiên (lời dẫn) | Phút thứ chín mươi. |
| 21 | 00:00:35,230 → 00:00:36,660 | 1.43 s | Kiên (lời dẫn) | Tôi bắt đầu nghi ngờ khái niệm một phút. |
| 22 | 00:00:38,080 → 00:00:40,020 | 1.94 s | Sếp | Báo cáo này ai làm mà đẹp thế? |
| 23 | 00:00:40,240 → 00:00:41,200 | 0.96 s | Trinh | Dạ, em làm ạ! |
| 24 | 00:00:41,420 → 00:00:43,610 | 2.19 s | Sếp | Tốt. Biểu đồ rõ ràng, tiêu đề cũng sang. |
| 25 | 00:00:43,810 → 00:00:45,540 | 1.73 s | Sếp | Em làm thêm ba trang phân tích nhé. |
| 26 | 00:00:45,740 → 00:00:46,730 | 0.99 s | Sếp | Sáng mai anh xem. |
| 27 | 00:00:46,950 → 00:00:48,200 | 1.25 s | Trinh | Dạ, em làm liền ạ! |
| 28 | 00:00:49,680 → 00:00:50,313 | 0.63 s * | Trinh | Anh ơi… |
| 29 | 00:00:50,380 → 00:00:51,590 | 1.21 s | Kiên | Đừng nói là một phút nha em. |
| 30 | 00:00:51,810 → 00:00:53,580 | 1.77 s | Trinh | Không đâu. Lần này một phút thiệt mà. |
| 31 | 00:00:53,780 → 00:00:55,890 | 2.11 s | Trinh | Ba trang, mỗi trang… một phút thôi. |
| 32 | 00:00:56,110 → 00:00:57,430 | 1.32 s | Kiên | Hôm nay anh phải về sớm mà em. |
| 33 | 00:00:57,680 → 00:00:59,890 | 2.21 s | Trinh | Dạ, nên em mới nhờ anh làm nhanh đó. |
| 34 | 00:01:01,410 → 00:01:02,570 | 1.16 s | Kiên (lời dẫn) | Hôm đó tôi học được một điều. |
| 35 | 00:01:02,790 → 00:01:04,820 | 2.03 s | Kiên (lời dẫn) | Một phút của Trinh dài hơn / cả buổi chiều của tôi. |

\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ 0.8 s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở `episodes/EP005/exports/EP005.mp4` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.
