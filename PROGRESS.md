# PROGRESS

Ghi lại tiến độ để tiếp tục được khi phiên làm việc bị gián đoạn. Mục mới nhất ở trên cùng.

## Trạng thái hiện tại

- **2026-11-11: QUẢN LÝ TẬP + CHUẨN BỊ ĐĂNG ĐA NỀN TẢNG. Phần "ngay bây giờ" đã xong. Chưa upload, đăng hay đặt lịch thật.**
  - **Đã chạy và đã kiểm tra:**
    - Cấu trúc `episodes/EPxxx/{episode.json, script/, audio/, assets/, exports/, thumbnails/, social/, publishing/, reports/}`. Đường dẫn chỉ định nghĩa ở `tools/episode/paths.ts`.
    - EP001 đã chuyển sang cấu trúc mới. Render lại từ cấu trúc mới **trùng từng byte** với video đã duyệt (sha256 `8e4da809…`, 1899/1899 khung giống hệt).
    - `episode.json` với duyệt gắn hash; `episode:status` phát hiện "cần duyệt lại".
    - `episode:new`: thử 4 tiến trình chạy đồng thời (trong thư mục tạm), cấp EP002–EP005 không trùng.
    - `episode:stage-audio`.
    - Dry-run trên EP001 thật: 0/6 job sẵn sàng. Lý do đúng thực tế:
      - phụ đề chưa duyệt;
      - thumbnail 9:16 và ảnh nhá hàng 1:1 chưa có;
      - social chưa duyệt;
      - tài khoản đích và token chưa có;
      - chưa có lịch.
    - Giả lập trên bản sao (thư mục tạm, đã xoá), các nhánh đều đúng:
      - đặt lịch giờ VN đổi sang UTC;
      - từ chối giờ đã qua và ngày không tồn tại;
      - tranh khóa giữa hai tiến trình;
      - Facebook hẹn quá 29 ngày bị chặn;
      - job lỡ giờ chuyển missed;
      - job trùng khóa chống trùng bị chặn;
      - sửa tiêu đề sau khi duyệt chuyển thành "cần duyệt lại";
      - log ghi đủ.
  - **Mới chỉ thiết kế (chưa có code):**
    - Bộ thực thi upload và đặt lịch thật (adapter YouTube, Facebook).
    - Đối chiếu trạng thái trên nền tảng sau timeout.
    - Bộ lập lịch tự chuyển job sang missed khi chạy.
    - Tạo thumbnail 9:16 và ảnh nhá hàng 1:1.
    - Gói xuất cho TikTok để đăng thủ công.
  - **Đề xuất:** tích hợp YouTube trước, Facebook Page sau; TikTok đăng thủ công (xem `docs/publishing-platforms.md`).
  - **Chờ người dùng:**
    - Tài khoản và quyền truy cập (bảng trong `docs/publishing-platforms.md`).
    - Duyệt social và phụ đề.
    - Quyết định làm thumbnail và ảnh nhá hàng.
    - Lịch đăng đã xác nhận.
- **Quy tắc thời lượng mới (2026-11-11):** tối thiểu 60 s, mục tiêu 60–90 s, được vượt nếu diễn biến cần. Thời lượng tính từ timeline thực tế, `durationInFrames = ceil(contentEndSec × fps)`. Đã bỏ quy tắc "đúng 60 s / 1800 khung hình".
- **EP001: VIDEO ĐÃ DUYỆT 2026-11-11** (`episodes/EP001/exports/EP001.mp4`, bản gốc vẫn ở `out/EP001.mp4`; sha256 `8e4da809…`; duyệt ghi trong `episodes/EP001/episode.json` → `approvals.video`). Không tự đăng lên mạng xã hội.
  - Bước tiếp theo: chờ người dùng giao việc (ví dụ tập EP002).
  - 63,317 s, 1899 khung hình, 1080x1920 @30, h264 yuv420p + aac.
  - `npm run episode:verify` đạt cả 10 mục.
  - Dựng lại: `npm run render:ep001`.
