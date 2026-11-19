# Phụ đề EP004: kiểm tra

File: `episodes/EP004/exports/EP004.srt` · hash `5d766a9dd782de62`

Tạo bằng `npm run episode:captions -- EP004` từ `episodes/EP004/script/timeline.json` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- 33 cue · 0 lỗi · 6 cảnh báo.
- Quy tắc: tối đa 2 dòng, 42 ký tự mỗi dòng. Hiển thị tối thiểu 0.8 s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa 20 ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video nằm trong cue, không có đoạn nói nào thiếu phụ đề.

- **CẢNH BÁO** (cue 2): Tốc độ đọc 20.4 ký tự/giây > 20.
- **GHI CHÚ** (cue 4): Lời dài 0.74 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 8): Hiển thị 0.62 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 8): Lời dài 0.47 s; giữ chữ trên màn hình 0.62 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **GHI CHÚ** (cue 23): Lời dài 0.72 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 23): Tốc độ đọc 21.2 ký tự/giây > 20.
- **CẢNH BÁO** (cue 25): Tốc độ đọc 20.2 ký tự/giây > 20.
- **CẢNH BÁO** (cue 29): Tốc độ đọc 20.9 ký tự/giây > 20.
- **CẢNH BÁO** (cue 33): Tốc độ đọc 25.0 ký tự/giây > 20.
- **GHI CHÚ** (cue 30): Nhắc "sếp" khi nói với đồng nghiệp: "Có. Sếp vừa gửi link cho cả công ty rồi."
- **GHI CHÚ**: Âm thanh lấy từ video (episodes/EP004/exports/EP004.mp4, 63.87 s). Cue cuối kết thúc 62.740 s; video dài 63.867 s.

## Xưng hô (để đối chiếu nhanh)

