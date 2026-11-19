# Phụ đề EP002: kiểm tra

File: `episodes/EP002/exports/EP002.srt` · hash `c7b5aad121eb8df2`

Tạo bằng `npm run episode:captions -- EP002` từ `episodes/EP002/script/timeline.json` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- 34 cue · 0 lỗi · 8 cảnh báo.
- Quy tắc: tối đa 2 dòng, 42 ký tự mỗi dòng. Hiển thị tối thiểu 0.8 s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa 20 ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video nằm trong cue, không có đoạn nói nào thiếu phụ đề.

- **CẢNH BÁO** (cue 1): Tốc độ đọc 22.2 ký tự/giây > 20.
- **CẢNH BÁO** (cue 2): Tốc độ đọc 21.5 ký tự/giây > 20.
- **CẢNH BÁO** (cue 9): Tốc độ đọc 20.5 ký tự/giây > 20.
- **CẢNH BÁO** (cue 15): Tốc độ đọc 20.4 ký tự/giây > 20.
- **CẢNH BÁO** (cue 17): Tốc độ đọc 20.5 ký tự/giây > 20.
- **GHI CHÚ** (cue 23): Lời dài 0.69 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 26): Tốc độ đọc 20.9 ký tự/giây > 20.
- **CẢNH BÁO** (cue 33): Tốc độ đọc 22.6 ký tự/giây > 20.
- **CẢNH BÁO** (cue 34): Tốc độ đọc 20.4 ký tự/giây > 20.
- **GHI CHÚ** (cue 7): Nhắc "sếp" khi nói với đồng nghiệp: "Cả phòng nhận hết rồi. Có sếp luôn đó."
- **GHI CHÚ** (cue 10): Nhắc "sếp" khi nói với đồng nghiệp: "Trừ sếp. Sếp đọc rồi."
- **GHI CHÚ**: Âm thanh lấy từ video (episodes/EP002/exports/EP002.mp4, 74.00 s). Cue cuối kết thúc 72.880 s; video dài 74.000 s.

## Xưng hô (để đối chiếu nhanh)

