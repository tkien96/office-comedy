# Kế hoạch tích hợp YouTube (chưa triển khai)

Trạng thái 2026-11-11: **mới là kế hoạch.** Chưa có code gọi API YouTube. Chưa upload, đặt lịch hay đăng gì.
Nguồn: tài liệu chính thức đã tra (xem `docs/publishing-platforms.md`, mục Nguồn), cộng trang trợ giúp ảnh thu nhỏ (support.google.com/youtube/answer/72431) và `thumbnails.set` (đọc ngày 2026-11-11).

## 1. Đăng nhập và cấp quyền trên máy (OAuth)

- **Loại client:** OAuth client "Desktop app" trong project Google Cloud của bạn, đã bật YouTube Data API v3.
  - `client_id` / `client_secret` đặt trong `.env` (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`). Với Desktop app, Google coi client secret không phải bí mật tuyệt đối, nhưng dự án vẫn không đưa vào Git.
- **Luồng đăng nhập** (lệnh dự kiến `npm run youtube:auth`):
  1. Lệnh mở một cổng tạm trên `127.0.0.1` (loopback), tạo `code_verifier` PKCE và `state` ngẫu nhiên.
  2. Lệnh mở trình duyệt tới trang đồng ý của Google. **Bạn tự đăng nhập và bấm cấp quyền.** Mình không nhập mật khẩu.
  3. Google chuyển hướng về `http://127.0.0.1:<cổng>` kèm `code`. Lệnh kiểm `state`, đổi `code` lấy token rồi đóng cổng.
- **Scope tối thiểu:**
  - `youtube.upload`: upload và đặt ảnh thu nhỏ.
  - `youtube.readonly`: đọc kênh, trạng thái video.
  - `youtube`: chỉ thêm khi cần `videos.update` (đổi lịch, sửa tiêu đề). Có thể xin ở bước sau.
- **Consent screen:**
  - Ở chế độ **Testing**, refresh token **hết hạn sau 7 ngày**. Nên chuyển sang **In production**.
  - App chưa xác minh sẽ hiện cảnh báo "Google chưa xác minh ứng dụng này". Bạn là chủ app, nên có thể bấm tiếp.
- **Không bao giờ** yêu cầu bạn dán token vào chat. Token đi thẳng từ Google vào máy, không qua cuộc hội thoại.

## 2. Xác nhận đúng kênh (Channel ID)

- Sau khi có token, gọi `channels.list?part=id,snippet&mine=true` và in **tên kênh + Channel ID** để bạn đối chiếu.
- `config/publishing.json` → `targets["youtube.main"].channelId`:
  - Đang `null`: lệnh dừng và yêu cầu bạn xác nhận rồi tự ghi ID vào config. Lệnh không tự ghi.
  - Khác kênh vừa đăng nhập: **từ chối mọi thao tác** (tránh đăng nhầm kênh, ví dụ khi tài khoản có nhiều kênh hoặc Brand Account).
- Mỗi lần chạy upload, lệnh đối chiếu lại Channel ID trước khi gửi.

## 3. Lưu và làm mới token

- **Refresh token:**
  - Đề xuất lưu ở file ngoài repo: `%LOCALAPPDATA%\office-comedy\secrets\youtube-token.json`. Đường dẫn ghi trong `.env` là `YOUTUBE_TOKEN_FILE`.
  - Phương án thay thế: biến `YOUTUBE_REFRESH_TOKEN` trong `.env` (đã có trong `.env.example`).
  - Cả hai cách đều nằm ngoài Git. File token chỉ cấp quyền đọc cho tài khoản Windows của bạn.
- **Access token:** chỉ giữ trong bộ nhớ, sống khoảng 1 giờ. Lỗi `401` thì làm mới bằng `grant_type=refresh_token`, tối đa 1 lần cho mỗi request.
- **`invalid_grant`** (token bị thu hồi, hết hạn 7 ngày, đổi mật khẩu): dừng lại và báo bạn chạy lại `youtube:auth`. Không thử lại vòng lặp.
- **Log:** hàm `redact` sẵn có che `access_token`, `refresh_token`, `client_secret`, `Authorization` và URL phiên upload. Không in token ra console.

## 4. Upload resumable và tiếp tục khi gián đoạn

Luồng cho mỗi job (`EP001-youtube-video`), bên trong khóa `publishing/.lock`:

1. **Kiểm tra trước khi gửi** (như dry-run hiện tại):
   - mọi duyệt khớp hash và nguồn: video, phụ đề, thumbnail, `social.youtube.video`;
   - đúng kênh;
   - lịch hợp lệ;
   - job chưa có remote ID.
2. **Mở phiên:** `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`.
   - Body là metadata: title, description, tags, `categoryId`, `defaultLanguage: vi`, `status.privacyStatus: private`, `status.publishAt`, `status.selfDeclaredMadeForKids: false`.
   - Header `X-Upload-Content-Length` và `X-Upload-Content-Type: video/mp4`.
   - Nhận về `Location` là URL phiên.
3. **Lưu phiên ngay:**
   - URL phiên, kích thước, sha256 file và thời điểm ghi vào `publishing/upload-state.json`.
   - File này bị Git bỏ qua vì URL phiên cho phép tải tiếp mà không cần đăng nhập.
   - Job chuyển `planned → uploading`.
4. **Gửi theo khúc:** `PUT` từng khúc 8 MiB (bội của 256 KiB) với `Content-Range`.
   - Mã `308` kèm header `Range` cho biết đã nhận tới đâu.
5. **Bị ngắt** (mạng, tắt máy, lỗi 5xx):
   - Hỏi trạng thái bằng `PUT` rỗng với `Content-Range: bytes */<tổng>`.
   - Đọc `Range` rồi gửi tiếp từ byte kế tiếp.
   - Lỗi 5xx và 429 thì chờ tăng dần, tối đa `maxAttempts` (3).
   - Lỗi 4xx khác thì dừng và ghi `failed`.
6. **Hoàn tất:**
   - Response `200/201` chứa `id` video. **Ghi ID vào job ngay** (ghi nguyên tử), trước mọi bước khác.
   - Chuyển job sang `processing`, rồi xoá URL phiên khỏi `upload-state.json`.

Hạn mức:
- `videos.insert` có hạn mức riêng 100 lượt/ngày.
- Các lệnh khác dùng chung 10.000 đơn vị/ngày.
- Lỗi `quotaExceeded` hoặc `uploadLimitExceeded` thì dừng tới khi hạn mức đặt lại, không retry.

## 5. Đối chiếu sau timeout, trước khi tải lại

Trường hợp nguy hiểm: file đã lên đủ nhưng response cuối bị mất, nên dự án không biết video ID. Upload lại sẽ ra **video trùng**.

1. Còn URL phiên: gửi `PUT bytes */<tổng>`.
   - Nếu trả về `200/201` kèm resource video, đó chính là video ID. Ghi ID lại, xong.
2. Phiên hết hạn hoặc mất (404/410):
   - Liệt kê video mới tải lên của kênh: `channels.list part=contentDetails mine=true` → playlist uploads → `playlistItems.list`, rồi `videos.list part=snippet,status,fileDetails`.
   - So khớp theo:
     - **thẻ đánh dấu** `oc-<8 ký tự đầu idempotencyKey>` gắn trong `snippet.tags` lúc mở phiên;
     - tiêu đề;
     - thời gian tải lên nằm sau lúc mở phiên;
     - `fileDetails.fileSize` (chỉ chủ kênh đọc được).
3. Kết quả:
   - **Đúng một** video khớp: ghi ID đó.
   - **Không** video nào khớp **và** đã kiểm tra xong: mới được mở phiên mới (tính một lần thử).
   - **Từ hai** video khớp trở lên, hoặc không chắc: dừng, báo bạn kiểm tra trong Studio. **Không tự upload lại.**
4. Job có `remote.id` hoặc đang `uploading`/`processing` luôn phải đối chiếu trước (`mustReconcileBeforeSend`, đã có).

## 6. Kiểm tra xử lý và lịch công khai

Lệnh dự kiến `npm run publish:sync -- EP001` chỉ đọc, chạy tay hoặc theo lịch. Nó gọi `videos.list?part=status,processingDetails,snippet&id=<id>` (1 đơn vị) và chuyển trạng thái job như sau:

| API trả về | Trạng thái job |
|---|---|
| `uploadStatus=uploaded`, `processingStatus=processing` | `processing` |
| `processingStatus=succeeded`, `privacyStatus=private`, có `publishAt` | `scheduled` (YouTube đã giữ lịch) |
| `privacyStatus=public` và đã qua `publishAt` | `published`, ghi URL `https://youtube.com/shorts/<id>` |
| `uploadStatus=failed/rejected/deleted`, `processingStatus=failed/terminated` | `failed`, ghi `failureReason`/`rejectionReason` |

- Upload thành công (HTTP 200) **không** được tính là đã đăng.
- **Đổi lịch:** `videos.update part=status` khi video còn private và chưa từng công khai. Phải gửi đủ object `status` (`privacyStatus`, `publishAt`, `selfDeclaredMadeForKids`, …), vì `update` thay cả phần `status`.
- **Huỷ lịch:** `videos.update`, bỏ `publishAt` và giữ `private`. Tài liệu không có thao tác "huỷ" riêng; đây là suy ra, cần thử trên video thử trước.
- **Lỡ giờ:** quy tắc `missed` đã có cho job còn `planned` sau giờ đăng cộng ân hạn. Job đã ở `scheduled` thì YouTube tự công khai, dự án chỉ xác nhận.

## 7. Giới hạn riêng cho Shorts và ảnh bìa

- **Shorts:** API không có cờ riêng. YouTube xếp vào Shorts khi video dọc hoặc vuông và dài ≤ 3 phút.
  - EP001: 1080x1920, 63,3 s, nên đạt. Hashtag `#Shorts` là tùy chọn.
- **Ảnh thu nhỏ cho Shorts:**
  - Trợ giúp YouTube: chỉ đặt được trong YouTube Studio **trên máy tính**, và tài khoản **phải xác minh**. Khuyến nghị 9:16, 2160x3840, cao tối thiểu 640 px, JPG/PNG.
  - `thumbnails.set` ghi rõ dùng được cho cả Shorts, file tối đa 50 MB.
  - Phải gọi **sau khi** `processingStatus=succeeded`; gọi sớm thì ảnh có thể không được áp dụng.
  - Trợ giúp không nói ảnh này có hiện trong luồng Shorts hay không.
  - `thumb-9x16.png` của EP001 (2160x3840, khoảng 540 KB) đạt các thông số trên.
- **Phụ đề:**
  - `captions.insert` tốn 400 đơn vị, nên làm bước riêng sau khi video xử lý xong.
  - Hoặc tải SRT tay trong Studio. Video đã in sẵn phụ đề.
- **Cần bạn quyết định:**
  - Có đánh dấu nội dung thay đổi hoặc tổng hợp (`status.containsSyntheticMedia`) không. Lý do: giọng đọc là giọng clone bằng AI.
  - Phim là hoạt hình, nhưng quy định của YouTube về nội dung tổng hợp trông như thật có thể vẫn liên quan đến giọng clone.

## 8. Cấu trúc code dự kiến

| Phần | File |
|---|---|
| OAuth loopback + PKCE, đọc/ghi file token | `tools/publish/youtube/oauth.ts` |
| Gọi API, làm mới token, retry, che bí mật | `tools/publish/youtube/client.ts` |
| Upload resumable, lưu phiên, tiếp tục | `tools/publish/youtube/upload.ts` |
| Đối chiếu sau timeout | `tools/publish/youtube/reconcile.ts` |
| Lệnh | `youtube:auth`, `youtube:whoami`, `publish:run -- EP001 <jobId> --confirm`, `publish:sync -- EP001` |

- `publish:run` bắt buộc có `--confirm <jobId>` và chạy lại toàn bộ dry-run ngay trước khi gửi.
- **Lần chạy thật đầu tiên** nên là một video thử ở chế độ private, không hẹn giờ, trên kênh của bạn. Sau đó bạn kiểm tra trong Studio rồi xoá.

## 9. Cần bạn chuẩn bị

1. Project Google Cloud, đã bật YouTube Data API v3. Consent screen loại External, đặt In production.
2. OAuth client loại Desktop app. Dán `client_id` và `client_secret` vào `.env` **trên máy bạn**, không dán vào chat.
3. Kênh YouTube đã xác minh (để đặt ảnh thu nhỏ).
4. Xác nhận Channel ID sau khi `youtube:auth` in ra.
5. Quyết định về nhãn nội dung tổng hợp. Lịch đăng đã xác nhận.