- 5. Kiên → Trinh: "Em ăn bánh không? Giòn lắm nè."
- 6. Trinh → Kiên: "Anh nói nhỏ thôi!"
- 7. Kiên → Trinh: "Ủa, anh tắt micro rồi mà. Sợ gì."
- 8. Trinh → Kiên: "Anh ơi…"
- 9. Kiên → Trinh: "Suỵt. Anh đang họp mà em."
- 10. Kiên → Trinh: "Em nhắn gì mà nhiều vậy? Lát họp xong anh đọc."
- 13. Trinh → Kiên: "Anh! Cái micro!"
- 14. Kiên → Trinh: "Ừ, anh tắt rồi. Yên tâm đi em."
- 17. Sếp: "Cảm ơn các em đã tham gia."
- 19. Kiên → Sếp: "Dạ…? Em… hát ạ?"
- 21. Sếp: "Biên bản hôm nay anh cho ghi đủ cả rồi."
- 23. Kiên → Trinh: "Sao em không nói anh?"
- 24. Trinh → Kiên: "Em nhắn anh mười hai tin rồi đó."
- 25. Kiên → Trinh: "Sao em không nói lớn?"
- 26. Trinh → Kiên: "Em mà nói lớn thì cả phòng cũng nghe luôn."
- 27. Trinh → Kiên: "Mà công nhận anh hát cũng được."
- 29. Kiên → Trinh: "Cuộc họp có ghi hình không em?"
- 31. Kiên → Trinh: "Cả công ty luôn hả em?"

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
| 1 | 00:00:00,250 → 00:00:01,740 | 1.49 s | Kiên (lời dẫn) | Họp online thì tôi luôn tắt micro. |
| 2 | 00:00:01,960 → 00:00:02,940 | 0.98 s | Kiên (lời dẫn) | Ít nhất là tôi tưởng vậy. |
| 3 | 00:00:04,370 → 00:00:05,890 | 1.52 s | Kiên | Slide này nói ba lần rồi đó trời. |
| 4 | 00:00:07,200 → 00:00:08,000 | 0.80 s * | Kiên | Bánh này giòn ghê. |
| 5 | 00:00:08,160 → 00:00:09,400 | 1.24 s | Kiên | Em ăn bánh không? Giòn lắm nè. |
| 6 | 00:00:09,620 → 00:00:10,560 | 0.94 s | Trinh | Anh nói nhỏ thôi! |
| 7 | 00:00:10,780 → 00:00:12,560 | 1.78 s | Kiên | Ủa, anh tắt micro rồi mà. Sợ gì. |
| 8 | 00:00:12,780 → 00:00:13,403 | 0.62 s * | Trinh | Anh ơi… |
| 9 | 00:00:13,470 → 00:00:14,600 | 1.13 s | Kiên | Suỵt. Anh đang họp mà em. |
| 10 | 00:00:16,190 → 00:00:18,030 | 1.84 s | Kiên | Em nhắn gì mà nhiều vậy? / Lát họp xong anh đọc. |
| 11 | 00:00:18,250 → 00:00:19,390 | 1.14 s | Kiên | Thứ Sáu ơi, mau tới đi mà… |
| 12 | 00:00:19,590 → 00:00:20,890 | 1.30 s | Kiên | La la la, tan ca rồi về… |
| 13 | 00:00:21,110 → 00:00:22,150 | 1.04 s | Trinh | Anh! Cái micro! |
| 14 | 00:00:22,370 → 00:00:23,950 | 1.58 s | Kiên | Ừ, anh tắt rồi. Yên tâm đi em. |
| 15 | 00:00:24,170 → 00:00:26,400 | 2.23 s | Kiên (lời dẫn) | Tôi không để ý, / cả cuộc họp im lặng một cách lạ lùng. |
| 16 | 00:00:27,780 → 00:00:29,420 | 1.64 s | Sếp | Thôi, hôm nay họp đến đây nhé. |
| 17 | 00:00:29,620 → 00:00:30,990 | 1.37 s | Sếp | Cảm ơn các em đã tham gia. |
| 18 | 00:00:31,190 → 00:00:33,280 | 2.09 s | Sếp | Và cảm ơn Kiên đã hát nền suốt buổi nhé. |
| 19 | 00:00:33,500 → 00:00:34,410 | 0.91 s | Kiên | Dạ…? Em… hát ạ? |
| 20 | 00:00:34,630 → 00:00:36,760 | 2.13 s | Sếp | Giọng cũng được đấy. Bánh nghe cũng giòn. |
| 21 | 00:00:37,020 → 00:00:39,210 | 2.19 s | Sếp | Biên bản hôm nay anh cho ghi đủ cả rồi. |
| 22 | 00:00:39,410 → 00:00:40,860 | 1.45 s | Sếp | Kể cả đoạn tan ca rồi về. |
| 23 | 00:00:43,650 → 00:00:44,450 | 0.80 s * | Kiên | Sao em không nói anh? |
| 24 | 00:00:44,590 → 00:00:46,220 | 1.63 s | Trinh | Em nhắn anh mười hai tin rồi đó. |
| 25 | 00:00:46,550 → 00:00:47,390 | 0.84 s | Kiên | Sao em không nói lớn? |
| 26 | 00:00:47,610 → 00:00:49,600 | 1.99 s | Trinh | Em mà nói lớn thì cả phòng cũng nghe luôn. |
| 27 | 00:00:49,830 → 00:00:51,200 | 1.37 s | Trinh | Mà công nhận anh hát cũng được. |
| 28 | 00:00:51,410 → 00:00:53,350 | 1.94 s | Trinh | Chat cuộc họp vỗ tay quá trời kìa. |
| 29 | 00:00:55,180 → 00:00:56,330 | 1.15 s | Kiên | Cuộc họp có ghi hình không em? |
| 30 | 00:00:56,560 → 00:00:58,750 | 2.19 s | Trinh | Có. Sếp vừa gửi link cho cả công ty rồi. |
| 31 | 00:00:59,000 → 00:00:59,940 | 0.94 s | Kiên | Cả công ty luôn hả em? |
| 32 | 00:01:00,160 → 00:01:01,540 | 1.38 s | Kiên (lời dẫn) | Hôm đó, tôi nổi tiếng cả phòng. |
| 33 | 00:01:01,740 → 00:01:02,740 | 1.00 s | Kiên (lời dẫn) | Theo cách tôi không muốn nhất. |

\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ 0.8 s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở `episodes/EP004/exports/EP004.mp4` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.
