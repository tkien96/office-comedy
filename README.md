# Office Comedy

Dự án sản xuất tự động video hài ngắn về công sở và đời thường bằng tiếng Việt, dựng bằng [Remotion](https://www.remotion.dev) + TypeScript.

Thông số mỗi tập: 1080x1920, 30fps, tối thiểu 60 giây (mục tiêu 60–90 giây, số khung hình tính từ timeline thực tế), MP4 H.264 + AAC. Quy tắc chi tiết nằm trong [CLAUDE.md](CLAUDE.md), tiến độ trong [PROGRESS.md](PROGRESS.md).

## Yêu cầu

- Node.js 20.19+ / 22.13+ / 24+ (máy hiện tại: 24.6.0)
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

## Giấy phép

Remotion miễn phí cho cá nhân và nhóm tối đa 3 người; tổ chức lớn hơn cần giấy phép công ty. Xem https://www.remotion.dev/license.
