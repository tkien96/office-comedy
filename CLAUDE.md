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

## Cấu trúc thư mục (dự kiến)

```
src/
  Root.tsx              đăng ký các Composition
  test/                 composition kiểm tra kỹ thuật
  components/           bộ dựng dùng lại (nhân vật, phụ đề, cảnh, hiệu ứng)
  episodes/             dữ liệu kịch bản từng tập (không chứa logic dựng)
public/
  characters/           bộ tài nguyên cố định cho từng nhân vật
  audio/                giọng đọc, nhạc nền, hiệu ứng âm thanh
out/                    video xuất ra (không đưa vào Git)
```

## Quy trình làm việc

1. Đọc `PROGRESS.md` khi bắt đầu phiên để biết đang ở bước nào.
2. Làm một bước, kiểm tra kết quả, cập nhật `PROGRESS.md`.
3. Không commit hoặc push nếu người dùng chưa yêu cầu.