- 5. Trinh → Kiên: "Anh Kiên! Anh trả lời tất cả rồi kìa!"
- 6. Kiên → Trinh: "Hả? Anh gửi cho em mà."
- 11. Trinh → Kiên: "Bình tĩnh. Anh gửi thêm thư giải thích đi."
- 12. Trinh → Kiên: "Nói là anh đang bàn về phim bộ tối qua."
- 14. Trinh → Kiên: "Khoan. Vậy là anh coi phim trong giờ làm hả?"
- 15. Kiên → Trinh: "Trời ơi. Để anh gửi thêm một thư nữa."
- 16. Trinh → Kiên: "Thôi anh! Mỗi thư là thêm một tội đó."
- 19. Sếp: "Kiên này, anh đọc cả ba thư rồi."
- 20. Kiên → Sếp: "Dạ… em xin lỗi sếp ạ."
- 21. Sếp: "Không sao. Em nói đúng đấy."
- 23. Kiên → Sếp: "Dạ? Thiệt hả sếp?"
- 24. Sếp: "Nhưng chiều nay em lên phòng họp nhé."
- 25. Sếp: "Anh có một buổi riêng cho em."
- 26. Kiên → Sếp: "Dạ, họp về chuyện gì vậy sếp?"
- 27. Sếp: "Cách viết thư nội bộ. Chỉ em với anh thôi."
- 28. Sếp: "Anh xếp ba tiếng nhé."
- 29. Trinh → Kiên: "Anh ơi, cả phòng cảm ơn anh. Họp còn mười lăm phút."
- 30. Kiên → Trinh: "Còn anh thì họp ba tiếng."
- 31. Trinh → Kiên: "Vậy lát họp xong, anh nhắn em than nha."

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
| 1 | 00:00:00,250 → 00:00:01,600 | 1.35 s | Kiên (lời dẫn) | Tôi chỉ định than với đúng một người. |
| 2 | 00:00:01,810 → 00:00:03,020 | 1.21 s | Kiên (lời dẫn) | Nhưng tôi lại bấm Trả lời tất cả. |
| 3 | 00:00:03,240 → 00:00:05,010 | 1.77 s | Kiên (lời dẫn) | Sếp vừa gửi lịch họp sáng thứ Hai: / ba tiếng. |
| 4 | 00:00:05,210 → 00:00:06,900 | 1.69 s | Kiên (lời dẫn) | Tôi trả lời: họp gì mà dài như phim bộ. |
| 5 | 00:00:08,480 → 00:00:10,520 | 2.04 s | Trinh | Anh Kiên! Anh trả lời tất cả rồi kìa! |
| 6 | 00:00:10,740 → 00:00:11,830 | 1.09 s | Kiên | Hả? Anh gửi cho em mà. |
| 7 | 00:00:12,050 → 00:00:14,370 | 2.32 s | Trinh | Cả phòng nhận hết rồi. Có sếp luôn đó. |
| 8 | 00:00:14,590 → 00:00:15,740 | 1.15 s | Kiên | Thu hồi! Thu hồi thư liền! |
| 9 | 00:00:17,040 → 00:00:18,160 | 1.12 s | Kiên | Thu hồi được mười một người. |
| 10 | 00:00:18,380 → 00:00:19,400 | 1.02 s | Kiên | Trừ sếp. Sếp đọc rồi. |
| 11 | 00:00:20,500 → 00:00:22,760 | 2.26 s | Trinh | Bình tĩnh. Anh gửi thêm thư giải thích đi. |
| 12 | 00:00:22,960 → 00:00:25,250 | 2.29 s | Trinh | Nói là anh đang bàn về phim bộ tối qua. |
| 13 | 00:00:25,510 → 00:00:26,390 | 0.88 s | Kiên | Ý hay nè. Gửi liền. |
| 14 | 00:00:27,820 → 00:00:30,330 | 2.51 s | Trinh | Khoan. Vậy là anh coi / phim trong giờ làm hả? |
| 15 | 00:00:30,550 → 00:00:31,970 | 1.42 s | Kiên | Trời ơi. Để anh gửi thêm một thư nữa. |
| 16 | 00:00:32,190 → 00:00:34,440 | 2.25 s | Trinh | Thôi anh! Mỗi thư là thêm một tội đó. |
| 17 | 00:00:36,030 → 00:00:37,740 | 1.71 s | Kiên (lời dẫn) | Trong năm phút, / tôi gửi cho cả phòng ba thư. |
| 18 | 00:00:37,940 → 00:00:39,460 | 1.52 s | Kiên (lời dẫn) | Thư sau tôi viết còn tệ hơn thư trước. |
| 19 | 00:00:40,880 → 00:00:42,640 | 1.76 s | Sếp | Kiên này, anh đọc cả ba thư rồi. |
| 20 | 00:00:42,860 → 00:00:43,890 | 1.03 s | Kiên | Dạ… em xin lỗi sếp ạ. |
| 21 | 00:00:44,110 → 00:00:45,580 | 1.47 s | Sếp | Không sao. Em nói đúng đấy. |
| 22 | 00:00:45,780 → 00:00:48,250 | 2.47 s | Sếp | Từ tuần sau, / họp chỉ mười lăm phút thôi nhé. |
| 23 | 00:00:48,470 → 00:00:49,270 | 0.80 s * | Kiên | Dạ? Thiệt hả sếp? |
| 24 | 00:00:50,080 → 00:00:51,850 | 1.77 s | Sếp | Nhưng chiều nay em lên phòng họp nhé. |
| 25 | 00:00:52,050 → 00:00:53,520 | 1.47 s | Sếp | Anh có một buổi riêng cho em. |
| 26 | 00:00:53,740 → 00:00:54,840 | 1.10 s | Kiên | Dạ, họp về chuyện gì vậy sếp? |
| 27 | 00:00:55,060 → 00:00:57,330 | 2.27 s | Sếp | Cách viết thư nội bộ. Chỉ em với anh thôi. |
| 28 | 00:00:57,530 → 00:00:58,610 | 1.08 s | Sếp | Anh xếp ba tiếng nhé. |
| 29 | 00:00:59,990 → 00:01:02,940 | 2.95 s | Trinh | Anh ơi, cả phòng cảm ơn anh. / Họp còn mười lăm phút. |
| 30 | 00:01:03,160 → 00:01:04,170 | 1.01 s | Kiên | Còn anh thì họp ba tiếng. |
| 31 | 00:01:04,390 → 00:01:06,880 | 2.49 s | Trinh | Vậy lát họp xong, anh nhắn em than nha. |
| 32 | 00:01:07,090 → 00:01:07,960 | 0.87 s | Trinh | Nhớ nhắn riêng đó. |
| 33 | 00:01:09,760 → 00:01:11,000 | 1.24 s | Kiên (lời dẫn) | Tôi thành người hùng của cả phòng. |
| 34 | 00:01:11,210 → 00:01:12,880 | 1.67 s | Kiên (lời dẫn) | Người hùng duy nhất còn phải họp ba tiếng. |

\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ 0.8 s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở `episodes/EP002/exports/EP002.mp4` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.
