# Office Comedy Studio (website local)

Ứng dụng web chạy trên máy này, dùng để quản lý sản xuất và phát hành từng tập bằng giao diện tiếng Việt. Bản đầu ghi ngày 2026-11-11.

## Chạy

| Cách | Lệnh |
|---|---|
| Nhấp đúp | `Studio.cmd` ở thư mục gốc dự án. Build giao diện, chạy máy chủ, tự mở trình duyệt |
| PowerShell | `npm run studio` (build + chạy) · `npm run studio:serve` (chỉ chạy, khi đã build) · `npm run studio:build` |

- Địa chỉ: **http://127.0.0.1:5178**. Đổi cổng: `$env:STUDIO_PORT=5180; npm run studio`.
- Chỉ nghe trên `127.0.0.1`, nên máy khác trong mạng LAN không vào được. Dừng bằng Ctrl+C trong cửa sổ đang chạy.
- Cần chạy `npm install` **một lần** trước đó. Launcher không tự cài dependency.
- Thiếu dependency hoặc cổng đang bận: lệnh báo rõ rồi dừng.

## Kiến trúc

```
studio/
  build.mjs          esbuild (có sẵn qua Remotion) → studio/dist (không đưa vào Git)
  web/               React 19 + TypeScript: index.html, styles.css, src/*.tsx
  server/            Node 24 (chạy thẳng file .ts), node:http, không framework
    main.ts          khởi động, chặn Host/Origin, phục vụ API + giao diện đã build
    api.ts           các route; chỉ nhận mã tập và tên sản phẩm cố định
    files.ts         phục vụ file trong thư mục cho phép (kiểm cả symlink/junction), HTTP Range
    tasks.ts         công việc nền (runtime/studio/tasks.json), chạy lệnh CLI trong tiến trình con
    config.ts        cấu hình ở dạng an toàn (không có bí mật)
    zip.ts           ghi ZIP dạng stream (store), chỉ các file trong manifest
tools/episode/       nghiệp vụ dùng chung cho CLI và Studio
  service.ts         trạng thái từng sản phẩm, duyệt (kèm mã phiên bản), sửa social, danh sách tập
  delivery.ts        lập, tạo (thư mục tạm → kiểm → thay), kiểm tra, danh sách ZIP
  fsutil.ts          ghi nguyên tử, khoá file dùng chung
tools/publish/dryrun.ts  dry-run dùng chung
```

- **Không gọi Claude** cho việc cố định: đọc danh sách, duyệt, kiểm hash, dry-run, xuất delivery đều là code.
- **Không có cơ sở dữ liệu.** Chưa cần SQLite.

### Nguồn dữ liệu chính (một nguồn cho mỗi loại)

| Dữ liệu | Nguồn duy nhất | Studio làm gì |
|---|---|---|
| Metadata, sản xuất, **duyệt** | `episodes/EPxxx/episode.json` | Đọc; ghi duyệt qua `approvePart`, cùng code với `episode:approve` |
| Nội dung social | `episodes/EPxxx/social/social.json` | Đọc; sửa từng bài qua `updateSocialPost`, rồi tạo lại `social.md` |
| Job phát hành | `episodes/EPxxx/publishing/jobs.json` | Chỉ đọc. Bản đầu không tạo, không đổi trạng thái job |
| Báo cáo dry-run | `episodes/EPxxx/reports/publish-dry-run.json` | Ghi lại mỗi lần chạy, giống CLI |
| Bộ delivery | `episodes/EPxxx/delivery/` + `manifest.json` | Tạo lại bằng `episode:delivery`, chạy trong tiến trình con |
| Công việc nền | `runtime/studio/tasks.json` | Chỉ là dữ liệu vận hành, **không** chứa trạng thái duyệt hay phát hành |

### Duyệt

