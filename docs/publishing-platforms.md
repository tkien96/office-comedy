# Khả năng đăng bài theo nền tảng

Tra từ tài liệu chính thức ngày **2026-11-11**. Chính sách nền tảng thay đổi thường xuyên.

> **Chỉ để tham khảo.** Từ 2026-11-16 dự án **đăng thủ công**; mọi tích hợp đăng bài qua API (kết nối tài khoản, job, lịch, dry-run) đã gỡ. Bảng dưới giữ lại để biết giới hạn từng nền tảng (ảnh bìa, độ dài, hẹn giờ trong app) khi đăng tay.

Ký hiệu: ✅ có API · ⚠️ có nhưng kèm điều kiện · ❌ không có · ❓ tài liệu không nói rõ.

## Bảng khả năng

| Nền tảng / loại bài | Upload | Hẹn giờ | Thumbnail / bìa | Sửa lịch | Hủy lịch | Kiểm tra trạng thái |
|---|---|---|---|---|---|---|
| **YouTube: video (Shorts)** | ✅ `videos.insert` (resumable) | ✅ `privacyStatus=private` + `publishAt` (ISO 8601) | ⚠️ `thumbnails.set`, cần kênh đã xác minh; gọi sau khi `processingStatus=succeeded` | ✅ `videos.update` khi video còn private và chưa từng công khai | ⚠️ suy ra: `videos.update` bỏ `publishAt` (tài liệu không ghi rõ "hủy") | ✅ `videos.list` part=`status,processingDetails` |
| YouTube: bài cộng đồng / ảnh | ❌ không có API | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Facebook Page: Reels** | ✅ `/{page-id}/video_reels` (start → upload → finish) | ✅ `video_state=SCHEDULED`, từ 10 phút đến 29 ngày | ✅ `/{video-id}/thumbnails` | ❓ | ❓ | ✅ `GET /{video-id}?fields=status` (`publishing_phase.publish_status`) |
| Facebook Page: video thường | ✅ `/{page-id}/videos` | ✅ từ 10 phút đến 6 tháng | ✅ (`thumb` hoặc `/thumbnails`) | ❓ | ❓ | ✅ |
| **Facebook Page: ảnh / bài feed** | ✅ `/{page-id}/photos`, `/{page-id}/feed` | ✅ bài feed từ 10 phút đến 75 ngày; khung hẹn giờ cho ảnh ❓ | — | ⚠️ `POST /{post-id}` (chỉ bài do chính app tạo) | ⚠️ `DELETE /{post-id}` | ✅ `is_published`, `permalink_url` |
| **TikTok: video** | ⚠️ Direct Post (`video.publish`) hoặc gửi vào hộp nháp (`video.upload`) | ❌ không có hẹn giờ | ⚠️ chỉ chọn khung hình làm bìa (`video_cover_timestamp_ms`) | ❌ | ❌ (chỉ hủy được tải xuống đang chờ) | ✅ `/v2/post/publish/status/fetch/` |
| TikTok: ảnh | ⚠️ `/v2/post/publish/content/init/` (ảnh JPEG/WebP lấy từ URL thuộc tên miền đã xác minh) | ❌ | ⚠️ `photo_cover_index` | ❌ | ❌ | ✅ |

## Điều kiện quan trọng

### YouTube

- **Hạn mức:** `videos.insert` có hạn mức riêng 100 lượt/ngày. Các lệnh khác dùng chung 10.000 đơn vị/ngày (`videos.update` 50, `thumbnails.set` ~50, `videos.list` 1).
- **Project chưa xác minh:** theo revision history ngày 02/11/2026, video tải lên từ project chưa xác minh **không còn bị khoá ở chế độ private**.
- **Shorts:** không có cờ riêng trong API. Video khung dọc hoặc vuông, dài ≤ 3 phút được xếp vào Shorts. EP001 dài 63 s, khung 1080x1920, nên đạt.
- **Xác nhận đã công khai:** tài liệu không có trường "đã công khai". Dự án chỉ coi là `published` khi `privacyStatus=public`, `uploadStatus=processed` và đã qua giờ `publishAt`.
- **OAuth:** dùng client loại Desktop app, có PKCE. Nếu consent screen để ở chế độ **Testing** thì refresh token **hết hạn sau 7 ngày**.

### Facebook Page (Graph API v27.0)