- **EP001: kịch bản và âm thanh 63,27 s (1899 khung hình) ĐÃ DUYỆT 2026-11-11.** Ghi trong `episodes/EP001/episode.json` → `approvals` (âm thanh kèm cache key của từng câu đã duyệt.
  - **Không tạo lại** các câu đã duyệt. Nếu sửa lời thì chỉ tạo lại đúng câu đó và báo người dùng.
  - Phong cách hình ảnh: bộ rig SVG 2D hiện có, chưa có quyết định thay đổi.
  - Thư mục theo cấu trúc mới (xem CLAUDE.md, mục "Cấu trúc thư mục").
  - Dựng lại âm thanh từ cache: `npm run episode:audio -- EP001`. Xuất lại `script.md`: `npm run episode:docs -- EP001`. Rà soát kịch bản: `npm run script:lint -- EP001`.
- **Người kể = giọng Kiên** (lời dẫn của Kiên, ngôi thứ nhất), chốt 2026-11-11, ghi trong `config/casting.json` và CLAUDE.md.
- **Tối đa hai nhân vật có thoại trong mỗi cảnh** (thay quy tắc cũ "mỗi tập"), chốt 2026-11-11.
- Phong cách hình ảnh đang lưu: hoạt hình 2D, rig SVG phẳng. Không có quyết định Ghibli nào.
- **2026-11-11: người dùng DUYỆT bộ giọng.**
  - Kiên `ref:806c4f55…`, Trinh `ref:b07ad222…`, Sếp `ref:f19ba795…`. Chi tiết trong `config/casting.json` → `approved`.
- **2026-11-11: quyết định chính thức về xưng hô và vùng giọng** (chi tiết trong CLAUDE.md, mục "Ngôn ngữ kịch bản"):
  - Kiên/Trinh gọi "sếp", xưng "em". Sếp xưng "anh", gọi "em" hoặc "các em". Kiên–Trinh xưng anh–em.
  - Sếp nói miền Bắc (giọng `voice_sep.mp4` đã duyệt); Kiên, Trinh, người kể nói miền Nam.
- Bản đối thoại thử gần nhất (lịch sử): `out/tts-vieneu/vieneu-dialogue-04/`.
- (Trạng thái trước khi duyệt) Giai đoạn: tham chiếu mới, chờ duyệt kết quả. Kiên, Trinh và Sếp đều dùng giọng tham chiếu (clone).
  - Kiên dùng `voice_kien_02.mp4`, Trinh dùng `voice_trinh.mp4`, Sếp dùng `voice_sep.mp4`.
  - Người dùng đã xác nhận quyền cho cả 3 file ngày 2026-11-11.
- Đã xuất mẫu:
  - `out/tts-vieneu/vieneu-dialogue-03/`: từng lượt và file ghép.
  - `out/tts-vieneu/vieneu-stability-03/`: câu mới cho Kiên và Sếp.
  - `out/voice-refs/`: các đoạn tham chiếu đã trích.
- Đang chờ người dùng: nghe và duyệt. Lưu ý Sếp được clone từ nguồn ghi nhãn **nam miền Bắc** (người dùng chọn "vẫn thử để nghe").
- Sau khi duyệt:
  1. Ghi `approved` (voice ID `ref:<sha256>`) vào `config/casting.json`.
  2. Chốt cách xưng hô Trinh–Kiên.
  3. Viết lại lời thoại video mẫu, rồi mới tạo âm thanh cho cả tập.
- **Chưa thay giọng chính thức, chưa tạo lại video.**

## Nhật ký

### 2026-11-11 — Quản lý tập và chuẩn bị đăng đa nền tảng

- [x] Chuyển EP001 sang cấu trúc thư mục mới:
  - Dùng `git mv` cho các file đã theo dõi.
  - Video đã duyệt được **sao chép** sang `exports/` (bản `out/EP001.mp4` vẫn giữ); hash trước và sau trùng nhau.
  - Đường dẫn trong `timeline.json` và `qa-report.md` đã cập nhật.
  - Trạng thái duyệt chuyển từ `script.json` sang `episode.json`; hash nội dung kịch bản không đổi.
- [x] Công cụ mới:
  - `tools/episode/{paths,manifest}.ts` và các lệnh `new`, `status`, `stage-audio`.
  - `tools/publish/jobs.ts`: trạng thái và chuyển trạng thái hợp lệ, khóa xử lý, khóa chống trùng, log che bí mật, đổi giờ VN sang UTC, quy tắc missed.
  - Lệnh `publish:plan` và `publish:dry-run`.
- [x] Dữ liệu mới:
  - `config/publishing.json`: tài khoản đích còn null, chỉ ghi tên biến môi trường; khả năng từng nền tảng.
  - `episodes/EP001/social/social.json`: nháp, có `spoilerGuard`.
  - `episodes/EP001/publishing/jobs.json`: 6 job ở trạng thái draft, chưa có lịch.
  - `docs/publishing-platforms.md`.
- [x] Kiểm tra: render lại trùng từng byte; dry-run chạy trên dữ liệu thật và trên bản giả lập; lint sạch.

### 2026-11-11 — Dựng video EP001

- [x] Bộ dựng tập `src/episode/EpisodeVideo.tsx` (dùng lại rig, nền, bàn, phụ đề có sẵn), kiểu dữ liệu ở `src/episode/types.ts`.
  - Đọc thẳng `episodes/EP001/ep001.json` + `timeline.json` (bật `resolveJsonModule`); `durationInFrames` = 1899 lấy từ timeline.
  - Nhân vật: biểu cảm/tư thế theo gợi ý câu thoại; `talking` theo khoảng lời; người nghe nhìn người nói. Lời dẫn là giọng ngoài hình.
- [x] Dữ liệu dàn cảnh `src/episodes/ep001-staging.ts`:
  - 6 cảnh: văn phòng ×4, phòng họp, pantry.
  - Camera zoom ở các nhịp phản ứng.
  - Thẻ: tiến trình "Báo cáo tuần", danh sách yêu cầu báo cáo, montage đồng hồ quay + cốc cà phê, lịch họp 7 buổi, chữ "+3 giờ / −7 giờ".
  - Trinh rời khung ở a08.
  - `cues` biểu cảm cho các nhịp hành động, bám mô tả trong kịch bản.
- [x] Thẻ mới `src/ui/EpisodeCards.tsx`. Phụ đề tự thu cỡ chữ 58 px xuống tối đa 48 px để giữ ≤ 2 dòng (`SUBTITLE_STYLE.minFontSize`). Lý do: render báo câu s01 cần 3 dòng ở 58 px; lời đã duyệt không sửa.
- [x] Sửa sau khi xem khung mẫu: thẻ che đầu Sếp (S3), chữ "Thứ Bảy → Chủ nhật" bị tràn, "+3/−7 giờ" chồng tủ bếp, cốc cà phê che laptop, nhịp hành động thiếu biểu cảm.
- [x] Âm thanh: `public/audio/episodes/EP001/dialogue.wav` trùng từng byte với `dialogue-preview.wav` đã duyệt (thư mục bị Git bỏ qua).
- [x] Render `out/EP001.mp4` (17,9 MB, ~1 phút 44 giây ở concurrency 3).
  - `tools/tts/cli/episode-verify.ts`: đạt cả 10 mục.
  - Điểm vào lời trong MP4 khớp timeline (ví dụ 4,608 s so với 4,61 s).
- [x] Người dùng duyệt video EP001 ngày 2026-11-11.

### 2026-11-11 — Bỏ ràng buộc 60 s cố định, EP001 theo timeline tự nhiên

- [x] Rà ràng buộc cố định 60 s / 1800 khung hình. Đã sửa ở:
  - CLAUDE.md: mục tiêu, nguyên tắc, bảng thông số, kiểm tra video cuối, phần TTS.
  - README.
  - `episode-audio.ts`, `script-lint.ts`, `episode-docs.ts`.
  - `ep001.json`: `durationSec: 60` thay bằng `duration { minSec: 60, targetRangeSec: [60, 90] }`.
  - Composition demo 10 s và TechCheck 5 s là bài kiểm tra kỹ thuật, giữ nguyên.
- [x] `episode-audio.ts` viết lại phần timeline:
  - Câu ở nhịp tự nhiên; mỗi nhịp hành động có `sec` theo nội dung.
  - Tổng = điểm kết thúc mục cuối; `durationInFrames = ceil(total × fps)`; âm thanh chỉ đệm tới ranh giới khung hình cuối.
  - Đã bỏ phân bổ phần dư vào min–max và bỏ cắt mẫu cho đúng 60 s.
  - Dưới 60 s thì dừng (mã 2), không chèn lặng.
- [x] Kiểm tra âm thanh EP001 cũ:
  - Không câu nào bị tăng tốc, time-stretch hay đổi pitch.
  - Chỉ bỏ lặng đuôi (giữ ≥ 120 ms sau lời); bản thô trùng cache. Phần duy nhất bị ép là các nhịp lặng.
- [x] EP001 ở nhịp tự nhiên dài 58,56 s, dưới 60 s. Bổ sung diễn biến trong S3:
  - k05a (Kiên): "Hay em gửi công cụ luôn, bấm thử là thấy liền."
  - s03b (Sếp): "Công cụ thì anh không đọc. Anh đọc báo cáo."
- [x] s03b lần đầu bị clip thật trong bản TTS gốc (đỉnh 0 dBFS, 14 mẫu cắt phẳng). Đã chuyển sang `cache/tts/rejected/` và tạo lại; bản mới sạch. Quét 25 câu còn lại không có clip.
- [x] Kết quả:
  - 26 câu, trong đó 25 câu dùng lại từ cache.
  - Nội dung 63,27 s, tức 1899 khung hình (63,300 s).
  - QC không có cờ; không có khoảng lặng ≥ 1,6 s. 26 cue SRT theo timeline mới.
  - `script.md` và `qa-report.md` đã cập nhật.
- [x] Người dùng duyệt EP001 (kịch bản và âm thanh) ngày 2026-11-11.

### 2026-11-11 — EP001: kịch bản và âm thanh 60 giây

- [x] Người kể chốt dùng giọng Kiên: `casting.json` → `narrator.approved` giống hệt `kien.approved`, thêm `sameVoiceAs: "kien"`.
- [x] Kịch bản EP001 "Công cụ tiết kiệm thời gian": 6 cảnh, 24 câu, 9 nhịp hành động. Dữ liệu ở `episodes/EP001/ep001.json`.
  - Tự rà soát bằng `tools/tts/cli/script-lint.ts`: số người nói mỗi cảnh, độ dài câu, từ miền Nam trong lời Sếp, cách xưng hô.
- [x] Công cụ mới:
  - `tools/tts/cli/episode-audio.ts`: dùng giọng đã duyệt theo vai, kiểm tra quyền, sha và model; cache; cắt khoảng thừa đã xác nhận; cân LUFS. Khớp đúng 60 s bằng cách phân bổ phần dư vào các nhịp hành động trong khoảng min–max, không kéo giọng, không chèn lặng dài. Báo "quá dài" hoặc "quá ngắn" nếu không khớp được.
  - `tools/tts/cli/episode-docs.ts`: xuất `script.md` với mốc thời gian đo thật.
- [x] Lần dựng đầu: hành động dùng 92% mức tối đa (có khoảng lặng 2,03 s). Thêm câu t03b "Dạ, em lên lịch liền cho sếp." (Trinh đẩy diễn biến). Lần cuối dùng ~65%, không có khoảng lặng ≥ 1,8 s.
- [x] Kết quả:
  - Preview đúng 60,000 s (2.880.000 mẫu). Mọi câu −21,1 LUFS, file −21,4 LUFS, true peak −1,5 dBTP.
  - QC không có cờ. 24 cue SRT tuần tự, không chồng. Chi tiết trong `episodes/EP001/qa-report.md`.
- [x] `.gitignore`: bỏ qua `episodes/*/*.wav` và `episodes/*/lines/`.
- [x] Người dùng duyệt EP001 (kịch bản và âm thanh) ngày 2026-11-11.

### 2026-11-11 — Xưng hô và vùng giọng chính thức

- [x] Cập nhật:
  - CLAUDE.md: hồ sơ Sếp, bảng giọng, quy tắc phân vai theo vùng, mục "Ngôn ngữ kịch bản" viết lại với bảng xưng hô và ví dụ.
  - `CHARACTER_BIOS.sep` trong `src/characters/designs.ts`; ảnh `out/character-sheet.png` đã xuất lại.
  - `config/casting.json`: thêm `addressing`, `region` cho từng vai, định hướng Sếp. Câu mẫu Kiên/Trinh sửa theo quy tắc mới, câu cũ lưu ở `sampleTextHistory`.
  - `config/voice-refs.json`: xung đột vùng giọng của Sếp ghi là đã giải quyết.
- [x] Code: `vieneu-dialogue.ts` kiểm tra vùng giọng preset theo `region` của từng vai trong `casting.json` (Sếp: Bắc), thay vì luôn bắt buộc miền Nam.
- [x] Âm thanh bị ảnh hưởng, chỉ tạo lại lượt bị ảnh hưởng (bản `dialogue-03` giữ nguyên làm lịch sử):
  - `dialogue-04` lượt 1, Kiên: "Dạ anh…" thành "**Dạ sếp**, em làm xong hết rồi. Hôm nay em về đúng giờ nha?" (tạo mới, 2,88 s).
  - `dialogue-04` lượt 2, Sếp: "Tốt. Vậy em làm giùm phần của Trinh luôn đi." thành "Tốt. **Thế** em làm **giúp** phần của Trinh luôn **nhé**." theo cách nói miền Bắc (tạo mới, 2,29 s).
  - Lượt 3 (Trinh: "anh Kiên… nhờ anh", đúng anh–em) và lượt 4 (Kiên): giữ nguyên, cùng cache key với bản 03.
  - File ghép 10,26 s, −18,6 LUFS, true peak −1,5 dBTP. Khoảng lặng 0,22 / 0,25 / 0,55 s. QC không có cờ. Timeline mới trong `summary.json`.
  - Giọng, model, thiết lập đã đối chiếu khớp `approved` trước khi tạo.
- Không tạo lại: `stability-03` (câu Sếp còn "đó", "nha"; là bản thử dùng để duyệt giọng, đánh dấu lịch sử). `vieneu-samples-01`, `dialogue-01/02*`, `sep-candidate-*` là lịch sử preset.
- Video mẫu (`demo-notification.ts`) không đổi: thông báo của Sếp ("Chúc mừng em… nhé") đã đúng quy tắc mới, phụ đề không có xưng hô cũ.

### 2026-11-11 — Nguồn tham chiếu mới cho Kiên và Sếp

- [x] Nguồn (file gốc giữ nguyên, sha256 kiểm tra lại không đổi):
  - `D:/Download/voice_kien_02.mp4`: sha256 `7c0ad211…`, AAC 48 kHz mono, 41,0 s. Video dọc của kênh @vieneu.
  - `D:/Download/voice_sep.mp4`: sha256 `59c04b27…`, AAC 48 kHz stereo, 48,1 s. Quay màn hình VieNeu-TTS Studio bản cũ (SafeTensor GPU, NeuCodec). Ô giọng mẫu ghi **"Bình (nam miền Bắc)"** ở 2 s, 30 s và 46 s; ảnh chụp ở `out/voice-refs/sep_nguon_ghi_nam-mien-Bac.png`.
- [x] Kiểm tra kỹ thuật (`analyze_ref.py`, `ref_extra.py`):
  - **Kiên 02:** sạch. Khoảng nghỉ là lặng tuyệt đối (dấu vết noise gate từ bước người dùng lọc tạp âm). Không clip, dải tần ~10,5 kHz, có vẻ một giọng nam (F0 158 Hz). Không khử nhiễu thêm.
  - **Sếp:** sạch (khoảng nghỉ −85 dB). Mức rất nóng (đỉnh −0,04 dBFS, 242 mẫu > −0,5 dBFS) nhưng không có đỉnh bị cắt phẳng. Có vẻ một giọng nam (F0 107 Hz).
- [x] Đoạn tham chiếu: cắt trong khoảng nghỉ, đã kiểm tra mức âm ở hai đầu, giữ trọn đuôi tắt dần. Bản để nghe ở `out/voice-refs/`.
  - Kiên: 7,50–11,86 s (4,36 s), sha256 `806c4f55…`.
  - Sếp: 38,70–43,76 s (5,06 s), sha256 `f19ba795…`.
- [x] Cấu hình:
  - `config/voice-refs.json`: thêm `kien` (mới) và `sep`. Bản Kiên cũ chuyển thành `kien_v1`, không dùng.
  - `config/casting.json` cập nhật. `dialogue-02a`, `dialogue-02b`, `stability-02` đánh dấu đã thay thế.
- [x] Cache: voice ID là `ref:<sha256 của đoạn trích>`, nên không thể dùng nhầm cache của Kiên cũ hay của preset Sếp. Thiết lập giữ nguyên như các lần trước, chỉ thêm `ref_denoise=false`.
- [x] Cổng quyền đã thử: `dialogue-03` và `stability-03` bị chặn đúng khi chưa có xác nhận.
- [x] Người dùng xác nhận quyền cho `voice_kien_02.mp4`, `voice_trinh.mp4`, `voice_sep.mp4` (ghi trong `config/voice-refs.json`, kèm ngày). Về Sếp, người dùng chọn "Vẫn thử để nghe" dù nguồn là giọng Bắc.
- [x] `dialogue-03`: cả ba vai đều clone, lời giữ nguyên `dialogue-01`, `ref_denoise=false`.
  - 4 lượt: Kiên 2,75 s, Sếp 2,65 s, Trinh 3,36 s, Kiên 1,31 s.
  - File ghép 10,49 s, −20,7 LUFS, true peak −1,5 dBTP. Mục tiêu tự hạ từ −18 xuống −20,7 vì lượt Sếp có peak cao.
  - Khoảng lặng giữa lời 0,22 / 0,25 / 0,55 s. QC không có cờ, giải mã không lỗi.
  - Trinh chưa có bản clone hợp lệ nào trước đó (các bản cũ là preset Mỹ Duyên), nên đã tạo mới.
- [x] `stability-03` (câu mới, không có trong tham chiếu):
  - Kiên 3,12 s, Sếp 4,38 s. File ghép 7,53 s, −18,1 LUFS, QC không có cờ.
- [x] Chỉ số khách quan (không phải đánh giá nghe), cao độ trung vị F0 của bản tạo so với tham chiếu:
  - Kiên 156–158 Hz, tham chiếu 157 Hz.
  - Sếp 101–103 Hz, tham chiếu 105 Hz.
  - Trinh 236 Hz, tham chiếu ~229 Hz.
- Tốc độ Kiên 5,1–5,45 âm tiết/s, nhanh hơn các vai khác nhưng vẫn trong ngưỡng QC. Chưa có ASR nên chưa kiểm tra được bỏ hay lặp từ.
- [ ] Người dùng nghe và duyệt.

### 2026-11-11 — Giọng tham chiếu mới cho Kiên/Trinh, ứng viên Sếp

- [x] Nguồn (giữ nguyên file gốc, chỉ trích âm thanh sang `cache/voice-refs/`):
  - `D:/Download/voice_kien.mp4`: sha256 `552a96f3…`, 40,4 s, AAC 44,1 kHz. Khung hình cho thấy video giải thích khoa học về Edward Lorenz, có logo kênh, tức giọng người dẫn của bên thứ ba.
  - `D:/Download/voice_trinh.mp4`: sha256 `9699f641…`, 33,4 s, AAC 48 kHz. Khung hình cho thấy quay màn hình VieNeu-TTS Studio đang chạy voice cloning, tức audio nhiều khả năng do máy tạo.
- [x] Phân tích kỹ thuật (`tools/tts/vieneu/analyze_ref.py`, kết quả ở `cache/voice-refs/*/analysis.json`):
  - **Kiên:** mọi khoảng nghỉ có nền liên tục −46 đến −50 dB, đỉnh phổ ~100–105 Hz, độ phẳng phổ 0,0009, tức nhạc nền hoặc tiếng ù, chỉ thấp hơn lời ~24 dB. **Không đạt độ sạch.** Không clip, có vẻ một người nói.
  - **Trinh:** khoảng nghỉ −50 đến −240 dB, vang thấp, không clip, có vẻ một giọng nữ (F0 trung vị 229 Hz). **Đạt về kỹ thuật.**
  - Chưa có công cụ phân tách người nói hay nhận dạng giọng nói (ASR) để khẳng định số người nói.
- [x] Yêu cầu của vieneu 3.8.4 (đọc từ mã nguồn đã cài):
  - Tham chiếu tối đa 8,0 s, không dùng transcript.
  - `denoise` mặc định True (bộ khử nhiễu neural, đổi sang 44,1 kHz); dự án đặt False.
- [x] Đoạn tham chiếu đã cắt, ranh giới nằm trong khoảng nghỉ, đã kiểm tra không cắt ngang từ:
  - Kiên 23,94–30,64 s (6,7 s), sha256 `1828489f…`, **KHÔNG DÙNG** vì nguồn bẩn.
  - Trinh 16,26–23,98 s (7,72 s), sha256 `b07ad222…`.
  - Bản để nghe ở `out/voice-refs/`.
- [x] Adapter hỗ trợ clone:
  - Voice ID `ref:<sha256>`, truyền `ref_audio`, `ref_denoise=false`.
  - Cổng chặn trong `vieneu-dialogue.ts`: chưa xác nhận quyền, nguồn không đạt, hoặc dài hơn 8 s thì không clone.
- [x] Ứng viên Sếp từ nguồn hiện có: 4 preset nam có metadata region Nam, đo bằng `voice_metrics.py` (cao độ trung vị F0).
  - Chọn **Adam** (F0 ~85 Hz, dải hẹp 3,3 semitone) và **Đức Trí** (F0 ~100 Hz, dải 9,4 semitone).
  - Câu Sếp đã tạo, cân −18 LUFS: `out/tts-vieneu/vieneu-sep-candidate-a/` (Adam, 2,25 s) và `-b/` (Đức Trí, 2,90 s).
  - **Không khẳng định "trên 50 tuổi".** Nếu nghe không đạt thì cần audio tham chiếu bổ sung cho Sếp.
- [ ] Người dùng xác nhận quyền, cung cấp nguồn Kiên sạch hơn, nghe ứng viên Sếp.

### 2026-11-11 — Hội thoại thử bằng bộ giọng ứng viên

- [x] Voice ID tra từ log, không lấy từ tên file. `summary.json`, metadata cache và `ledger.jsonl` khớp nhau:
  - Kiên: `Thái Sơn` (từ mẫu 04).
  - Trinh: `Mỹ Duyên` (từ mẫu 06).
  - Sếp: `Đức Trí` (từ mẫu 08).
  - Thiết lập giống nhau: temperature 0.8, top_k 25, top_p 0.95, repetition_penalty 1.2, max_chars 256, silence_p 0.15, không watermark.
- [x] Script `npm run tts:vieneu:dialogue` (`tools/tts/cli/vieneu-dialogue.ts`, dữ liệu `tools/tts/auditions/dialogue-01.json`) gồm các bước:
  - Tạo từng lượt riêng (có cache), lưu bản thô trong `raw/`.
  - Cắt khoảng đầu/cuối **chỉ khi xác nhận là nền** (`tools/tts/audio.ts`, `EDGE_RULES`):
    - Đầu: nền có đỉnh dưới −35 dBFS và lời vào cao hơn nền ít nhất 15 dB. Giữ 80 ms trước lời, trong đó 30 ms là âm tấn công.
    - Cuối: giữ 60 ms tắt dần cộng 120 ms sau lời.
    - Fade chỉ áp lên phần đệm, không chạm vào lời.
  - Cân âm lượng theo EBU R128 (LUFS, không cân theo peak), dùng gain tuyến tính.
    - Mục tiêu −18 LUFS, tự hạ xuống −18,9 để true peak không vượt −1,5 dBTP.
  - Khoảng lặng tính từ hết lời lượt trước tới đầu lời lượt sau: 0,22 s giữa các lượt, 0,55 s trước câu chốt.
- [x] Kết quả:
  - 4 lượt dài 3,77 / 2,90 / 4,40 / 1,94 s, mỗi lượt −18,9 LUFS.
  - File ghép 13,47 s, −19,0 LUFS, true peak −1,5 dBTP. WAV 48 kHz mono PCM16, giải mã không lỗi, QC không có cờ.
- [x] Khoảng lặng đầu của mẫu Trinh cũ (`06_trinh__my-duyen.wav`):
  - 0–1,82 s là nền (RMS trung vị −54,8 dB, không cửa sổ 10 ms nào vượt −45 dB RMS).
  - Đỉnh −34,6 dBFS ở 1,82 s là âm tấn công của tiếng đầu.
  - Lượt Trinh mới không gặp lại lỗi này (lời vào ở 0,06 s).
- [x] Khoảng cắt đầu duy nhất: lượt Sếp, phần đầu là lặng tuyệt đối khoảng −94 dB RMS.
- Ghi chú ngôn ngữ: trong đoạn này Trinh gọi "anh Kiên", xưng "em". Mẫu trước Trinh gọi Kiên là "ông". Cần chốt một cách xưng hô cho cặp Trinh–Kiên.
- [ ] Người dùng nghe và duyệt bộ giọng.

### 2026-11-11 — VieNeu-TTS cục bộ, mẫu nghe thử

- [x] Phần cứng: i5-7500 (4 nhân/4 luồng, không có VNNI), RAM 16 GB, Intel HD 630, không có CUDA. C: còn 17,6 GB, D: còn 88,8 GB. Chạy bằng CPU.
- [x] Cài đặt: `vieneu==3.8.4` (Apache-2.0) trong `tools/tts/vieneu/.venv` (Python 3.13.17).
  - Model v3 Turbo, ONNX, CPU, fp32.
  - Phiên bản: onnxruntime 1.31.1, sea-g2p 0.10.0.
  - Model `pnnbao-ump/VieNeu-TTS-v3-Turbo@61b85e3d937fbbacb387714180e8182823512523`, tokenizer `OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX@ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae`.
  - Cache model ở `cache/hf`, khoảng 581 MB.
  - Không dùng v4 hay vieneu.io (trả phí), không dùng 0.3B GGUF (CC BY-NC).
- [x] Thông số đo được: nạp model 56 s lần đầu (có tải về), 14 s các lần sau. Mỗi mẫu 3–7 s âm thanh mất khoảng 3–5 s để tạo. Đầu ra 48 kHz mono, lưu WAV PCM16.
- [x] Giọng: metadata của gói có 25 giọng, 8 giọng `region = Nam`.
  - Nam: Adam (tu_nhien), Thái Sơn (kể chuyện), Minh Triết (tin tức), Đức Trí (đọc truyện).
  - Nữ: Thùy Dung (tin tức), Thục Đoan (kể chuyện), Mỹ Duyên (đọc truyện), Kim Thanh (đọc truyện).
  - Metadata không có tuổi.
- [x] Phân vai ứng viên (`config/casting.json`, đều **chưa duyệt**):
  - Kiên: Adam, Thái Sơn. Người kể tạm dùng chung hai giọng này.
  - Trinh: Thùy Dung, Mỹ Duyên.
  - Sếp: Minh Triết, Đức Trí.
- [x] Adapter `VieneuProvider` (`tools/tts/vieneu.ts`): một tiến trình Python giữ model, dùng chung cache, sổ và retry.
  - Thiết lập: temperature 0.8, top_k 25, top_p 0.95, repetition_penalty 1.2, max_chars 256, silence_p 0.15, không watermark.
  - Không có seed, nên kết quả mỗi lần tạo không cố định.
  - Không có timestamp. Đề xuất căn phụ đề theo câu bằng thời lượng đo được (xem CLAUDE.md).
- [x] Kiểm tra kỹ thuật (`tools/tts/qc.ts`, ffmpeg): chỉ mẫu 06 Trinh/Mỹ Duyên bị cờ, khoảng lặng đầu dài 1,83 s.
  - Chưa kiểm tra tự động được việc bỏ hay lặp từ (không có ASR), cần nghe.
- [ ] Người dùng nghe và duyệt giọng.

### 2026-11-11 — Đổi tên nhân vật

- [x] Nam đổi thành **Kiên** (ID `kien`), Linh đổi thành **Trinh** (ID `trinh`). Sếp giữ nguyên. Ngoại hình và tính cách không đổi.
- [x] Cập nhật:
  - Kiểu dữ liệu, thiết kế, hồ sơ, kiểu tóc (`kienShort`, `trinhLong`), màu người nói.
  - Dữ liệu cảnh mẫu và phụ đề.
  - CLAUDE.md (thêm mục Nhân vật), README, `assets/LICENSES.md`.
- [x] Âm thanh: chưa có file nào đọc tên nhân vật. Các mẫu TTS dùng đoạn hài không có tên riêng, nên không cần tạo lại.
- [x] Xuất lại hai file có hiện tên: `out/demo-notification.mp4` (phụ đề, nhãn người nói) và `out/character-sheet.png` (nhãn tên). Ảnh bối cảnh không có tên nên giữ nguyên.

### 2026-11-10 — Edge TTS

- [x] Python 3.13.17 (winget, cài cho riêng người dùng). Môi trường riêng `tools/tts/edge/.venv` với `edge-tts==7.3.1`.
  - Giấy phép thư viện: LGPLv3, riêng `srt_composer.py` theo MIT.
  - Quyền dùng thương mại audio: **chưa xác minh**.
- [x] Adapter `EdgeTtsProvider` (`tools/tts/edge.ts` và `edge/edge_synth.py`) dùng chung cache, sổ ký tự và retry (tối đa 3 lần, chỉ khi timeout hoặc lỗi mạng). Lỗi không bao giờ chuyển sang dịch vụ trả phí.
- [x] Danh sách giọng lấy trực tiếp (322 giọng): vi-VN có `vi-VN-HoaiMyNeural` (nữ) và `vi-VN-NamMinhNeural` (nam).
- [x] Mẫu NamMinh: `out/tts-edge/edge-samples-01/02_vi-VN-NamMinhNeural.mp3` và `.srt`.
  - MP3 24 kHz mono 48 kbps, dài 21,24 giây (đo bằng ffprobe).
  - Đoạn 221 ký tự, tức khoảng 10,4 ký tự/giây ở tốc độ mặc định.
  - SRT có 9 cue theo câu; cue 1 và cue 2 chồng nhau khoảng 50 ms.
- [ ] Mẫu HoaiMy: lỗi `NoAudioReceived` với đoạn đầy đủ.
  - Thử từng câu: câu 1, 2, 4 đọc được; các câu còn lại lỗi.
  - Thử lại sau 2 phút: cả HoaiMy và **NamMinh** đều lỗi với câu ngắn. Vậy nhiều khả năng dịch vụ đang tạm từ chối máy này vì gửi dồn dập, không phải lỗi do giọng hay nội dung.
  - Đã dừng gửi. Lần sau chỉ chạy lại một lần `npm run tts:edge:samples` (NamMinh lấy từ cache, chỉ gửi HoaiMy).
  - Ngoài sổ: khoảng 315 ký tự gửi trực tiếp bằng CLI để chẩn đoán, không ghi vào `ledger.jsonl`.

### 2026-11-10 — Chuẩn bị TTS

- [x] Người dùng chọn ElevenLabs để thử, chưa chốt giọng dùng lâu dài.
- [x] Đã xác minh qua docs chính thức và SDK `@elevenlabs/elevenlabs-js` 2.77.0:
  - Model tiếng Việt: `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`. `eleven_multilingual_v2` không có tiếng Việt.
  - Endpoint `/v1/text-to-speech/{voice_id}/with-timestamps` trả alignment theo ký tự.
  - v4 chỉ dùng stability và similarity (không có style hay speed).
  - Gói Free không dùng được giọng Voice Library qua API.
  - Giọng Default ngừng ngày 31/12/2026.
- [x] Xây `tools/tts/`: adapter `TtsProvider`, cache theo nội dung, sổ ngân sách chặn trước request, retry tối đa 2 lần, đo thời lượng bằng ffprobe và đo credit thực.
- [x] Đã kiểm tra bằng nhà cung cấp giả (không gọi mạng): timeout và lỗi đều bị tính, ngân sách dừng trước request vượt mức, cache không tốn thêm.
- [x] Kế hoạch nghe thử `audition-01`:
  - Đoạn thử 233 ký tự, có lời kể, câu ngỡ ngàng và câu chốt tỉnh bơ.
  - 3 giọng × 2 thiết lập (stability 0.6 và 0.35, similarity 0.8), dùng `eleven_v4`.
  - Kế hoạch 1.398 ký tự, ngân sách 2.000 ký tự.

### 2026-11-10 — Bộ hình ảnh 2D

- [x] Rig nhân vật SVG/React dùng chung (`src/characters/`): đầu, mắt, mày, miệng, tay (2 khớp), thân, chân tách riêng. 3 thiết kế: Kiên, Trinh, Sếp (ban đầu tên Nam, Linh; đổi tên ngày 2026-11-11).
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