- Mỗi sản phẩm có **mã phiên bản đang xem** (`viewToken`) = hash của sản phẩm cộng hash các nguồn nó phụ thuộc.
- Nút Duyệt gửi kèm mã này. Máy chủ từ chối (409) nếu file hoặc nguồn đã đổi sau khi bạn mở trang.
- Thu hồi duyệt: đưa sản phẩm về "Chờ duyệt", không sửa file.
- Không có duyệt tự động, không kế thừa duyệt.
- Duyệt nội dung **không** có nghĩa là đồng ý đăng.

### Sửa social

- Chỉ sửa được các trường đã có trong bài: `title`, `body`, `hashtags`, `coverTimestampMs`.
- Máy chủ kiểm hợp lệ: độ dài theo nền tảng, dạng hashtag, Unicode NFC.
- Chống ghi đè: gửi kèm hash bài đang xem. Bài đã bị đổi từ CLI hoặc tab khác thì trả 409.
- Ghi nguyên tử dưới khoá `episodes/EPxxx/.lock`, CLI cũng dùng khoá này.
- Sửa một bài chỉ làm **bài đó** thành "cần duyệt lại". Cảnh báo lộ câu chốt hoặc hứa ngày giờ được hiển thị, và dry-run chặn đăng.

### Delivery

- Nút "Tạo/cập nhật" tạo công việc nền chạy `node tools/episode/cli/delivery.ts EPxxx` (danh sách đối số cố định, không qua shell).
  - Bấm lặp khi đang chạy trả về đúng công việc đó, không tạo thêm.
  - Đóng tab thì công việc vẫn chạy; mở lại thấy trạng thái.
  - Máy chủ dừng giữa chừng: lần khởi động sau ghi "Bị gián đoạn", không coi là xong.
- Cách tạo:
  - Ghi vào `delivery.tmp-*`, kiểm từng bản sao, xong mới đổi chỗ với bộ cũ. Lỗi thì giữ nguyên bộ cũ.
  - Có file không do lệnh tạo ra trong `delivery/` thì từ chối và báo tên file, **không xoá**.
- ZIP chỉ gồm các file trong `delivery/manifest.json`, cộng README và manifest. Mỗi file được kiểm hash trước khi gửi.

## An toàn

- Nghe `127.0.0.1`. Kiểm `Host` (chống DNS rebinding).
- Request thay đổi dữ liệu phải có `Origin` của chính Studio, header `X-Studio: 1` và JSON (chống CSRF).
- API nhận mã tập (phải là thư mục có thật) và tên cố định (loại media, báo cáo, bài social), không nhận đường dẫn hay lệnh.
- File phục vụ phải nằm trong thư mục tập, hoặc trong `studio/dist` với giao diện. Đã kiểm sau khi giải symlink/junction.
- Không phục vụ cả repository.
- CSP chặt: không script ngoài, không inline script. Markdown hiển thị bằng React element, không dùng `innerHTML`.
- Không gửi token hay giá trị biến môi trường xuống trình duyệt. Chỉ báo "có/chưa có" theo **tên** biến.
- Không có thao tác xoá tập.

## Đã kiểm tra (2026-11-11)

**Trên bản sao trong thư mục tạm** (không duyệt hay sửa EP001 thật): 35/35 kiểm tra tự động đạt.

- Tập hỏng JSON và tập thiếu media báo lỗi đúng tập, các tập khác vẫn hiện.
- Duyệt qua API khớp `episode:status`; duyệt bằng CLI hiện trong Studio.
- Duyệt bản cũ bị từ chối khi phụ đề đổi sau khi mở trang.
- Đổi timeline: video chuyển "cần kiểm tra lại"; thumbnail và social không bị ảnh hưởng.
- Sửa bài Facebook chỉ làm bài đó cần duyệt lại; YouTube giữ duyệt; `social.md` khớp nguồn.
  - Sửa bằng phiên bản cũ bị từ chối.
  - Hashtag sai và trường không cho sửa bị từ chối.
