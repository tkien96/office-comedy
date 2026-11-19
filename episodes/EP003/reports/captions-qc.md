# Phụ đề EP003: kiểm tra

File: `episodes/EP003/exports/EP003.srt` · hash `e967abfb2ba7cd82`

Tạo bằng `npm run episode:captions -- EP003` từ `episodes/EP003/script/timeline.json` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- 30 cue · 1 lỗi · 4 cảnh báo.
- Quy tắc: tối đa 2 dòng, 42 ký tự mỗi dòng. Hiển thị tối thiểu 0.8 s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa 20 ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video nằm trong cue, không có đoạn nói nào thiếu phụ đề.

- **CẢNH BÁO** (cue 1): Tốc độ đọc 21.9 ký tự/giây > 20.
- **CẢNH BÁO** (cue 3): Hiển thị 0.68 s < 0.8 s (không kéo dài được vì sát câu sau).
- **GHI CHÚ** (cue 3): Lời dài 0.53 s; giữ chữ trên màn hình 0.68 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 10): Tốc độ đọc 20.7 ký tự/giây > 20.
- **GHI CHÚ** (cue 17): Lời dài 0.79 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **GHI CHÚ** (cue 29): Lời dài 0.79 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 29): Tốc độ đọc 20.0 ký tự/giây > 20.
- **GHI CHÚ** (cue 9): Nhắc "sếp" khi nói với đồng nghiệp: "Sáng nay em thấy sếp mở tủ lạnh lâu lắm."
- **LỖI** (cue 13): Nói với Sếp nhưng không xưng "em": "Dạ, phòng mình đâu có đặt cơm hả sếp?"
- **GHI CHÚ**: Âm thanh lấy từ video (episodes/EP003/exports/EP003.mp4, 66.06 s). Cue cuối kết thúc 64.940 s; video dài 66.067 s.

## Xưng hô (để đối chiếu nhanh)

