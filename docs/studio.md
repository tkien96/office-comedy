# Office Comedy Studio (website local)

Ứng dụng web chạy trên máy này, dùng để **quản lý tập** bằng giao diện tiếng Việt. Bản đầu ghi ngày 2026-11-11.

Thay đổi ngày **2026-11-16** (theo quyết định của người dùng):
- **Bỏ quy trình duyệt từng phần** (kịch bản, âm thanh, video, phụ đề, ảnh, từng bài social). Mỗi phần chỉ còn trạng thái "có / chưa có", tính từ file thật.
- **Đăng social thủ công.** Đã gỡ kết nối YouTube/Facebook/TikTok (OAuth, kho bí mật DPAPI), job đăng, lịch, dry-run.
- **Không gọi Claude API.** Kịch bản viết trong phiên Claude Code rồi đưa vào Studio thành bản đề xuất.

## Chạy

| Cách | Lệnh |
|---|---|
| Nhấp đúp | `Studio.cmd` ở thư mục gốc dự án. Build giao diện, chạy máy chủ, tự mở trình duyệt |
| PowerShell | `npm run studio` (build + chạy) · `npm run studio:serve` (chỉ chạy, khi đã build) · `npm run studio:build` |

- Địa chỉ: **http://127.0.0.1:5178**. Đổi cổng: `$env:STUDIO_PORT=5180; npm run studio`.
- Chỉ nghe trên `127.0.0.1`, nên máy khác trong mạng LAN không vào được. Dừng bằng Ctrl+C trong cửa sổ đang chạy.
- Cần **Node 22.18 trở lên** (khuyên dùng Node 24): máy chủ chạy thẳng file TypeScript bằng type stripping có sẵn của Node. `studio/start.mjs` kiểm phiên bản trước khi nạp file `.ts`.
- Cần chạy `npm install` **một lần** trước đó. Launcher không tự cài dependency.

## Chức năng

| Trang / tab | Làm gì |
|---|---|
| Danh sách tập | Tìm, lọc (đang làm / đủ mọi phần / lỗi dữ liệu), ảnh bìa, thời lượng, phần còn thiếu |
| Tạo tập mới | Cấp mã tập + lưu yêu cầu (`script/request.json`); không gọi model |
| Tổng quan | Thời lượng, phiên bản nội dung, các phần có/chưa có, file xuất còn khớp nguồn không |
| Kịch bản | Bản hiện hành + kiểm tra tự động, sửa tay, bản đề xuất (xem khác biệt, chấp nhận/bỏ), lịch sử và phục hồi phiên bản, câu yêu cầu để nhờ Claude Code |
| Âm thanh và video | Phát âm thanh đã ghép và video cuối (tua được) |
| Phụ đề | Bảng cue, bấm để tua video |
| Hình ảnh | Thumbnail 9:16, ảnh nhá hàng 1:1 |
| Nội dung social | Xem, sao chép bản dán, sửa từng bài (tiêu đề, mô tả, hashtag, khung bìa) |
| Bộ đăng thủ công | Tạo/cập nhật `delivery/`, kiểm còn khớp nguồn, tải ZIP |
| Báo cáo | QC tập, kiểm tra phụ đề, kịch bản và social bản đọc |
| Công việc nền | Lịch sử tạo bộ delivery (và bản ghi Claude API cũ, chỉ để xem) |
| Cấu hình | Giọng đã chốt, xưng hô, thông số sản xuất, thư mục |

Tạo giọng và render vẫn dùng lệnh npm (`episode:audio`, `episode:stage-audio`, `render:epxxx`, `episode:verify`).

## Kiến trúc

```
studio/
  build.mjs          esbuild → studio/dist (không đưa vào Git)
  web/               React 19 + TypeScript: index.html, styles.css, src/*.tsx
  server/            Node 24 (chạy thẳng file .ts), node:http, không framework
    main.ts          khởi động, chặn Host/Origin, phục vụ API + giao diện đã build
    api.ts           route tập, media, báo cáo, social, delivery, công việc nền, cấu hình
    scriptapi.ts     route tạo tập, kịch bản, phiên bản, đề xuất
    files.ts         phục vụ file trong thư mục cho phép (kiểm cả symlink/junction), HTTP Range
    tasks.ts         công việc nền (runtime/studio/tasks.json), chạy lệnh CLI trong tiến trình con
    config.ts        cấu hình ở dạng an toàn
    zip.ts           ghi ZIP dạng stream (store), chỉ các file trong manifest
tools/episode/       nghiệp vụ dùng chung cho CLI và Studio
  service.ts         các phần có/chưa có, sửa social, danh sách tập
  scriptstore.ts     phiên bản, đề xuất (proposeScript), yêu cầu
  scriptrequest.ts   tạo tập từ yêu cầu
  delivery.ts        lập, tạo (thư mục tạm → kiểm → thay), kiểm tra, danh sách ZIP
  fsutil.ts          ghi nguyên tử, khoá file dùng chung
```

- **Không có cơ sở dữ liệu.** Mọi dữ liệu nằm trong thư mục tập.

### Nguồn dữ liệu chính (một nguồn cho mỗi loại)

| Dữ liệu | Nguồn duy nhất | Studio làm gì |
|---|---|---|
| Metadata, phiên bản, kết quả kiểm tra | `episodes/EPxxx/episode.json` | Đọc |
| Kịch bản | `episodes/EPxxx/script/` | Đọc; đổi bản hiện hành chỉ qua `commitVersion` |
| Nội dung social | `episodes/EPxxx/social/social.json` | Đọc; sửa từng bài qua `updateSocialPost`, rồi tạo lại `social.md` |
| Bộ delivery | `episodes/EPxxx/delivery/` + `manifest.json` | Tạo lại bằng `episode:delivery`, chạy trong tiến trình con |
| Công việc nền | `runtime/studio/tasks.json` | Chỉ là dữ liệu vận hành |