- Dry-run: video YouTube không bị chặn bởi bài nhá hàng chưa duyệt; vẫn chặn đúng vì thiếu tài khoản và lịch.
- Bấm tạo delivery 4 lần cùng lúc chỉ ra 1 công việc; mở lại trang thấy cùng công việc.
- Có file lạ trong delivery: từ chối, giữ file, giữ bộ cũ, không còn thư mục tạm, không đổi duyệt.
- Lỗi giả lập giữa lúc tạo delivery: bộ cũ giữ nguyên.
- Công việc đang chạy khi máy chủ dừng chuyển "Bị gián đoạn" sau khi khởi động lại.
- Junction trỏ ra ngoài thư mục tập bị chặn (403).

**Trên giao diện, bằng trình duyệt:**
- Mở danh sách, chi tiết, các tab, báo cáo, cấu hình.
- Tua video tới 30 s, phát được âm thanh. HTTP Range trả 206 và 416.
- Trên bản sao: duyệt bằng nút, sửa và lưu social, tạo delivery rồi rời trang.
- ZIP tải về mở được bằng `Expand-Archive` của Windows; hash video và ảnh khớp bản gốc.

**An toàn (curl):**
- Host lạ, thiếu hoặc sai Origin, thiếu `X-Studio`, gửi không phải JSON: bị chặn.
- Phần không hợp lệ, tập không tồn tại, loại media lạ, đường dẫn `..` (thường và mã hoá): bị chặn.
- `DELETE` trả 405.

**Chưa kiểm tra:**
- Trình duyệt khác ngoài trình duyệt tích hợp của ứng dụng Claude.
- Màn hình desktop rộng (khung trình duyệt lúc thử khá hẹp nên chỉ thấy bố cục hẹp).
- Chạy `Studio.cmd` bằng nhấp đúp. Mình đã đọc lại file và kiểm CRLF, chưa chạy thật.

## Chưa triển khai (nút liên quan bị khoá và có ghi lý do)

- Tạo ý tưởng và kịch bản bằng Claude.
- Tạo TTS, render video, tạo ảnh bìa từ giao diện. Hiện dùng các lệnh npm có sẵn.
- OAuth, kết nối tài khoản, upload, đặt lịch, đăng thật.
- Tạo hoặc đổi trạng thái job, đặt lịch trong dự án (vẫn có `npm run publish:plan`).

## Bước tiếp theo: "Tạo tập mới bằng Claude"

1. **Backend:**
   - Thêm loại công việc `episode-draft` vào `studio/server/tasks.ts`.
   - Công việc cấp mã tập bằng `tools/episode/cli/new.ts` (khoá `mkdir` nguyên tử), rồi gọi Claude API (SDK `@anthropic-ai/sdk`, model mới nhất).
   - Prompt hệ thống dựng từ CLAUDE.md: nhân vật, vùng giọng, xưng hô, tối đa 2 người nói mỗi cảnh, thời lượng theo nội dung.
   - Kết quả có cấu trúc khớp schema `script.json`.
2. **Khoá API:** đặt `ANTHROPIC_API_KEY` trong `.env`. Server đọc khoá, không gửi xuống trình duyệt, không ghi log. Có giới hạn số lần gọi và ghi sổ chi phí như `cache/tts/ledger.jsonl`.
3. **Kiểm tra trước khi lưu:**
   - Chạy `script:lint` trên bản nháp; lỗi thì không ghi.
   - Ghi `script/script.json` với trạng thái chưa duyệt. Không tự duyệt.
4. **Giao diện:** trang "Tạo tập mới" gồm nhập ý tưởng, xem bản nháp, sửa, rồi tạo, và hiện tiến trình thật của công việc (không dùng phần trăm giả).
5. **Bước sau nữa:** nối TTS (`episode:audio`) và render vào cùng hệ công việc nền, chạy trong tiến trình con như delivery.
