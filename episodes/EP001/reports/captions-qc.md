# Phụ đề EP001: kiểm tra

File: `episodes/EP001/exports/EP001.srt` · hash `94bcd2c6987fec85` · trạng thái duyệt: **chưa duyệt**

Tạo bằng `npm run episode:captions -- EP001` từ `episodes/EP001/script/timeline.json` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- 26 cue · 0 lỗi · 3 cảnh báo.
- Quy tắc: tối đa 2 dòng, 42 ký tự mỗi dòng. Hiển thị tối thiểu 0.8 s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa 20 ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video đã duyệt nằm trong cue, không có đoạn nói nào thiếu phụ đề.

- **GHI CHÚ** (cue 5): Lời dài 0.77 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **GHI CHÚ** (cue 7): Lời dài 0.47 s; giữ chữ trên màn hình 0.80 s (kéo vào khoảng lặng sau câu, không chồng câu sau).
- **CẢNH BÁO** (cue 16): Tốc độ đọc 20.5 ký tự/giây > 20.
- **CẢNH BÁO** (cue 22): Tốc độ đọc 20.5 ký tự/giây > 20.
- **CẢNH BÁO** (cue 26): Tốc độ đọc 20.5 ký tự/giây > 20.
- **GHI CHÚ**: Âm thanh lấy từ video đã duyệt (episodes/EP001/exports/EP001.mp4, 63.31 s). Cue cuối kết thúc 62.070 s; video dài 63.300 s.

## Xưng hô (để đối chiếu nhanh)

- 3. Trinh → Kiên: "Anh cười gì một mình vậy?"
- 6. Trinh → Kiên: "Thiệt hả? Vậy làm giùm em luôn nha."
- 8. Sếp: "Kiên này, nghe nói em có công cụ tiết kiệm thời gian à?"
- 9. Kiên → Sếp: "Dạ, mỗi tuần đỡ được ba tiếng."
- 10. Sếp: "Tốt. Thế em viết cho anh một báo cáo."
- 12. Kiên → Sếp: "Hay em gửi công cụ luôn, bấm thử là thấy liền."
- 13. Sếp: "Công cụ thì anh không đọc. Anh đọc báo cáo."
- 14. Kiên → Sếp: "Dạ, báo cáo về việc không phải làm báo cáo hả sếp?"
- 15. Sếp: "Đúng rồi. Sáng thứ Hai gửi anh nhé."
- 17. Sếp: "Báo cáo tốt lắm. Anh muốn cả phòng hiểu cách làm này."
- 18. Trinh → Sếp: "Sếp ơi, phòng kế toán với nhân sự cũng hỏi nữa."
- 20. Trinh → Sếp: "Dạ, em lên lịch liền cho sếp."
- 21. Trinh → Kiên: "Anh ơi, lịch họp tuần này của anh nè. Bảy buổi."
- 23. Trinh → Kiên: "Dạ. Mà anh yên tâm."
- 24. Trinh → Kiên: "Biên bản họp em làm bằng công cụ của anh rồi."

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
| 1 | 00:00:00,250 → 00:00:01,750 | 1.50 s | Kiên (lời dẫn) | Tôi tiết kiệm được ba tiếng mỗi tuần. |
| 2 | 00:00:01,950 → 00:00:03,390 | 1.44 s | Kiên (lời dẫn) | Đó là sai lầm lớn nhất đời tôi. |
| 3 | 00:00:04,610 → 00:00:05,840 | 1.23 s | Trinh | Anh cười gì một mình vậy? |
| 4 | 00:00:06,060 → 00:00:07,200 | 1.14 s | Kiên | Công cụ tự làm báo cáo nè. |
| 5 | 00:00:07,410 → 00:00:08,210 | 0.80 s * | Kiên | Bấm một cái là xong. |
| 6 | 00:00:09,160 → 00:00:11,170 | 2.01 s | Trinh | Thiệt hả? Vậy làm giùm em luôn nha. |
| 7 | 00:00:11,390 → 00:00:12,190 | 0.80 s * | Kiên | Ờ, cũng được. |
| 8 | 00:00:13,180 → 00:00:16,040 | 2.86 s | Sếp | Kiên này, nghe nói em có / công cụ tiết kiệm thời gian à? |
| 9 | 00:00:16,270 → 00:00:17,700 | 1.43 s | Kiên | Dạ, mỗi tuần đỡ được ba tiếng. |
| 10 | 00:00:17,920 → 00:00:20,070 | 2.15 s | Sếp | Tốt. Thế em viết cho anh một báo cáo. |
| 11 | 00:00:20,270 → 00:00:22,950 | 2.68 s | Sếp | Tiết kiệm bao nhiêu, / ở khâu nào, số liệu cụ thể. |
| 12 | 00:00:23,840 → 00:00:25,830 | 1.99 s | Kiên | Hay em gửi công cụ luôn, / bấm thử là thấy liền. |
| 13 | 00:00:26,050 → 00:00:28,330 | 2.28 s | Sếp | Công cụ thì anh không đọc. / Anh đọc báo cáo. |
| 14 | 00:00:28,550 → 00:00:30,790 | 2.24 s | Kiên | Dạ, báo cáo về việc không phải / làm báo cáo hả sếp? |
| 15 | 00:00:31,010 → 00:00:32,850 | 1.84 s | Sếp | Đúng rồi. Sáng thứ Hai gửi anh nhé. |
| 16 | 00:00:34,280 → 00:00:36,520 | 2.24 s | Kiên (lời dẫn) | Để chứng minh tiết kiệm ba tiếng, / tôi mất trọn cuối tuần. |
| 17 | 00:00:38,090 → 00:00:41,180 | 3.09 s | Sếp | Báo cáo tốt lắm. / Anh muốn cả phòng hiểu cách làm này. |
| 18 | 00:00:41,400 → 00:00:43,850 | 2.45 s | Trinh | Sếp ơi, phòng kế toán với / nhân sự cũng hỏi nữa. |
| 19 | 00:00:44,070 → 00:00:46,690 | 2.62 s | Sếp | Thế thì mỗi phòng một buổi họp. / Kiên trình bày nhé. |
| 20 | 00:00:46,910 → 00:00:48,750 | 1.84 s | Trinh | Dạ, em lên lịch liền cho sếp. |
| 21 | 00:00:50,170 → 00:00:52,700 | 2.53 s | Trinh | Anh ơi, lịch họp tuần này / của anh nè. Bảy buổi. |
| 22 | 00:00:52,920 → 00:00:54,090 | 1.17 s | Kiên | Bảy buổi? Mỗi buổi một tiếng? |
| 23 | 00:00:54,310 → 00:00:55,390 | 1.08 s | Trinh | Dạ. Mà anh yên tâm. |
| 24 | 00:00:55,590 → 00:00:58,040 | 2.45 s | Trinh | Biên bản họp em làm bằng / công cụ của anh rồi. |
| 25 | 00:00:59,190 → 00:01:00,600 | 1.41 s | Kiên (lời dẫn) | Công cụ tiết kiệm cho tôi ba tiếng. |
| 26 | 00:01:00,950 → 00:01:02,070 | 1.12 s | Kiên (lời dẫn) | Giải thích nó tốn bảy tiếng. |

\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ 0.8 s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở `episodes/EP001/exports/EP001.mp4` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.

Duyệt sau khi xem: `npm run episode:approve -- EP001 captions`
