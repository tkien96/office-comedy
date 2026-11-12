# CLAUDE.md — Office Comedy (Remotion + TypeScript)

Dự án sản xuất tự động video hài ngắn về công sở và đời thường, nói tiếng Việt.

## MỤC TIÊU

- Sản xuất video hài công sở và đời thường bằng tiếng Việt.
- Thời lượng **tối thiểu 60 giây**, khoảng mục tiêu thông thường **60–90 giây**. Được vượt 90 giây nếu diễn biến thực sự cần; không cắt ép để nằm trong khoảng mục tiêu. (Quy tắc cũ "đúng 60 giây / 1800 khung hình" đã bỏ ngày 2026-11-11.)
- Khung hình **1080x1920** (dọc), **30fps**. Số khung hình tính từ timeline thực tế.
- Xuất **MP4 H.264**, âm thanh **AAC**.
- Phong cách hoạt hình 2D, có biểu cảm và hành động (bộ rig SVG phẳng trong `src/characters/`). Chưa có quyết định đổi phong cách hình ảnh nào khác.
- Một giọng kể chính: lời dẫn của Kiên, ngôi thứ nhất "tôi".
- **Tối đa hai nhân vật có thoại trong mỗi cảnh** (người dùng chốt 2026-11-11, thay cho quy tắc cũ "mỗi tập"). Lời dẫn là của Kiên nên không tính là nhân vật thứ ba.
- Phụ đề tiếng Việt đồng bộ lời nói.
- **Không tự đăng video lên mạng xã hội.**

## NGUYÊN TẮC

- Dùng lại bộ dựng (component, layout, hiệu ứng) và tài nguyên giữa các tập.
- Tách dữ liệu kịch bản (JSON/TS data) khỏi code dựng video.
- Không tạo ảnh mới cho cùng một nhân vật ở mỗi cảnh. Mỗi nhân vật có một bộ tài nguyên cố định (thân, đầu, biểu cảm, tư thế), dùng lại ở mọi cảnh và mọi tập.
- Không dùng ảnh tĩnh phóng to/thu nhỏ làm toàn bộ video. Nhân vật phải có chuyển động, biểu cảm và hành động thật.
- **Thời lượng đi theo nội dung, không ép theo mốc:**
  - Không tăng tốc, time-stretch, đổi pitch hay bóp giọng để đạt một thời lượng.
  - Không cắt mất từ, âm cuối, hơi thở hoặc khoảng ngừng cần thiết. Chỉ xử lý khoảng lặng thừa và lỗi âm thanh rõ ràng (ví dụ clip).
  - Không rút lời thoại chỉ vì tổng vượt 60 s; vẫn biên tập câu dài dòng hoặc trùng ý.
  - Nếu dưới 60 s: bổ sung diễn biến hoặc tương tác có giá trị, đúng logic câu chuyện, và chỉ tạo lại đoạn bị ảnh hưởng. Không thêm màn hình trống, đứng im, lặp thoại, intro/outro dài hay làm chậm âm thanh. Nếu ý tưởng không đủ chất liệu, phát triển lại kịch bản.
- **Thứ tự lập timeline:**
  1. Hoàn thiện kịch bản đủ diễn biến.
  2. Tạo lời kể và thoại ở nhịp tự nhiên.
  3. Đo thời lượng thật từng đoạn.
  4. Bố trí hành động, phản ứng, khoảng nghỉ, chuyển cảnh (mỗi nhịp có độ dài theo nội dung, không chia đều).
  5. Tổng thời lượng = điểm kết thúc cuối cùng của hình và âm thanh trên timeline.
  - Hành động diễn ra trong lúc có thoại thì ghi ở câu thoại đó, không cộng thêm thời gian.
- Không dùng tài nguyên không rõ quyền sử dụng. Ghi nguồn và giấy phép của mọi tài nguyên bên ngoài vào `assets/LICENSES.md`.
- Không ghi API key vào code, log hoặc Git. Key chỉ đặt trong `.env` (đã bị `.gitignore` loại trừ); `.env.example` chỉ chứa tên biến.
- Không báo hoàn thành khi chưa xuất MP4 và kiểm tra bằng `ffprobe` (thời lượng, độ phân giải, fps, số khung hình, codec h264/aac).
- Lưu tiến độ vào `PROGRESS.md` sau mỗi bước quan trọng để tiếp tục được khi gián đoạn.

