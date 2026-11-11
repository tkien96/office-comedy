# CLAUDE.md — Office Comedy (Remotion + TypeScript)

Dự án sản xuất tự động video hài ngắn về công sở và đời thường, nói tiếng Việt.

## MỤC TIÊU

- Sản xuất video hài công sở và đời thường bằng tiếng Việt.
- Mỗi video dài đúng **60 giây**.
- Khung hình **1080x1920** (dọc), **30fps**, **1800 khung hình**.
- Xuất **MP4 H.264**, âm thanh **AAC**.
- Phong cách hoạt hình 2D, có biểu cảm và hành động.
- Một giọng kể chính, **tối đa hai nhân vật có thoại** mỗi tập.
- Phụ đề tiếng Việt đồng bộ lời nói.
- **Không tự đăng video lên mạng xã hội.**

## NGUYÊN TẮC

- Dùng lại bộ dựng (component, layout, hiệu ứng) và tài nguyên giữa các tập.
- Tách dữ liệu kịch bản (JSON/TS data) khỏi code dựng video.
- Không tạo ảnh mới cho cùng một nhân vật ở mỗi cảnh. Mỗi nhân vật có một bộ tài nguyên cố định (thân, đầu, biểu cảm, tư thế), dùng lại ở mọi cảnh và mọi tập.
- Không dùng ảnh tĩnh phóng to/thu nhỏ làm toàn bộ video. Nhân vật phải có chuyển động, biểu cảm và hành động thật.
- Không kéo dài cảnh trống hoặc cắt cụt lời để đủ 60 giây. Nếu thời lượng lệch, sửa kịch bản hoặc nhịp cảnh.
- Không dùng tài nguyên không rõ quyền sử dụng. Ghi nguồn và giấy phép của mọi tài nguyên bên ngoài vào `assets/LICENSES.md`.
- Không ghi API key vào code, log hoặc Git. Key chỉ đặt trong `.env` (đã bị `.gitignore` loại trừ); `.env.example` chỉ chứa tên biến.
- Không báo hoàn thành khi chưa xuất MP4 và kiểm tra bằng `ffprobe` (thời lượng, độ phân giải, fps, số khung hình, codec h264/aac).
- Lưu tiến độ vào `PROGRESS.md` sau mỗi bước quan trọng để tiếp tục được khi gián đoạn.

## Thông số kỹ thuật bắt buộc cho mỗi tập

| Thuộc tính | Giá trị |
|---|---|
| Độ phân giải | 1080 x 1920 |
| fps | 30 |
| durationInFrames | 1800 |
| Thời lượng | 60.000 giây |
| Video codec | h264, yuv420p, màu bt709 (đã đặt trong `remotion.config.ts`) |
| Audio codec | aac |

Lệnh kiểm tra sau khi render (PowerShell):

```
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,pix_fmt -show_entries format=duration -of compact out/<file>.mp4
```

## Môi trường

- Windows 11, PowerShell 5.1. Node 24 (nvm-windows), npm 11, Git, FFmpeg/ffprobe 9 (winget, Gyan).
- Máy yếu (i5-7500 4 luồng, GPU tích hợp, RAM 16 GB): render với `--concurrency=2` hoặc `3`.
- Ổ C: còn ít dung lượng; giữ dự án và output trên D:.
- Khi PowerShell 5.1 ghi file, dùng UTF-8 **không BOM** (BOM làm hỏng `package.json`). Ưu tiên công cụ Write/Edit.

## Remotion

- Remotion 4.0.542. Skills Remotion đã cài trong phạm vi dự án ở `.claude/skills/` (khoá phiên bản ở `skills-lock.json`). Đọc `remotion-best-practices` trước khi viết markup.
- Hoạt ảnh dùng `useCurrentFrame()` + `interpolate()`/`spring()`. Không dùng CSS transition/animation.
- Lấy `fps` từ `useVideoConfig()` cho mọi phép đổi giây sang khung hình.
- Render bằng trình duyệt đi kèm của Remotion (Chrome Headless Shell), không đặt `--browser-executable`.
- Tài nguyên tĩnh đặt trong `public/`, tham chiếu bằng `staticFile()`.

