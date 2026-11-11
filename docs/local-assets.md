# Tài nguyên chỉ có trên máy local (không đưa vào Git)

Repository GitHub `tkien96/office-comedy` đang để **công khai**. Các tài nguyên dưới đây **không** được đưa lên vì:

- là giọng clone hoặc giọng tham chiếu của người thật;
- là sản phẩm chưa phát hành;
- là bản xuất hoặc cache tạo lại được;
- hoặc là model tải về.

Repo không dùng Git LFS. Hash dưới đây dùng để xác nhận đúng bản khi khôi phục. Bản gốc chỉ còn trên máy làm việc tại `D:\Projects\office-comedy`, nên **cần tự sao lưu riêng** (ổ ngoài hoặc kho riêng tư), nhất là các mục ghi "không tạo lại được".

Ghi ngày 2026-11-11.

## Không tạo lại được (cần sao lưu)

| Tài nguyên | Vị trí | Hash / ghi chú | Vì sao không đưa lên |
|---|---|---|---|
| File giọng tham chiếu gốc | `D:/Download/voice_kien_02.mp4`, `voice_trinh.mp4`, `voice_sep.mp4` (ngoài dự án) | Đường dẫn ghi trong `config/voice-refs.json` | Giọng người thật; quyền dùng chỉ để clone, không để phát tán |
| Đoạn tham chiếu đã cắt | `cache/voice-refs/` (33 MB) | Kiên `806c4f55…`, Trinh `b07ad222…`, Sếp `f19ba795…` (voice ID = `ref:<sha256>`) | Như trên. Cắt lại được từ file gốc theo mốc trong `config/voice-refs.json` |
| Âm thanh EP001 đã duyệt | `episodes/EP001/audio/dialogue-preview.wav` (bản chép ở `public/audio/episodes/EP001/dialogue.wav`) | `801e4d91e9c190f746d90bcd4c6d13f4e773e8be1b7f203c749cf9afa855ad2f` | Giọng clone. VieNeu không có `seed`, nên tạo lại sẽ **khác** bản đã duyệt |
| Từng câu thoại EP001 | `episodes/EP001/audio/lines/` (10 MB), cache `cache/tts/` (14 MB) | Cache key trong `episode.json` → `approvals.audio.lineCacheKeys` | Như trên |

## Tạo lại được bằng lệnh (khi đã có các file ở mục trên)

| Tài nguyên | Vị trí | Hash bản hiện tại | Cách tạo lại |
|---|---|---|---|
| Video EP001 đã duyệt | `episodes/EP001/exports/EP001.mp4` (18 MB); bản gốc `out/EP001.mp4` | `8e4da8097b0c65788af5711943075c487d6d204ec38ba6ed1f51de898e204547` | `npm run episode:stage-audio -- EP001` rồi `npm run render:ep001`. Đã kiểm chứng render lại cho ra file trùng từng byte trên máy này; máy hoặc phiên bản Chrome khác có thể cho hash khác |
| Thumbnail 9:16, ảnh nhá hàng 1:1 | `episodes/EP001/thumbnails/` | Xem `episodes/EP001/delivery/manifest.json` | `npm run episode:thumbnails -- EP001` |
| Bộ đăng thủ công | `episodes/EP001/delivery/` | `delivery/manifest.json` | `npm run episode:delivery -- EP001` |
| Model VieNeu v3 Turbo | `cache/hf/` (khoảng 608 MB) | Revision ghi trong `episode.json` → `versions.ttsModel` | Tự tải ở lần chạy TTS đầu tiên (README, mục VieNeu) |
| Môi trường Python | `tools/tts/vieneu/.venv`, `tools/tts/edge/.venv` | — | Cài theo README (`requirements.txt` có khoá phiên bản) |
| `node_modules/` | — | `package-lock.json` | `npm install` |
| Video và ảnh thử, sheet | `out/` | — | Các lệnh `render:*` trong README |

## Bí mật

- `.env` (ElevenLabs, sau này YouTube và Facebook) chỉ có trên máy. Mẫu tên biến nằm trong `.env.example`.
- Token OAuth sau này lưu ngoài repo (xem `docs/youtube-integration-plan.md`).

## Đã có trong Git

- Mã nguồn.
- Cấu hình không có bí mật: `config/casting.json`, `voice-refs.json` (metadata, không có audio), `publishing.json` (chỉ tên biến).
- Kịch bản, timeline, phụ đề SRT, nội dung social và `episode.json` của từng tập.
- Âm báo thử `public/test/tone.wav`, tự tạo bằng FFmpeg.
- Font Be Vietnam Pro được tải qua `@remotion/google-fonts` lúc render, không có file font trong repo.
