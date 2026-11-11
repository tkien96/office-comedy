# Khả năng đăng bài theo nền tảng

Tra từ tài liệu chính thức ngày **2026-11-11**. Chính sách nền tảng thay đổi thường xuyên, nên kiểm tra lại trước khi tích hợp. Dự án **chưa upload, chưa đăng, chưa đặt lịch thật** trên nền tảng nào.

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

## Đề xuất

1. **YouTube trước.**
   - API đủ cho upload, hẹn giờ, thumbnail và kiểm tra trạng thái.
   - Cần project Google Cloud, OAuth Desktop client và refresh token. Nên đưa consent screen sang In production để token không hết hạn sau 7 ngày.
2. **Facebook Page sau.**
   - Đăng Reels hẹn giờ trong vòng 29 ngày, kèm ảnh bìa. Bài nhá hàng dạng ảnh.
   - App ở chế độ Development, chỉ admin của Page dùng.
3. **TikTok: đăng thủ công.**
   - Dự án chuẩn bị gói xuất: video, caption, hashtag, khung bìa gợi ý.
   - Người dùng tự đăng trong app TikTok, rồi ghi lại link vào job.
   - Không xây công cụ tự đăng TikTok khi chưa đủ điều kiện audit.

## Thông tin tài khoản và quyền còn thiếu

| Nền tảng | Cần người dùng cung cấp / làm |
|---|---|
| YouTube | Channel ID; project Google Cloud đã bật YouTube Data API v3; OAuth client (Desktop app); refresh token có scope `youtube.upload` (và `youtube` nếu cần sửa lịch); trạng thái consent screen; kênh đã xác minh (để đặt thumbnail) |
| Facebook | Page ID; Meta App (loại Business) mà người dùng là admin hoặc developer; Page access token dài hạn (hoặc System User token) có `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` (thêm `pages_manage_engagement`, `pages_read_user_content` nếu đặt bìa) |
| TikTok | Tên tài khoản (để ghi vào job); xác nhận phương án đăng thủ công |
| Chung | Lịch đăng đã xác nhận (giờ Việt Nam) cho từng bài |

Token chỉ đặt trong `.env` (Git bỏ qua) hoặc kho bí mật ngoài repo. `config/publishing.json` chỉ chứa **tên** biến môi trường.

## Nguồn

- YouTube: developers.google.com/youtube/v3/docs/videos/insert · /videos/update · /videos/list · /thumbnails/set · /determine_quota_cost · /revision_history · /guides/auth/installed-apps; developers.google.com/identity/protocols/oauth2#expiration; support.google.com/youtube/answer/15424877, /72431
- Facebook: developers.facebook.com/docs/video-api/guides/reels-publishing · /docs/graph-api/reference/page/videos · /page/feed · /page/photos · /video/thumbnails · /docs/pages/access-tokens · /docs/development/build-and-test/app-modes · /docs/graph-api/overview/access-levels · /docs/graph-api/changelog
- TikTok: developers.tiktok.com/doc/content-posting-api-get-started · /content-posting-api-reference-direct-post · /content-posting-api-reference-upload-video · /content-posting-api-reference-get-video-status · /content-posting-api-reference-query-creator-info · /content-posting-api-reference-photo-post · /content-posting-api-media-transfer-guide · /content-sharing-guidelines