## Cấu trúc thư mục

```
src/
  Root.tsx              đăng ký các Composition / Still
  design/               tokens (khung hình, vùng an toàn, dải phụ đề), font
  lib/timeline.ts       keyframe, nội suy, hash tất định
  characters/           rig SVG dùng chung + thiết kế Kiên/Trinh/Sếp
  backgrounds/          văn phòng, phòng họp, pantry, bàn phía trước
  ui/                   phụ đề, thẻ thông báo, chữ sốc, overlay vùng an toàn
  scenes/ScriptedScene  bộ dựng chung: đọc dữ liệu cảnh rồi vẽ
  episodes/             CHỈ dữ liệu kịch bản (types.ts + mỗi tập một file)
  sheets/               ảnh tổng hợp nhân vật và bối cảnh
  test/                 composition kiểm tra kỹ thuật
public/audio/           giọng đọc, nhạc, SFX (sau này)
assets/LICENSES.md      nguồn và giấy phép mọi tài nguyên
out/                    video và ảnh xuất ra (không đưa vào Git)
```

## Nhân vật

Nguồn dữ liệu chính: `src/characters/designs.ts` (thiết kế + `CHARACTER_BIOS`). ID nội bộ dùng trong dữ liệu tập (`character`, `speaker`).

| Tên hiển thị | ID nội bộ | Hồ sơ |
|---|---|---|
| Kiên | `kien` | Nhân viên nam ~30 tuổi, áo xanh. Cả nể, muốn làm việc hiệu quả nhưng hay tự đưa mình vào thế khó. |
| Trinh | `trinh` | Đồng nghiệp nữ ~28 tuổi, áo cam. Nhanh trí, thực tế, lúc giúp Kiên lúc vì lợi ích riêng. |
| Sếp | `sep` | 45–50 tuổi, sơ mi sáng. Mê số liệu và quy trình, không mặc định là người xấu. |

- Kiên và Trinh trước đây tên Nam và Linh (đổi ngày 2026-11-11). Không dùng lại tên cũ.
- Mã giọng `vi-VN-NamMinhNeural` của Microsoft là tên giọng TTS, không liên quan tên nhân vật.

### Định hướng giọng và phân vai (`config/casting.json`)

Đây là mục tiêu tuyển chọn giọng, không phải tham số model hỗ trợ.

| Vai | Định hướng | Giọng **đã duyệt 2026-11-11** (`config/casting.json` → `approved`) |
|---|---|---|
| Người kể | Nam trưởng thành, miền Nam, trầm vừa, rõ lời, kể tỉnh bơ có duyên, không đọc như quảng cáo | **Chưa chọn** |
| Kiên | Nam ~30, miền Nam, thân thiện, hơi cả nể; ngỡ ngàng tự nhiên | `ref:806c4f55…` (tham chiếu `voice_kien_02.mp4`, đoạn 7,50–11,86 s) |
| Trinh | Nữ ~28, miền Nam, lanh lẹ, dí dỏm; không the thé, không cố dễ thương | `ref:b07ad222…` (tham chiếu `voice_trinh.mp4`, đoạn 16,26–23,98 s) |
| Sếp | Nam miền Nam, **trên 50 tuổi**, trầm vừa, có độ dày, chắc lời, điềm tĩnh, dứt khoát; không gằn, không giả già yếu, không hạ pitch hay kéo chậm để giả tuổi | `ref:f19ba795…` (tham chiếu `voice_sep.mp4`, đoạn 38,70–43,76 s). Nguồn ghi nhãn "nam miền Bắc"; người dùng đã nghe và vẫn duyệt |

- **Giọng cố định:**
  - Tạo âm thanh cho các vai trên luôn dùng đúng voice ID, file tham chiếu, model `vieneu@3.8.4/v3turbo-onnx-fp32` (kèm revision) và thiết lập ghi trong `approved`.
  - Không đổi giọng giữa các cảnh.
  - Không đổi model hay thiết lập khi chưa hỏi người dùng.
- **Clone** chỉ chạy khi `rights.confirmed = true` trong `config/voice-refs.json`.

