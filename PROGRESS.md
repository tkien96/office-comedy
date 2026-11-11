# PROGRESS

Ghi lại tiến độ để tiếp tục được khi phiên làm việc bị gián đoạn. Mục mới nhất ở trên cùng.

## Trạng thái hiện tại

- **2026-11-11: người dùng DUYỆT bộ giọng.**
  - Kiên `ref:806c4f55…`, Trinh `ref:b07ad222…`, Sếp `ref:f19ba795…`. Chi tiết trong `config/casting.json` → `approved`.
  - Người kể chưa chọn.
- Bước tiếp theo, chờ người dùng giao:
  1. Chọn giọng người kể.
  2. Chốt cách xưng hô Trinh–Kiên.
  3. Viết lại lời thoại video mẫu theo giọng miền Nam.
  4. Tạo âm thanh từng cue bằng giọng đã duyệt, rồi căn phụ đề theo `timeline`.
  - **Chưa tạo lại video.**
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
