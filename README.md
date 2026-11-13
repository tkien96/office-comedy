# Office Comedy

Dự án sản xuất tự động video hài ngắn về công sở và đời thường bằng tiếng Việt, dựng bằng [Remotion](https://www.remotion.dev) + TypeScript.

Thông số mỗi tập: 1080x1920, 30fps, tối thiểu 60 giây (mục tiêu 60–90 giây, số khung hình tính từ timeline thực tế), MP4 H.264 + AAC. Quy tắc chi tiết nằm trong [CLAUDE.md](CLAUDE.md), tiến độ trong [PROGRESS.md](PROGRESS.md).

## Yêu cầu

- Node.js 22.18+ (khuyên dùng 24; máy hiện tại: 24.6.0). Công cụ trong `tools/` và Studio chạy thẳng TypeScript bằng type stripping của Node
- npm, Git
- FFmpeg + ffprobe trong PATH (kiểm tra kết quả render)
- Remotion tự tải Chrome Headless Shell khi render lần đầu

## Cài đặt (PowerShell, trong thư mục dự án)

```
npm install
Copy-Item .env.example .env
```

Mở `.env` và điền key nếu cần. Không commit `.env`.

## Xem trước (Remotion Studio)

```
npm run dev
```

Studio mở ở `http://localhost:3000`. Chọn composition ở cột trái.

## Render

Video kiểm tra kỹ thuật 5 giây:

```
npm run render:test
```

Kết quả: `out/tech-check.mp4`.

Kiểm tra file đã xuất:

```
npm run probe:test
```

Kết quả mong đợi: `h264` 1080x1920 30/1 với 150 khung hình, `aac`, thời lượng 5.0 giây.

## Giọng đọc: VieNeu-TTS chạy cục bộ (đang dùng)

Bản mã nguồn mở v3 Turbo chạy trên CPU (ONNX), không cần key, không gọi dịch vụ trả phí. Model được tải về `cache/hf` ở lần chạy đầu.

Cài lần đầu (PowerShell, thư mục dự án; cần Python 3.10–3.13):

```
py -3.13 -m venv tools\tts\vieneu\.venv
tools\tts\vieneu\.venv\Scripts\python.exe -m pip install -r tools\tts\vieneu\requirements.txt
```

Sử dụng:

- `npm run tts:vieneu:voices`: liệt kê giọng có sẵn theo metadata của gói (giới tính, vùng, phong cách). Mặc định lọc vùng Nam.
- `npm run tts:vieneu:samples -- --dry-run`: kiểm tra phân vai trong `config/casting.json`, không tạo âm thanh.
- `npm run tts:vieneu:samples`: tạo WAV nghe thử vào `out/tts-vieneu/vieneu-samples-01/`, kèm `summary.json` (model, thiết lập, thời lượng, kiểm tra kỹ thuật).
- `npm run tts:vieneu:dialogue`: tạo từng lượt thoại theo `tools/tts/auditions/dialogue-01.json`.
  - Cắt khoảng thừa đã xác nhận, cân âm lượng theo LUFS, ghép với khoảng lặng đặt sẵn.
  - Kết quả ở `out/tts-vieneu/vieneu-dialogue-01/`. `summary.json` có `timeline` (mốc từng lượt) để làm phụ đề.

## Giọng đọc đối chiếu: Edge TTS (miễn phí, không cần key)

Edge TTS dùng gói Python `edge-tts` (bản cố định trong `tools/tts/edge/requirements.txt`), chạy trong môi trường ảo riêng `tools/tts/edge/.venv`.

Cài lần đầu (PowerShell, thư mục dự án):

```
winget install --id Python.Python.3.13 --exact --source winget --scope user --accept-package-agreements --accept-source-agreements
py -3.13 -m venv tools\tts\edge\.venv
tools\tts\edge\.venv\Scripts\python.exe -m pip install -r tools\tts\edge\requirements.txt
```

Sử dụng:

- `npm run tts:edge:voices`: lấy danh sách giọng mới nhất, in các giọng vi-VN, lưu toàn bộ vào `cache/tts/edge-voices.json`.
- `npm run tts:edge:samples`: tạo MP3 và SRT cho mọi giọng vi-VN tìm được, ghi vào `out/tts-edge/edge-samples-01/`.

Lưu ý:

- Edge TTS chỉ chỉnh được rate, volume, pitch. Đây **không** phải điều khiển cảm xúc.
- Quyền dùng thương mại **chưa được xác minh**. Gói edge-tts là thư viện không chính thức, gọi dịch vụ đọc văn bản trực tuyến của Microsoft Edge.
- Nếu Edge TTS lỗi, script dừng lại. Script không tự chuyển sang dịch vụ trả phí.

## Giọng đọc (TTS, ElevenLabs — đang tạm hoãn)

Code nằm ở `tools/tts/`, chạy bằng Node 24 (đọc TypeScript trực tiếp). API key chỉ để trong `.env`.

1. Tạo key tại https://elevenlabs.io/app/settings/api-keys. Nên giới hạn quyền và đặt hạn mức credit cho key.
2. Tạo file môi trường cục bộ rồi mở ra sửa:

   ```
   Copy-Item .env.example .env
   notepad .env
   ```

   Dán key sau `ELEVENLABS_API_KEY=`, lưu file. Không dán key vào chat.
3. Kiểm tra tài khoản (không tốn credit): `npm run tts:check`
4. Tìm giọng nam tiếng Việt (không tốn credit): `npm run tts:voices`
5. Xem kế hoạch nghe thử mà không gọi API: `npm run tts:audition -- --dry-run`
6. Tạo bản nghe thử (tốn credit, có ngân sách chặn trước): `npm run tts:audition`
7. Xem sổ các lượt đã gọi: `npm run tts:ledger`

Ràng buộc trong code:

- **Ngân sách tính theo ký tự đã gửi.** Lỗi, timeout và retry đều bị tính. Ngân sách được kiểm tra trước mỗi request.
- **Retry có giới hạn:** tối đa 2 lần mỗi bản, chỉ retry khi lỗi 408, 409, 429, 5xx, timeout hoặc lỗi mạng.
- **Cache theo nội dung:** khoá cache gồm text, model, voice, ngôn ngữ, toàn bộ thiết lập giọng, seed và định dạng. Cache nằm ở `cache/tts/` và không đưa vào Git.
- **Ghi lại đầy đủ:** mỗi bản lưu audio, alignment theo ký tự, thời lượng thực đo bằng ffprobe, và số credit đo được từ `/v1/user/subscription`.

## Office Comedy Studio (website local)

Giao diện tiếng Việt để xem từng tập, duyệt sản phẩm, sửa nội dung social, chạy dry-run và tạo/tải bộ delivery. Chạy trên máy này, địa chỉ **http://127.0.0.1:5178**.

- Mở: nhấp đúp `Studio.cmd`, hoặc chạy `npm run studio` trong PowerShell (cần Node 22.18 trở lên và `npm install` một lần trước đó).
- Chỉ chạy máy chủ (khi đã build): `npm run studio:serve`. Đổi cổng: `$env:STUDIO_PORT=5180`.
- **Viết kịch bản bằng Claude:** menu "Tạo tập mới" → nhập ý tưởng (hoặc nhờ Claude đề xuất 3 ý tưởng) → tạo tập → Claude viết bản nháp. Tab "Kịch bản" cho sửa tay, nhờ Claude sửa (toàn bộ hoặc theo cảnh), xem khác biệt, chấp nhận, phục hồi phiên bản, duyệt.
  - Cần `ANTHROPIC_API_KEY` trong `.env` (khóa từ Claude Console, tính phí theo API, tách với gói Claude Code). Không có khóa thì giao diện báo "Chưa cấu hình Claude".
  - Model và giới hạn nằm trong `config/studio.json` (mặc định `claude-opus-5-5`).
- **Kết nối mạng xã hội:** Cấu hình → Kết nối mạng xã hội. Kết nối YouTube bằng đăng nhập Google (chỉ quyền đọc kênh), nhập Page ID + Page token Facebook, lưu username TikTok (đăng thủ công). Bí mật mã hoá bằng Windows DPAPI trong `runtime/connections/`, không cần sửa `.env`. Hướng dẫn đầy đủ: [docs/social-connections.md](docs/social-connections.md).
- Chưa có: tạo TTS/render từ giao diện, upload, đặt lịch, đăng thật. Các nút này bị khoá và có ghi lý do.

Kiến trúc, nguồn dữ liệu, an toàn và kết quả kiểm tra: [docs/studio.md](docs/studio.md).

## Quản lý tập

Mỗi tập nằm trong `episodes/EPxxx/` gồm `episode.json`, `script/`, `audio/`, `assets/`, `exports/`, `thumbnails/`, `social/`, `publishing/`, `reports/`. Chi tiết trong CLAUDE.md, mục "Cấu trúc thư mục".

| Lệnh | Tác dụng |
|---|---|
| `npm run episode:new -- "Tiêu đề"` | Cấp mã tập mới (không trùng kể cả khi chạy đồng thời), tạo khung thư mục |
| `npm run episode:status -- EP001` | Trạng thái sản xuất và duyệt, tính lại hash để phát hiện phần cần duyệt lại |
| `npm run script:lint -- EP001` | Rà soát kịch bản (xưng hô, vùng giọng, độ dài câu, số người nói mỗi cảnh) |
| `npm run episode:audio -- EP001` | Tạo hoặc dựng lại âm thanh theo timeline tự nhiên (dùng cache) |
| `npm run episode:docs -- EP001` | Xuất `script/script.md` với mốc thời gian thật |
| `npm run episode:stage-audio -- EP001` | Chép âm thanh đã duyệt sang `public/` để render (từ chối nếu hash khác) |
| `npm run render:ep001` | Render ra `episodes/EP001/exports/EP001.mp4` |
| `npm run episode:verify -- EP001` | Kiểm tra video cuối (thời lượng, khung hình, codec, âm thanh, khung đen, hình đứng im) |
| `npm run episode:captions -- EP001` | Tạo lại `exports/EP001.srt` từ timeline và kiểm tra (chữ = lời đã đọc, mốc, chồng cue, độ dài, ngắt dòng, xưng hô, đối chiếu âm thanh). Báo cáo `reports/captions-qc.md` |
| `npm run episode:social -- EP001` | Kiểm nội dung social (lộ câu chốt, hứa ngày giờ, giới hạn nền tảng), ghi `social/social.md` để duyệt |
| `npm run episode:thumbnails -- EP001` | Render thumbnail 9:16 (2160x3840) và ảnh nhá hàng 1:1 (1080x1080) từ rig của video |
| `npm run episode:delivery -- EP001` | Tạo lại bộ đăng thủ công `delivery/` (video, SRT, 2 ảnh, youtube/facebook/tiktok.md, README, manifest). `--check`: kiểm bộ còn khớp nguồn |
| `npm run episode:approve -- EP001 <phần>` | **Người dùng tự chạy** sau khi xem: ghi duyệt gắn hash. Phần: `captions`, `thumbnail9x16`, `teaser1x1`, `social.youtube.video`, `social.facebook.teaser`, …; `--revoke` để thu hồi |

Trạng thái duyệt:
- **cần duyệt lại**: file hoặc chữ đã đổi sau khi duyệt.
- **cần kiểm tra lại**: file còn nguyên, nhưng nguồn (kịch bản, timeline, âm thanh…) đã đổi.

Cả hai trạng thái đều chặn đăng. Thư mục `delivery/` là bản xuất, không đưa vào Git, và không bao giờ tự nâng trạng thái duyệt.

## Đăng bài (mới có dry-run)

| Lệnh | Tác dụng |
|---|---|
| `npm run publish:dry-run -- EP001` | Kiểm tra file, hash, duyệt, tài khoản đích, token (chỉ báo có hay không), lịch, giới hạn nền tảng, lộ câu chốt, job trùng. **Không upload.** Báo cáo ở `reports/publish-dry-run.json` |
| `npm run publish:plan -- EP001 <jobId> "YYYY-MM-DD HH:mm"` | Đặt lịch **trong dự án** theo giờ Việt Nam (lưu kèm UTC). Không gửi gì lên nền tảng |

Khả năng từng nền tảng, ảnh bìa và thông tin tài khoản còn thiếu: [docs/publishing-platforms.md](docs/publishing-platforms.md). Kế hoạch tích hợp YouTube (chưa triển khai): [docs/youtube-integration-plan.md](docs/youtube-integration-plan.md). Tài khoản và token quản lý trong Studio (kho DPAPI); `.env` vẫn dùng được như trước (xem quy tắc nguồn trong [docs/social-connections.md](docs/social-connections.md)); `.env.example` chỉ có tên biến.

## Lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Mở Remotion Studio |
| `npm run lint` | ESLint + kiểm tra kiểu TypeScript |
| `npm run render:test` | Render `TechCheck` ra `out/tech-check.mp4` |
| `npm run probe:test` | In thông số codec/khung hình/thời lượng của file test |
| `npm run render:demo` | Render cảnh mẫu 10 giây ra `out/demo-notification.mp4` |
| `npm run render:sheets` | Xuất ảnh tổng hợp nhân vật và bối cảnh vào `out/` |

Xem vùng an toàn và dải phụ đề trong Studio: chọn `DemoNotification` rồi bật `debugSafeArea` trong bảng props.

## Cấu trúc

```
src/Root.tsx           đăng ký composition
src/characters/        rig nhân vật SVG + thiết kế Kiên, Trinh, Sếp
src/backgrounds/       văn phòng, phòng họp, pantry
src/episodes/          dữ liệu kịch bản (tách khỏi code dựng)
src/scenes/            bộ dựng cảnh dùng chung
src/ui/                phụ đề, thông báo, overlay
src/test/TechCheck.tsx composition kiểm tra kỹ thuật (5 giây)
assets/LICENSES.md     nguồn và giấy phép tài nguyên
public/test/           tài nguyên kiểm tra (âm thanh tự tạo bằng FFmpeg)
.claude/skills/        Remotion Agent Skills cho Claude Code (phạm vi dự án)
out/                   video xuất ra (bị Git bỏ qua)
```

## Tài nguyên chỉ có trên máy

Video, giọng clone, giọng tham chiếu, ảnh bìa, model TTS và cache không đưa vào Git (repo công khai). Danh sách, hash và cách khôi phục: [docs/local-assets.md](docs/local-assets.md).

## Giấy phép

Remotion miễn phí cho cá nhân và nhóm tối đa 3 người; tổ chức lớn hơn cần giấy phép công ty. Xem https://www.remotion.dev/license.