Quy tắc phân vai:

- **Ứng viên lấy theo metadata chính thức** của gói (`region = "Nam"`, đúng `gender`). Metadata không có tuổi, nên độ tuổi phải xác định bằng cách nghe.
- **Không đoán vùng giọng từ tên.** Không gán giọng vùng khác rồi ghi là miền Nam.
- **Khi người dùng duyệt:** ghi `approved` trong `config/casting.json` và bảng trên. Mỗi vai một voice ID cố định cho mọi cảnh; không đổi voice ID để thể hiện cảm xúc.
- **Hai vai không dùng chung một voice ID**, trừ người kể khi người dùng đồng ý dùng chung giọng Kiên.

### Giọng tham chiếu (voice cloning, `config/voice-refs.json`)

- **Chỉ clone khi người dùng đã xác nhận quyền.** `rights.confirmed` phải là `true`, và chỉ người dùng mới được đặt giá trị này. Code (`tools/tts/cli/vieneu-dialogue.ts`) từ chối clone nếu chưa xác nhận.
- **Chỉ dùng nguồn sạch** (`usable: true`): một người nói, không nhạc nền hay tiếng ù, không clip.
  - Nếu nguồn bẩn thì báo người dùng và xin bản thu khác.
  - Không khử nhiễu mạnh để cứu nguồn, vì làm đổi âm sắc. Dự án dùng `ref_denoise: false`.
- **Đoạn tham chiếu:**
  - Dài 3–8 s; VieNeu v3 Turbo tự cắt ở 8,0 s.
  - Cắt ở chỗ nghỉ tự nhiên, không cắt ngang từ.
  - Giữ nguyên file gốc, chỉ trích sang `cache/voice-refs/` (không đưa vào Git).
- **Không cần transcript** với v3 Turbo; nếu sau này model yêu cầu thì chép đúng lời, không bịa.
- **Định danh giọng clone:** voice ID dạng `ref:<sha256 của file tham chiếu>`. Cache gắn theo nội dung audio, không theo tên file.
- **Không hứa giống 100%** giọng hay cách diễn của bản gốc.
- **Không suy ra tuổi giọng** từ tên preset hay chỉ từ cao độ. Số đo trong `tools/tts/vieneu/voice_metrics.py` chỉ để sàng lọc trước khi nghe.

## Ngôn ngữ kịch bản (tiếng Việt miền Nam, thiên Sài Gòn)

- Câu ngắn, đời thường, nói lên nghe tự nhiên. Phù hợp môi trường công sở.
- Dùng "tụi mình", "thiệt", "nè", "nha", "trời ơi" khi hợp ngữ cảnh. Không lạm dụng từ địa phương.
- Viết đúng chính tả chuẩn; không viết sai để ép giọng (giọng do TTS và diễn đọc).
- Nhân viên nói với sếp xưng "em", gọi "anh/chị". Sếp gọi nhân viên "em", xưng "anh".
- Đồng nghiệp xưng hô theo mức thân thiết và giữ nhất quán trong từng cặp. Hiện tại Trinh gọi Kiên là "ông", tức thân, hơi trêu.
- Hài đến từ tình huống, phản ứng và nhịp thoại, không đến từ chọc ghẹo vùng miền.
- Không tự thêm tiếng cười hay nhạc nền vào giọng đọc. Thẻ cảm xúc VieNeu (`[cười]`, `[thở dài]`, `[hắng giọng]`) đang ở mức thử nghiệm, chỉ dùng ở bước tinh chỉnh.

## Quy tắc bộ hình ảnh