## Thông số kỹ thuật bắt buộc cho mỗi tập

| Thuộc tính | Giá trị |
|---|---|
| Độ phân giải | 1080 x 1920 |
| fps | 30 |
| Thời lượng | tối thiểu 60 s; mục tiêu 60–90 s; = điểm kết thúc cuối cùng trên timeline (`contentEndSec` trong `timeline.json`) |
| durationInFrames | `ceil(contentEndSec × fps)`, lấy từ `timeline.json` của tập; không ghi cứng |
| Video codec | h264, yuv420p, màu bt709 (đã đặt trong `remotion.config.ts`) |
| Audio codec | aac |

Lệnh kiểm tra sau khi render (PowerShell):

```
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,pix_fmt -show_entries format=duration -of compact out/<file>.mp4
```

Kiểm tra video cuối:

- Thời lượng ≥ 60 s.
- `nb_frames` = `durationInFrames` của timeline.
- Không cắt cụt nội dung: âm thanh và phụ đề cuối nằm trong video.
- Không có đoạn trống ngoài chủ ý.
- Phụ đề lấy từ timeline mới.

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
  scenes/ScriptedScene  bộ dựng cảnh thử (demo 10 s)
  episode/EpisodeVideo  bộ dựng TẬP: đọc kịch bản đã duyệt + timeline.json + dàn cảnh
  episodes/             CHỈ dữ liệu: dàn cảnh từng tập (<id>-staging.ts: vị trí, camera, thẻ, cue biểu cảm cho nhịp hành động), bố cục ảnh bìa (<id>-thumbnails.ts)
  thumbnails/           bộ dựng ảnh bìa 9:16 / nhá hàng 1:1 (cùng rig, nền, font với video)
  sheets/               ảnh tổng hợp nhân vật và bối cảnh
  test/                 composition kiểm tra kỹ thuật
public/audio/           giọng đọc, nhạc, SFX (sau này)
assets/LICENSES.md      nguồn và giấy phép mọi tài nguyên
episodes/EPxxx/         mỗi tập (đường dẫn định nghĩa duy nhất trong tools/episode/paths.ts):
  episode.json          metadata, phiên bản, trạng thái sản xuất, DUYỆT gắn hash
  script/               script.json (nguồn), script.md, timeline.json
  audio/                dialogue-preview.wav, lines/            (không đưa vào Git)
  assets/               tài nguyên riêng của tập (tài nguyên chung để ngoài)
  exports/              EPxxx.mp4 (không đưa vào Git), EPxxx.srt (tạo bằng episode:captions)
  thumbnails/           thumb-9x16.png, teaser-1x1.png          (ảnh không đưa vào Git)
  social/               social.json (nguồn, từng bài từng nền tảng), social.md (bản đọc, tạo bằng episode:social)
  publishing/           jobs.json; log.jsonl, .lock, upload-state.json (không đưa vào Git)
  reports/              qa-report.md, captions-qc.md, publish-dry-run.json
  delivery/             BẢN XUẤT để đăng tay, tạo lại toàn bộ bằng episode:delivery (không đưa vào Git)