### Sửa social

- Chỉ sửa được các trường đã có trong bài: `title`, `body`, `hashtags`, `coverTimestampMs`.
- Máy chủ kiểm hợp lệ: độ dài theo nền tảng, dạng hashtag, Unicode NFC.
- Chống ghi đè: gửi kèm hash bài đang xem. Bài đã bị đổi từ CLI hoặc tab khác thì trả 409.
- Ghi nguyên tử dưới khoá `episodes/EPxxx/.lock`, CLI cũng dùng khoá này. Cảnh báo lộ câu chốt hoặc hứa ngày giờ được hiển thị.

### Bộ đăng thủ công (delivery)

- Nút "Tạo/cập nhật" tạo công việc nền chạy `node tools/episode/cli/delivery.ts EPxxx` (đối số cố định, không qua shell).
  - Bấm lặp khi đang chạy trả về đúng công việc đó. Đóng tab thì công việc vẫn chạy.
  - Máy chủ dừng giữa chừng: lần khởi động sau ghi "Bị gián đoạn", không coi là xong.
- Ghi vào `delivery.tmp-*`, kiểm từng bản sao, xong mới đổi chỗ với bộ cũ. Lỗi thì giữ nguyên bộ cũ. Có file lạ trong `delivery/` thì từ chối, **không xoá**.
- ZIP chỉ gồm các file trong `delivery/manifest.json`, cộng README và manifest. Mỗi file được kiểm hash trước khi gửi.

## An toàn

- Nghe `127.0.0.1`. Kiểm `Host` (chống DNS rebinding).
- Request thay đổi dữ liệu phải có `Origin` của chính Studio, header `X-Studio: 1` và JSON (chống CSRF).
- API nhận mã tập (phải là thư mục có thật) và tên cố định (loại media, báo cáo, bài social), không nhận đường dẫn hay lệnh.
- File phục vụ phải nằm trong thư mục tập, hoặc trong `studio/dist` với giao diện. Đã kiểm sau khi giải symlink/junction.
- CSP chặt: không script ngoài, không inline script, ảnh chỉ từ chính Studio. Markdown hiển thị bằng React element, không dùng `innerHTML`.
- Không có thao tác xoá tập.

## Viết kịch bản bằng Claude Code (từ 2026-11-16)

Kịch bản viết trong phiên Claude Code của dự án (dùng hạn mức gói Claude của người dùng), rồi đưa vào Studio thành **bản đề xuất**.

1. **Tạo tập** (Studio → "Tạo tập mới", hoặc `npm run episode:new -- "Tiêu đề"`).
   - Studio cấp mã EP mới bằng bộ cấp mã dùng chung và lưu yêu cầu vào `script/request.json`.
   - Gửi lại cùng form trả về đúng tập đã tạo (`requestToken`), không cấp thêm mã.
2. **Nhờ Claude Code viết hoặc sửa.** Tab "Kịch bản" có câu yêu cầu mẫu để chép.
3. **Claude Code lưu đề xuất:** `npm run script:propose -- EPxxx <file.json> [--note "ghi chú"] [--check]`.
   - File cùng cấu trúc `script/script.json`. Thiếu `id` hay `duration` thì lấy theo tập; `id` khác tập thì từ chối.
   - Kiểm tra (`validateScript` + `lintScript`): cấu trúc, vai, dàn nhân vật, xưng hô, vùng giọng, số người nói mỗi cảnh, ước tính thời lượng. Có lỗi chặn thì **không lưu**.
   - Tập chưa được cấp mã thì từ chối (không tạo thư mục tập). Trùng đề xuất đang chờ thì không lưu lần hai.
4. **Xem trong Studio:** tab "Kịch bản" → "Bản đề xuất" → xem khác biệt → chấp nhận (tạo phiên bản mới, nguồn "Claude Code") hoặc bỏ.

Lưu trữ theo tập:

```
script/script.json            bản hiện hành (các công cụ đọc file này)
script/request.json           yêu cầu ban đầu
script/versions/v0001.json…   mọi phiên bản (nguồn: bạn sửa / Claude Code / Claude API cũ / phục hồi / bản có sẵn); không bao giờ xoá
script/proposals/<id>.json    bản đề xuất (source: "claude-code"; bản cũ không có source = Claude API), không tự áp dụng
```

- Bản hiện hành chỉ đổi qua `commitVersion` (kiểm hash bản đang xem); đề xuất chỉ áp dụng được khi bản hiện hành vẫn là bản nó dựa vào (khác thì "xung đột", không ghi đè).
- Lịch sử không xoá; phục hồi tạo phiên bản mới.

## Đã kiểm tra (2026-11-16, bản quản lý tập)

- `npm run lint` sạch (eslint, tsc cho src, tools, studio/server, studio/web); build giao diện thành công.
- EP001, EP002: `episode:status`, `episode:captions`, `episode:social`, `episode:docs`, `episode:delivery` + `--check` chạy đúng; bộ delivery khớp nguồn, không còn trạng thái duyệt.
- Kết quả kiểm trên giao diện: xem `PROGRESS.md` (mục 2026-11-16).

## Chưa triển khai

- Tạo TTS, render video, tạo ảnh bìa từ giao diện. Hiện dùng các lệnh npm có sẵn.