- 3. Kiên → Trinh: "Em ăn gì vậy?"
- 6. Trinh → Kiên: "Hộp em màu hồng, có ghi tên em nè."
- 7. Trinh → Kiên: "Hộp anh màu gì?"
- 9. Trinh → Kiên: "Sáng nay em thấy sếp mở tủ lạnh lâu lắm."
- 11. Kiên → Sếp: "Dạ sếp ăn trưa chưa ạ?"
- 13. Kiên → Sếp: "Dạ, phòng mình đâu có đặt cơm hả sếp?"
- 15. Sếp: "À. Anh xin lỗi nhé. Anh tưởng là cơm chung."
- 16. Sếp: "Anh có để lại giấy cảm ơn rồi đấy."
- 17. Kiên → Sếp: "Dạ, em đọc rồi ạ."
- 18. Sếp: "Cơm em tự nấu à? Thịt kho vừa ăn lắm."
- 19. Kiên → Sếp: "Dạ… em cảm ơn sếp ạ."
- 23. Kiên → Sếp: "Dạ? Sao lại là em ạ?"
- 24. Sếp: "Em là người bị hại. Em hiểu vấn đề nhất."
- 25. Trinh → Kiên: "Anh ơi, dán giùm em ba hộp này nha."
- 26. Kiên → Trinh: "Ba hộp? Em ăn hết nổi không?"
- 27. Trinh → Kiên: "Hai hộp của em. Một hộp của anh."
- 28. Trinh → Kiên: "Hôm qua anh nhịn trưa mà. Em làm dư đó."

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
| 1 | 00:00:00,250 → 00:00:01,530 | 1.28 s | Kiên (lời dẫn) | Trưa nay, hộp cơm của tôi biến mất. |
| 2 | 00:00:01,770 → 00:00:03,190 | 1.42 s | Kiên (lời dẫn) | Kẻ lấy còn để lại một tờ giấy. |
| 3 | 00:00:05,670 → 00:00:06,353 | 0.68 s * | Kiên | Em ăn gì vậy? |
| 4 | 00:00:06,420 → 00:00:07,740 | 1.32 s | Trinh | Cơm sườn nè. Ngon lắm. |
| 5 | 00:00:08,030 → 00:00:09,510 | 1.48 s | Kiên | Ngon lắm? Chữ y chang tờ giấy luôn. |
| 6 | 00:00:09,740 → 00:00:11,700 | 1.96 s | Trinh | Hộp em màu hồng, có ghi tên em nè. |
| 7 | 00:00:11,910 → 00:00:12,760 | 0.85 s | Trinh | Hộp anh màu gì? |
| 8 | 00:00:12,980 → 00:00:14,130 | 1.15 s | Kiên | Màu xanh. Mà không ghi tên. |
| 9 | 00:00:14,380 → 00:00:16,640 | 2.26 s | Trinh | Sáng nay em thấy sếp mở tủ lạnh lâu lắm. |
| 10 | 00:00:17,940 → 00:00:19,630 | 1.69 s | Kiên (lời dẫn) | Nghi phạm số hai là / người tôi không dám hỏi. |
| 11 | 00:00:21,010 → 00:00:21,960 | 0.95 s | Kiên | Dạ sếp ăn trưa chưa ạ? |
| 12 | 00:00:22,180 → 00:00:24,250 | 2.07 s | Sếp | Rồi. Hôm nay cơm phòng đặt ngon đấy. |
| 13 | 00:00:24,470 → 00:00:26,230 | 1.76 s | Kiên | Dạ, phòng mình đâu có đặt cơm hả sếp? |
| 14 | 00:00:26,450 → 00:00:29,060 | 2.61 s | Sếp | Thế à? Thế hộp cơm xanh / trong tủ lạnh là của ai? |
| 15 | 00:00:30,530 → 00:00:33,100 | 2.57 s | Sếp | À. Anh xin lỗi nhé. / Anh tưởng là cơm chung. |
| 16 | 00:00:33,300 → 00:00:35,340 | 2.04 s | Sếp | Anh có để lại giấy cảm ơn rồi đấy. |
| 17 | 00:00:35,560 → 00:00:36,360 | 0.80 s * | Kiên | Dạ, em đọc rồi ạ. |
| 18 | 00:00:36,570 → 00:00:38,690 | 2.12 s | Sếp | Cơm em tự nấu à? Thịt kho vừa ăn lắm. |
| 19 | 00:00:38,910 → 00:00:39,860 | 0.95 s | Kiên | Dạ… em cảm ơn sếp ạ. |
| 20 | 00:00:40,080 → 00:00:42,850 | 2.77 s | Sếp | Nhưng lỗi là ở quy trình. / Tủ lạnh không có quy định. |
| 21 | 00:00:43,050 → 00:00:45,400 | 2.35 s | Sếp | Từ mai, đồ trong tủ phải dán tên, / ghi ngày. |
| 22 | 00:00:45,600 → 00:00:46,450 | 0.85 s | Sếp | Kiên phụ trách nhé. |
| 23 | 00:00:46,670 → 00:00:47,810 | 1.14 s | Kiên | Dạ? Sao lại là em ạ? |
| 24 | 00:00:48,030 → 00:00:50,130 | 2.10 s | Sếp | Em là người bị hại. Em hiểu vấn đề nhất. |
| 25 | 00:00:52,740 → 00:00:54,750 | 2.01 s | Trinh | Anh ơi, dán giùm em ba hộp này nha. |
| 26 | 00:00:54,970 → 00:00:56,360 | 1.39 s | Kiên | Ba hộp? Em ăn hết nổi không? |
| 27 | 00:00:56,580 → 00:00:58,460 | 1.88 s | Trinh | Hai hộp của em. Một hộp của anh. |
| 28 | 00:00:58,680 → 00:01:00,950 | 2.27 s | Trinh | Hôm qua anh nhịn trưa mà. Em làm dư đó. |
| 29 | 00:01:02,460 → 00:01:03,260 | 0.80 s * | Kiên (lời dẫn) | Tôi mất một hộp cơm. |
| 30 | 00:01:03,470 → 00:01:04,940 | 1.47 s | Kiên (lời dẫn) | Và được giao quản lý cả cái tủ lạnh. |

\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ 0.8 s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở `episodes/EP003/exports/EP003.mp4` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.