config/publishing.json  tài khoản đích (chỉ TÊN biến môi trường), khả năng nền tảng
docs/publishing-platforms.md  bảng khả năng đăng bài và ảnh bìa theo tài liệu chính thức
docs/youtube-integration-plan.md  kế hoạch tích hợp YouTube (chưa triển khai)
docs/local-assets.md  tài nguyên chỉ có trên máy (không đưa vào Git), hash và cách khôi phục
docs/studio.md        website local Office Comedy Studio: kiến trúc, nguồn dữ liệu, an toàn
studio/               Office Comedy Studio: server/ (Node, node:http), web/ (React), build.mjs → dist/ (không đưa vào Git)
Studio.cmd            launcher Windows cho Studio
runtime/              dữ liệu vận hành của Studio (công việc nền), không đưa vào Git
out/                    video và ảnh xuất ra (không đưa vào Git)
```

## Nhân vật

Nguồn dữ liệu chính: `src/characters/designs.ts` (thiết kế + `CHARACTER_BIOS`). ID nội bộ dùng trong dữ liệu tập (`character`, `speaker`).

| Tên hiển thị | ID nội bộ | Hồ sơ |
|---|---|---|
| Kiên | `kien` | Nhân viên nam ~30 tuổi, áo xanh. Cả nể, muốn làm việc hiệu quả nhưng hay tự đưa mình vào thế khó. |
| Trinh | `trinh` | Đồng nghiệp nữ ~28 tuổi, áo cam. Nhanh trí, thực tế, lúc giúp Kiên lúc vì lợi ích riêng. |
| Sếp | `sep` | Đàn ông trên 50 tuổi, sơ mi sáng, nói giọng miền Bắc. Điềm tĩnh, chắc lời, mê số liệu và quy trình, không mặc định là người xấu. |

- Kiên và Trinh trước đây tên Nam và Linh (đổi ngày 2026-11-11). Không dùng lại tên cũ.
- Mã giọng `vi-VN-NamMinhNeural` của Microsoft là tên giọng TTS, không liên quan tên nhân vật.

### Định hướng giọng và phân vai (`config/casting.json`)

Đây là mục tiêu tuyển chọn giọng, không phải tham số model hỗ trợ.

| Vai | Định hướng | Giọng **đã duyệt 2026-11-11** (`config/casting.json` → `approved`) |
|---|---|---|
| Người kể | **Lời dẫn của Kiên**, ngôi thứ nhất "tôi", miền Nam, kể tỉnh bơ có duyên. Chỉ dùng khi cần, không kể lại điều hình hay thoại đã thể hiện, không đọc chồng lên hội thoại | **Dùng chính giọng Kiên** (`ref:806c4f55…`, cùng tham chiếu, model, thiết lập), chốt 2026-11-11 |
| Kiên | Nam ~30, miền Nam, thân thiện, hơi cả nể; ngỡ ngàng tự nhiên | `ref:806c4f55…` (tham chiếu `voice_kien_02.mp4`, đoạn 7,50–11,86 s) |
| Trinh | Nữ ~28, miền Nam, lanh lẹ, dí dỏm; không the thé, không cố dễ thương | `ref:b07ad222…` (tham chiếu `voice_trinh.mp4`, đoạn 16,26–23,98 s) |
| Sếp | Nam **miền Bắc** (quyết định chính thức), **trên 50 tuổi**, điềm tĩnh, chắc lời. Tuổi thể hiện qua nội dung và nhịp thoại; không chỉnh pitch, không thay giọng đã duyệt | `ref:f19ba795…` (tham chiếu `voice_sep.mp4`, đoạn 38,70–43,76 s, giọng nam miền Bắc) |

- **Giọng cố định:**
  - Tạo âm thanh cho các vai trên luôn dùng đúng voice ID, file tham chiếu, model `vieneu@3.8.4/v3turbo-onnx-fp32` (kèm revision) và thiết lập ghi trong `approved`.
  - Không đổi giọng giữa các cảnh.
  - Không đổi model hay thiết lập khi chưa hỏi người dùng.
- **Clone** chỉ chạy khi `rights.confirmed = true` trong `config/voice-refs.json`.

Quy tắc phân vai:

- **Vùng giọng theo vai:** Kiên, Trinh và người kể nói **miền Nam**; Sếp nói **miền Bắc**.
- **Ứng viên preset lấy theo metadata chính thức** của gói (`region` đúng vùng của vai, đúng `gender`). Metadata không có tuổi, nên độ tuổi phải xác định bằng cách nghe.
- **Không đoán vùng giọng từ tên.** Không gán giọng sai vùng rồi ghi là đúng vùng của vai.
- **Khi người dùng duyệt:** ghi `approved` trong `config/casting.json` và bảng trên. Mỗi vai một voice ID cố định cho mọi cảnh; không đổi voice ID để thể hiện cảm xúc.
- **Hai vai không dùng chung một voice ID**, trừ người kể dùng giọng Kiên (đã chốt, vì người kể là chính Kiên).

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

## Ngôn ngữ kịch bản

Quyết định chính thức ngày 2026-11-11.

### Vùng ngôn ngữ theo nhân vật

- **Kiên, Trinh, người kể:** tiếng Việt miền Nam, thiên Sài Gòn.
  - Dùng "tụi mình", "thiệt", "nè", "nha", "trời ơi" khi hợp ngữ cảnh. Không lạm dụng từ địa phương.
- **Sếp:** cách nói miền Bắc tự nhiên (ví dụ "nhé", "thế", "giúp", "đấy"). Không ép Sếp dùng từ địa phương miền Nam.
- **Chung cho mọi vai:**
  - Câu ngắn, đời thường, nói lên nghe tự nhiên, phù hợp môi trường công sở.
  - Viết đúng chính tả chuẩn; không viết sai để ép giọng (giọng do TTS và diễn đọc).
- **Tuổi của Sếp** (trên 50, điềm tĩnh, chắc lời) thể hiện qua nội dung và nhịp thoại, không qua chỉnh pitch.

### Xưng hô

| Quan hệ | Quy tắc |
|---|---|
| Kiên/Trinh → Sếp | Gọi "**sếp**", xưng "**em**". **Không** gọi Sếp là "anh" trong lời thoại thông thường. Dùng "sếp" đúng ngữ cảnh, không lặp ở mọi câu. |
| Sếp → Kiên/Trinh | Xưng "**anh**", gọi "**em**", "**các em**" hoặc tên. |
| Kiên ↔ Trinh | **anh–em**: Trinh gọi Kiên là "anh", xưng "em"; Kiên gọi Trinh là "em", xưng "anh". |

Ví dụ:

- Kiên: "Dạ sếp, em làm xong báo cáo rồi."
- Sếp: "Tốt. Em gửi cho anh trước giờ họp nhé."
- Trinh: "Sếp ơi, vậy chiều nay tụi em có cần họp nữa không?"

Khi sửa xưng hô, sửa theo từng câu và từng quan hệ. **Không tìm–thay toàn bộ từ "anh"**, vì từ này còn dùng trong quan hệ Kiên–Trinh và trong lời Sếp tự xưng.

### Giọng hài

- Hài đến từ tình huống, phản ứng và nhịp thoại.
- **Không dùng khác biệt vùng giọng Bắc–Nam làm trò gây cười.**
- Không tự thêm tiếng cười hay nhạc nền vào giọng đọc. Thẻ cảm xúc VieNeu (`[cười]`, `[thở dài]`, `[hắng giọng]`) đang ở mức thử nghiệm, chỉ dùng ở bước tinh chỉnh.

## Dựng video tập

- Composition tập (ví dụ `EP001` trong `src/Root.tsx`) nhập trực tiếp `episodes/EPxxx/script/script.json` và `script/timeline.json`.
  - `durationInFrames` lấy từ timeline, không ghi cứng.
  - Âm thanh là bản đã duyệt, chép sang `public/audio/episodes/EPxxx/dialogue.wav` bằng `npm run episode:stage-audio -- EPxxx` (lệnh từ chối nếu hash khác bản duyệt; thư mục không đưa vào Git).
  - Render ra `episodes/EPxxx/exports/EPxxx.mp4` (ví dụ `npm run render:ep001`).
- Biểu cảm và tư thế lấy từ gợi ý `expression`/`pose` của câu thoại. Nhịp hành động chỉ có mô tả chữ, nên biểu cảm của chúng ghi ở `cues` trong file dàn cảnh, bám đúng mô tả.
- Người nói có `talking` trong khoảng lời của họ; người nghe tự nhìn về phía người nói. Lời dẫn (narrator) là giọng đọc ngoài hình: Kiên không mấp máy môi.
- Phụ đề in trong video lấy từ timeline (khoảng lời của từng câu).
  - Cỡ chữ 58 px, tự thu tối đa xuống 48 px để giữ ≤ 2 dòng; vẫn quá thì render báo lỗi.
  - Có nhãn tên người nói; lời dẫn không có nhãn.
- Sau khi render: `npm run episode:verify -- EPxxx` (mặc định kiểm `exports/EPxxx.mp4`). Kiểm tra:
  - thời lượng ≥ 60 s và số khung hình = timeline;
  - codec;
  - âm thanh khớp bản duyệt;
  - không cắt cụt, không khung đen, không hình đứng im ≥ 2 s.

## Quản lý tập

- **Mã tập:** chỉ cấp bằng `npm run episode:new -- "Tiêu đề"`.
  - Lệnh dùng `mkdir` không đệ quy làm khóa nguyên tử, nên chạy lại hay chạy đồng thời cũng không trùng mã.
  - Không tự đặt tên thư mục tập bằng tay.
- **Duyệt gắn hash** (`episode.json` → `approvals`):
  - Mỗi phần có hash riêng: kịch bản (hash nội dung), âm thanh, video, phụ đề (SRT, đổi CRLF→LF trước khi hash), thumbnail 9:16, ảnh nhá hàng 1:1.
  - Social duyệt **theo từng bài**: `approvals.social["youtube.video"]`, `["facebook.teaser"]`, …; mỗi bài một hash. Sửa một bài không làm mất duyệt bài khác.
  - Mỗi duyệt ghi kèm `basis`: hash các NGUỒN của sản phẩm (`DEPENDS_ON` trong `tools/episode/manifest.ts`). Ví dụ video phụ thuộc kịch bản, timeline, âm thanh, dàn cảnh, rig dùng chung; phụ đề phụ thuộc kịch bản và timeline; social phụ thuộc kịch bản.
  - Hash sản phẩm đổi → "cần duyệt lại". Hash sản phẩm còn nguyên nhưng nguồn đổi → "cần kiểm tra lại". Cả hai đều chặn đăng.
  - **Không đăng bằng duyệt cũ.**
  - Chỉ người dùng mới duyệt, bằng `npm run episode:approve -- EPxxx <phần>` (người dùng tự chạy). Mình không chạy lệnh này và không tự đặt `approved`.
- **File xuất từ nguồn** (SRT ← timeline, social.md ← social.json, delivery/ ← mọi thứ): tạo bằng lệnh, tất định. `episode:status` và `episode:delivery --check` báo "khớp nguồn" hay "lệch nguồn". Không sửa tay file xuất.
- **Phụ đề:** `npm run episode:captions -- EPxxx`.
  - Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng (≤ 2 dòng, ≤ 42 ký tự; không tách từ ghép trong `NO_BREAK`).
  - Cue ngắn được giữ tối thiểu 0,8 s trong khoảng lặng phía sau, không chồng câu sau.
  - Báo cáo `reports/captions-qc.md` tách phần máy kiểm với phần cần người xem/nghe.
- **Social:** `npm run episode:social -- EPxxx` kiểm từ khóa lộ câu chốt, hứa ngày giờ, giới hạn nền tảng; ghi `social/social.md`. Bộ lọc từ khóa không chứng minh bài không spoil.
- **Ảnh bìa:** `npm run episode:thumbnails -- EPxxx` render 9:16 (2160x3840) và 1:1 (1080x1080) từ Still `<ID>-thumb-9x16` / `<ID>-teaser-1x1`. Mỗi tỷ lệ có bố cục riêng (camera, vị trí, khối chữ) trong `src/episodes/<id>-thumbnails.ts`. Không vẽ lại nhân vật, không đổi phong cách.
- **Bộ đăng thủ công:** `npm run episode:delivery -- EPxxx` xoá và tạo lại `delivery/` (video, SRT, 2 ảnh, youtube/facebook/tiktok.md, README, manifest.json có hash và trạng thái duyệt lúc xuất). Xuất không đổi trạng thái duyệt. Kiểm tra: `--check`.
- **Trạng thái:** `npm run episode:status -- EPxxx` tính lại toàn bộ hash. Những gì chưa tạo thì ghi "chưa có", không ghi là hoàn thành.
- **Tài nguyên dùng chung** (rig, nền, UI, model TTS, cấu hình giọng) để ngoài thư mục tập. `episode.json` ghi hash phiên bản (`voiceConfigHash`, `sharedAssetsHash`, commit) lúc sản xuất.

## Office Comedy Studio (`studio/`, `docs/studio.md`)

- Chạy: `npm run studio` hoặc `Studio.cmd` → http://127.0.0.1:5178. Chỉ nghe 127.0.0.1.
- **Một nguồn dữ liệu:** Studio đọc/ghi đúng các file của tập (`episode.json`, `social.json`, `publishing/jobs.json`) qua service dùng chung `tools/episode/service.ts`, `delivery.ts`, `tools/publish/dryrun.ts`. CLI dùng cùng service. Không tạo nguồn trạng thái duyệt thứ hai. `runtime/studio/tasks.json` chỉ là dữ liệu vận hành.
- Logic mới: viết vào service dùng chung trước, rồi gọi từ CLI và Studio. Không viết lại nghiệp vụ trong `studio/server`.
- Ghi file: `writeFileAtomic` + khoá `episodes/EPxxx/.lock` (`withFileLockSync`) cho mọi sửa `episode.json`/`social.json`/delivery.
- Duyệt từ Studio gửi kèm `viewToken` (hash sản phẩm + hash nguồn); máy chủ từ chối bản cũ. Mình không bấm duyệt thay người dùng, kể cả khi thử nghiệm (thử trên bản sao).
- Việc nặng hoặc lâu chạy bằng công việc nền gọi lệnh CLI trong tiến trình con (`runNodeScript`, đối số cố định, không shell). Không hiển thị phần trăm giả; máy chủ dừng giữa chừng thì công việc là "Bị gián đoạn".
- An toàn: kiểm Host/Origin + header `X-Studio` cho request thay đổi; API chỉ nhận mã tập và tên cố định; file phục vụ phải nằm trong thư mục cho phép sau khi giải symlink; không gửi bí mật xuống trình duyệt.
- Nút cho chức năng chưa có backend: khoá và ghi lý do (`Unavailable`). Không tạo trạng thái thành công giả.
- Giao diện build bằng esbuild (`node studio/build.mjs`); kiểm tra kiểu: `npm run lint` (gồm `tsc -p studio/server` và `tsc -p studio/web`).
- **Viết kịch bản bằng Claude** (`tools/ai/`, `tools/episode/scriptdoc.ts`, `scriptstore.ts`, `studio/server/aijobs.ts`):
  - Claude chỉ sinh hoặc sửa JSON kịch bản theo schema; không tool, không shell, không quyền sửa code. Backend cấp mã, lưu file, kiểm tra, cập nhật trạng thái.
  - SDK chính thức `@anthropic-ai/sdk` (khoá phiên bản). Model lấy từ `config/studio.json`, chỉ được chọn trong danh sách đã khai báo. Không đoán tên model. Không tự chuyển nhà cung cấp hay cách tính phí khi lỗi.
  - Khóa chỉ là `ANTHROPIC_API_KEY` trong `.env`. Không đưa khóa vào prompt, log, giao diện hay Git.
  - Bản Claude sửa luôn là đề xuất; phiên bản chỉ đổi qua `commitVersion` (kiểm hash bản đang xem). Lịch sử không xoá; phục hồi tạo phiên bản mới. Không tự duyệt.
  - Không gọi model khi chỉ mở, xem hay duyệt. Timeout hoặc lỗi mạng không tự thử lại (có thể đã tính phí); chỉ 429/529 được thử lại có giới hạn.
  - Chi phí luôn là ước tính từ số token API trả; thiếu dữ liệu thì ghi "không xác định", không ghi 0.
  - Mock (`tools/ai/mock.ts`) chỉ chạy khi có cả `STUDIO_TEST=1` và `STUDIO_AI_MOCK`; mọi kết quả mock mang nhãn `[MOCK]`.
- **`config/publishing.json` → `credentialEnv` chỉ chứa TÊN biến** (dạng `ABC_DEF`). Dry-run và trang Cấu hình không in mục nào không phải tên biến. Giá trị bí mật chỉ đặt trong `.env`.

## Đăng bài đa nền tảng (`tools/publish`, `config/publishing.json`)

- **Hiện tại chỉ có dry-run.** Chưa có code upload hay đặt lịch thật. Kế hoạch YouTube: `docs/youtube-integration-plan.md`. Không đăng hoặc đặt lịch khi người dùng chưa yêu cầu rõ ràng.
- **Job:** mỗi job là một bài trên một nền tảng và một tài khoản (`publishing/jobs.json`).
  - Trạng thái: `draft` → `planned` (lịch chỉ có trong dự án) → `uploading`/`processing` → `scheduled` (nền tảng đã xác nhận giữ lịch) → `published` (đã kiểm tra là công khai). Ngoài ra có `failed`, `cancelled`, `missed`.
  - HTTP thành công hay upload xong **không** có nghĩa là đã đăng công khai.
- **Giờ:** ghi theo Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè), lưu kèm UTC.
  - `npm run publish:plan -- EPxxx <jobId> "YYYY-MM-DD HH:mm"` chỉ đặt lịch trong dự án.
  - Chỉ dùng giờ người dùng đã xác nhận.
- **Chống trùng và khôi phục:**
  - Khóa `publishing/.lock` khi xử lý.
  - `idempotencyKey` = hash của tập, phiên bản, nền tảng, tài khoản đích, loại bài, media và nội dung.
  - Lưu remote ID ngay khi nhận được.
  - Job đã có remote ID hoặc đang dở thì phải đối chiếu trạng thái trên nền tảng trước, không gửi lại.
  - Retry tối đa `maxAttempts`, có ghi `log.jsonl` (bí mật được che).
  - Quá giờ cộng thời gian ân hạn mà job chưa chạy thì chuyển `missed`, **không tự đăng dồn**.
- **Kiểm tra trước khi đăng:** `npm run publish:dry-run -- EPxxx`. Chỉ báo cáo, không upload và không sửa job.
- **Bí mật:** token chỉ đặt trong `.env` hoặc kho bí mật ngoài repo. `config/publishing.json` chỉ ghi tên biến. Không in token ra log hay chat.
- **Nội dung social:**
  - Nhá hàng không lộ câu chốt (`spoilerGuard` trong `social.json`).
  - Không hứa ngày giờ khi chưa có lịch xác nhận.
  - Loại bài nền tảng hoặc API không hỗ trợ thì đặt `mode: "manual"` và chuẩn bị bản xuất để đăng tay.
- **Thứ tự tích hợp đề xuất:** YouTube, rồi Facebook Page. TikTok: đăng thủ công (xem `docs/publishing-platforms.md`).

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
- **Âm thanh cả tập:** `npm run episode:audio -- episodes/EPxxx/<id>.json`.
  - Giọng lấy từ `approved` theo vai. Câu thoại ở nhịp tự nhiên; mỗi nhịp hành động có `sec` theo nội dung.
  - Tổng = điểm kết thúc mục cuối; `durationInFrames = ceil(contentEndSec × fps)`. Âm thanh chỉ được đệm tới ranh giới khung hình cuối (dưới 1 khung).
  - Không kéo giọng, không chèn lặng, không cắt ép. Dưới 60 s thì công cụ dừng (mã 2) và báo cần bổ sung diễn biến.
  - Bản TTS bị clip thật (đỉnh bị cắt phẳng) là lỗi rõ ràng: chuyển bản đó sang `cache/tts/rejected/` rồi tạo lại đúng câu đó.
  - Video Remotion của tập phải lấy `durationInFrames` từ `timeline.json` (ví dụ qua `calculateMetadata`), không ghi cứng.
  - Kiểm tra kịch bản trước bằng `npm run script:lint`. Xuất `script.md` bằng `npm run episode:docs`.
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