- **Quyền cần có:** `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, dùng Page access token. Riêng ảnh bìa video cần thêm `pages_read_user_content` và `pages_manage_engagement`.
- **Giới hạn Reels:** khung 9:16, dài 3–90 s, tối đa 30 bài đăng qua API trong 24 giờ.
- **Chế độ Development:** app chỉ dùng được quyền với những người có vai trò trong app. Có thể đăng lên Page do chính admin đó quản lý (Standard access). Muốn người ngoài dùng thì cần App Review, Advanced access và Business Verification.
- **Token:** đổi long-lived user token lấy Page token không có ngày hết hạn, hoặc dùng System User token trong Business Manager.

### TikTok

- **Client chưa qua audit:**
  - Chỉ đăng được ở chế độ **SELF_ONLY** (riêng tư).
  - Tối đa 5 người dùng đăng trong 24 giờ.
  - Tài khoản phải đặt ở chế độ riêng tư lúc đăng.
- **Hướng dẫn xét duyệt** (Content Sharing Guidelines) liệt kê là **không được chấp nhận**: "A utility tool to help upload contents to the account(s) you or your team manages". Công cụ của dự án đúng là loại này, nên **không thể cam kết tự đăng công khai lên TikTok**.
- **Trang audit:** trả về 401 khi đọc, nên chưa xác minh được các yêu cầu audit chi tiết.
- **Direct Post bắt buộc có giao diện:** người dùng tự chọn quyền riêng tư (không có giá trị mặc định), tự bật bình luận/duet/stitch, xem trước nội dung, và đồng ý Music Usage Confirmation. Một script tự động không đáp ứng được những yêu cầu này.

## Ảnh bìa theo nền tảng (tra lại 2026-11-11)

"Ảnh bàn giao" = file trong `episodes/EPxxx/delivery/` để đăng tay. "Đặt qua API" = dự án có thể tự gắn sau khi tích hợp.

| Đích | Ảnh bàn giao | Đặt tay | Đặt qua API | Thông số chính thức |
|---|---|---|---|---|
| YouTube Shorts | `thumb-9x16.png` (2160x3840) | ✅ YouTube Studio **trên máy tính**; tài khoản phải xác minh | ✅ `thumbnails.set` (ghi rõ dùng cho Shorts), gọi sau khi xử lý xong | 9:16, khuyến nghị 2160x3840, cao ≥ 640 px, JPG/PNG, ≤ 50 MB (máy tính). Không rõ ảnh có hiện trong luồng Shorts hay không |
| Facebook Reels | `thumb-9x16.png` | ❓ chưa tìm được trang trợ giúp chính thức | ⚠️ `POST /{video-id}/thumbnails` (`source`, `is_preferred`); bước publish Reel không có tham số ảnh bìa | ≤ 10 MB; nên cùng tỷ lệ với video |
| TikTok video | khung hình gợi ý (`coverTimestampMs`) + `thumb-9x16.png` để dự phòng | ❓ chưa xác minh được app có cho tải ảnh bìa riêng không (trang trợ giúp trả 404) | ⚠️ chỉ chọn khung hình `video_cover_timestamp_ms`, không nhận ảnh riêng | — |
| Facebook / TikTok bài ảnh | `teaser-1x1.png` (1080x1080) | ✅ | Facebook `/{page-id}/photos`; TikTok bài ảnh (cần URL thuộc tên miền đã xác minh) | Tài liệu đã đọc không nêu tỷ lệ khuyến nghị |

Nguồn bổ sung: support.google.com/youtube/answer/72431 · developers.google.com/youtube/v3/docs/thumbnails/set · developers.facebook.com/docs/graph-api/reference/video/thumbnails · developers.tiktok.com/doc/content-posting-api-reference-direct-post · /content-posting-api-reference-photo-post.

## Nguồn

- YouTube: developers.google.com/youtube/v3/docs/videos/insert · /videos/update · /videos/list · /thumbnails/set · /determine_quota_cost · /revision_history · /guides/auth/installed-apps; developers.google.com/identity/protocols/oauth2#expiration; support.google.com/youtube/answer/15424877, /72431
- Facebook: developers.facebook.com/docs/video-api/guides/reels-publishing · /docs/graph-api/reference/page/videos · /page/feed · /page/photos · /video/thumbnails · /docs/pages/access-tokens · /docs/development/build-and-test/app-modes · /docs/graph-api/overview/access-levels · /docs/graph-api/changelog
- TikTok: developers.tiktok.com/doc/content-posting-api-get-started · /content-posting-api-reference-direct-post · /content-posting-api-reference-upload-video · /content-posting-api-reference-get-video-status · /content-posting-api-reference-query-creator-info · /content-posting-api-reference-photo-post · /content-posting-api-media-transfer-guide · /content-sharing-guidelines