- Nhân vật chỉ được điều khiển qua `CharacterState` (pose, expression, lookX/lookY, talking, lean, seated, laptop), đặt bằng keyframe trong dữ liệu tập. Không vẽ nhân vật mới cho từng cảnh.
- Muốn thêm biểu cảm hoặc tư thế thì thêm vào rig (`FACE_SPECS` trong `Face.tsx`, `armsFor` trong `Character.tsx`) để mọi nhân vật cùng dùng được.
- Mọi chuyển động phải là hàm của frame. Cấm `Math.random`, `Date`, `performance.now`. Cần biến thiên thì dùng `hash01(seed)`.
- Phụ đề nằm trong `SUBTITLE_ZONE` và tối đa 2 dòng (render báo lỗi nếu vượt). Cằm nhân vật phải ở trên dải phụ đề (`assertClearOfSubtitles`). Thẻ thông báo và chữ sốc đặt ở nửa trên khung hình.
- Rig 400x800 đơn vị, chân ở y=780. Khi ngồi có laptop, mặt bàn ở `y + 690 * scale`.

## TTS (tools/tts)

- Mọi nhà cung cấp đều theo interface `TtsProvider` (`tools/tts/types.ts`), tách khỏi bộ dựng video.
- **Đang dùng: VieNeu-TTS chạy cục bộ** (`tools/tts/vieneu.ts`, helper `tools/tts/vieneu/vieneu_synth.py`).
  - Gói `vieneu==3.8.4`, môi trường riêng `tools/tts/vieneu/.venv`.
  - Model v3 Turbo, ONNX, CPU, fp32 (CPU không có VNNI nên không dùng int8). Model tải về `cache/hf`.
  - Không dùng VieNeu v4 hay vieneu.io (dịch vụ trả phí, mã nguồn đóng).
  - Không dùng 0.3B GGUF (giấy phép CC BY-NC, cấm thương mại).
  - Không có `seed`, nên mỗi lần tạo có thể khác nhau; cache giữ bản đã tạo.
  - Không có timestamp.
  - `style` không có tác dụng trên Turbo; không có tham số speed hay pitch.
- **Đối chiếu:** Edge TTS (`tools/tts/edge.ts`), giữ lại, chưa xoá.
- **Tạm hoãn:** ElevenLabs (`tools/tts/elevenlabs.ts`), trả phí.
- Cache key gồm model, phiên bản gói, revision model, giọng, nội dung và toàn bộ thiết lập.
- **Căn phụ đề** (VieNeu không có timestamp):
  - Tạo mỗi câu hoặc mỗi cue phụ đề thành một file riêng, rồi đo thời lượng thật bằng ffprobe. Mốc cue là tổng các thời lượng đó, nên chính xác ở mức câu.
  - Muốn mốc theo từng từ thì phải căn bằng ASR hoặc forced aligner.
  - Không chia đều thời gian cho từng từ rồi gọi là đồng bộ chính xác.
- **Kiểm tra kỹ thuật** (`tools/tts/qc.ts`, ffmpeg) chỉ là tín hiệu:
  - Khoảng lặng bất thường.
  - Cắt cuối câu.
  - Clip.
  - Tốc độ âm tiết bất thường.
  - Không thay được việc nghe. Không kết luận "đạt giọng miền Nam" hay "diễn cảm tốt" chỉ vì file tạo thành công.
- ElevenLabs: key lấy từ `ELEVENLABS_API_KEY` trong `.env`. Không bao giờ in key, ghi key vào log hay yêu cầu người dùng dán key vào chat.
- Mọi lần gọi trả phí đều phải đi qua `synthesize()`:
  - Cache trước.
  - Kiểm tra ngân sách trước mỗi lần thử.
  - Tối đa `maxAttempts` lần thử.
  - Ghi sổ `cache/tts/ledger.jsonl`.
  - Lỗi và timeout vẫn tính vào ngân sách.
- Chỉ tạo âm thanh trong ngân sách đã thống nhất với người dùng. Chưa tạo âm thanh cho cả tập khi người dùng chưa chốt giọng.
- Không giả định quy đổi ký tự ra giây hay ra USD. Thời lượng phải đo bằng ffprobe; credit đo bằng `/v1/user/subscription`.
- Giọng nhóm Default của ElevenLabs ngừng ngày 31/12/2026, không dùng.

## Quy trình làm việc

1. Đọc `PROGRESS.md` khi bắt đầu phiên để biết đang ở bước nào.
2. Làm một bước, kiểm tra kết quả, cập nhật `PROGRESS.md`.
3. Không commit hoặc push nếu người dùng chưa yêu cầu.
