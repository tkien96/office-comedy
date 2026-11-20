# Kết nối mạng xã hội (Office Comedy Studio)

Thêm ngày 2026-11-12. Trang: **Studio → Cấu hình → Kết nối mạng xã hội** (`http://127.0.0.1:5178/#/cau-hinh/ket-noi`).

Bản này chỉ **xác minh tài khoản**. Chưa upload, đặt lịch, đăng bài hay sửa gì trên nền tảng.

## Tóm tắt

| Nền tảng | Cách kết nối | Studio xác minh được | Chưa xác minh / chưa có |
|---|---|---|---|
| YouTube | OAuth Google (client loại **Desktop app**, PKCE S256, chuyển hướng về `http://127.0.0.1:5178/`), quyền `youtube.readonly` | Tên, ảnh, Channel ID của kênh đã cấp quyền | Quyền upload (chưa xin), upload/hẹn giờ (chưa có code) |
| Facebook | Nhập Page ID + Page Access Token, "Lưu và kiểm tra" | Token đọc được Page nào (tên, ID, ảnh), có đúng Page ID đã nhập không | **Quyền đăng**: kiểm tra chính thức (`debug_token`) cần App token của ứng dụng Meta, Studio chưa có |
| TikTok | Nhập username hoặc URL hồ sơ | Không xác minh (không gọi API, không mở URL) | Đăng qua API (không dùng; đăng thủ công) |

## Trạng thái hiển thị

| Trạng thái | Nghĩa |
|---|---|
| Chưa cấu hình | Không có kết nối Studio, không có (hoặc đã tắt) biến môi trường |
| Đã lưu, chưa kiểm tra | Có thông tin đăng nhập nhưng chưa kiểm tra với cấu hình hiện tại |
| Đã xác minh | Lần kiểm tra gần nhất chứng minh được tài khoản. **Không** có nghĩa là có quyền đăng |
| Cần kết nối lại | Token bị từ chối (hết hạn, thu hồi, invalid_grant…), sai tài khoản/Page, không có kênh |
| Thiếu quyền | Đọc được token nhưng thiếu quyền cho thao tác đọc |
| Không kiểm tra được | Lỗi mạng, hết thời gian chờ, nền tảng lỗi tạm thời hoặc giới hạn tốc độ. **Không** kết luận token hết hạn; giữ danh tính lần trước |
| Đăng thủ công | TikTok đã lưu tài khoản |

Mở trang không gọi nền tảng. Studio chỉ gọi khi bạn bấm **Kiểm tra kết nối**, **Lưu và kiểm tra**, hoặc khi hoàn tất đăng nhập Google.

## Thao tác qua Studio

### YouTube: thiết lập lần đầu

Việc phải làm trên **Google Cloud Console** (Studio không làm thay):

1. Tạo hoặc chọn một project.
2. APIs & Services → Library → bật **YouTube Data API v3**.
3. Google Auth Platform (OAuth consent screen):
   - đối tượng **External**, điền tên ứng dụng và email;
   - ở chế độ **Testing**: thêm tài khoản Google của bạn vào **Test users**. Refresh token của app ở chế độ Testing **hết hạn sau 7 ngày**; khi đó Studio báo "Cần kết nối lại". Muốn lâu dài thì chuyển app sang In production; app chưa xác minh sẽ hiện cảnh báo của Google, bạn là chủ app nên có thể bấm tiếp.
4. Clients → Create client → loại **Desktop app** → Create → **Download JSON**.

Trong Studio:

1. Thẻ YouTube → "Thiết lập ứng dụng Google" → chọn file JSON vừa tải (hoặc nhập Client ID + Client secret).
   - Studio chỉ đọc `client_id`, `client_secret`, `project_id`. Không giữ file JSON. Bỏ qua `auth_uri`/`token_uri` trong file: Studio luôn gọi endpoint chính thức cố định.
   - Từ chối client loại Web application.
2. **Redirect URI:** client Desktop app **không cần đăng ký redirect URI**. Studio dùng `http://127.0.0.1:5178/` (đúng cổng Studio đang chạy). Hãy mở Studio bằng `http://127.0.0.1:5178` (không phải `localhost`) khi bấm kết nối.
3. Bấm **Kết nối YouTube** → đăng nhập Google, chọn đúng tài khoản/kênh, cấp quyền.
4. Google đưa bạn về Studio. Studio hiện **tên, ảnh, Channel ID** của kênh vừa cấp quyền. Bấm **Dùng kênh này** để dùng, hoặc **Huỷ** (kết nối cũ giữ nguyên).
   - Nếu `channelId` trong `config/publishing.json` khác kênh này, Studio báo lệch và bắt đánh dấu xác nhận.

### YouTube: kết nối lại / đổi kênh

- Bấm **Kết nối lại / đổi kênh** và làm như bước 3–4.
- **Cùng kênh, cùng OAuth client:** chỉ thay token, giữ ID kết nối; job đã gắn không đổi.
- **Kênh khác:** tạo kết nối mới. Kết nối cũ chuyển sang "đã gỡ". Job đã gắn kênh cũ **không tự chuyển**: dry-run chặn tới khi bạn gắn lại.
- Google không trả refresh token: Studio chỉ giữ token cũ khi cùng kênh **và** cùng OAuth client. Nếu không, Studio từ chối và hướng dẫn gỡ quyền app tại myaccount.google.com/permissions rồi kết nối lại.
- Đổi OAuth client: kết nối đang có vẫn dùng đúng client đã cấp token (không ghép client mới với token cũ). Studio ghi chú "kết nối lại để dùng client mới". Đổi Client ID mà không nhập secret thì secret cũ bị bỏ (không mang sang client khác).

### Facebook

1. Thẻ Facebook → **Nhập Page ID và token** (hoặc **Thay thế thông tin**).
2. Điền Page ID (dãy số) và Page Access Token. Ô token luôn trống khi mở; **để trống = giữ token đã lưu**.
3. **Lưu và kiểm tra**: Studio gọi `GET https://graph.facebook.com/v27.0/me` (token ở header `Authorization`, không ở URL).
   - Đúng Page → thay kết nối (cùng Page: giữ ID kết nối; Page khác: kết nối mới, job cũ không tự chuyển).
   - Sai/hết hạn/thiếu quyền/lỗi mạng/giới hạn API/sai Page/token người dùng thay vì Page → **kết nối cũ giữ nguyên**, bản mới giữ riêng ở "Cấu hình mới chưa xác minh". Có **Kiểm tra lại cấu hình mới** và **Bỏ cấu hình mới**.

Việc phải làm trên **Meta**: có ứng dụng Meta (loại Business) bạn là admin/developer, có vai trò quản lý Page; lấy User token có `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, rồi lấy Page token qua `/me/accounts`. Page token có thể mất hiệu lực (đổi mật khẩu, mất vai trò, gỡ app, hết hạn). Studio không hứa token tồn tại vĩnh viễn.

### TikTok

Nhập `@ten`, `ten` hoặc `https://www.tiktok.com/@ten` → **Lưu**. Studio chuẩn hoá thành username + URL hồ sơ, chỉ nhận `tiktok.com` / `www.tiktok.com` / `m.tiktok.com` (không nhận link rút gọn vì không tự mở link). Hiển thị "Đã lưu tài khoản — Đăng thủ công" và ghi rõ chưa xác minh bằng API. Tài khoản này được ghi vào `tiktok.md` trong bộ delivery.

### Gỡ khỏi Studio và thu hồi quyền

- **Gỡ khỏi Studio:** xoá bí mật trên máy và ngắt liên kết. **Không** thu hồi trên nền tảng. Lịch sử job và đường dẫn bài đã đăng giữ nguyên; job gắn kết nối đó bị dry-run chặn với lý do.
- **Thu hồi quyền trên Google** (chỉ YouTube, nút riêng, có xác nhận): gửi `POST https://oauth2.googleapis.com/revoke` (token trong body) rồi gỡ khỏi Studio. Theo Google, thu hồi xoá **mọi quyền đã cấp cho project** đó.
- Facebook: Studio không thu hồi từ xa. Tự gỡ ứng dụng trong cài đặt Facebook (Ứng dụng và trang web) hoặc Meta Business Suite.

## Gắn job với tài khoản

- Mỗi job API có `account` trong `publishing/jobs.json`: `{ connectionId, platformAccountId, name, boundAt }`.
- Chỉ bạn gắn, ở tab **Phát hành** của tập (nút "Gắn với …"). Job cũ chưa gắn thì dry-run chặn; Studio không tự gán.
- Đổi sang tài khoản khác phải xác nhận rõ. Job đã có remote ID hoặc đang uploading/processing/scheduled/published thì không đổi được.
- Dry-run chặn khi: chưa gắn, tài khoản gắn khác tài khoản đang kết nối, kết nối đã gắn bị gỡ, tài khoản đích chưa xác minh, thiếu quyền upload/đăng (YouTube chưa có `youtube.upload`, Facebook chưa xác minh quyền đăng).

## Lưu trữ: metadata và bí mật tách riêng

| | File | Nội dung |
|---|---|---|
| A. Metadata | `runtime/connections/connections.json` | ID kết nối, danh tính đã xác minh, kết quả và thời điểm kiểm tra, nguồn đang dùng, username TikTok, `rev` chống ghi đè giữa hai tab. Không có bí mật. |
| B. Bí mật | `runtime/connections/secrets.dpapi.json` | Client secret, refresh token, Page token, **mã hoá bằng Windows DPAPI** (phạm vi CurrentUser). Metadata chỉ giữ ID mục. |

- `runtime/` không đưa vào Git. API, giao diện, log, báo cáo, delivery/ZIP không chứa giá trị bí mật.
- DPAPI: chỉ đúng tài khoản Windows trên đúng máy giải mã được; không có file khoá nằm cạnh dữ liệu. Giới hạn: một chương trình chạy dưới chính tài khoản Windows của bạn vẫn giải mã được (DPAPI chống người dùng khác và chống chép file, không chống mã độc chạy dưới tên bạn).
- Kho không mở được (không phải Windows, PowerShell bị chặn, hồ sơ người dùng hỏng): mọi thao tác lưu báo lỗi rõ. **Không** lưu dạng văn bản thường thay thế.
- Lưu bí mật trước (mục mới), rồi mới trỏ metadata sang, rồi xoá mục cũ. Lỗi giữa chừng chỉ để lại mục mồ côi, được dọn khi Studio khởi động; kết nối cũ không hỏng.
- Ô bí mật trên giao diện luôn trống; để trống = giữ; không nhận chuỗi che như `****`. Bí mật không được gửi cho Claude hay model AI nào.

## Nguồn cấu hình có hiệu lực (Studio và CLI dùng chung `tools/publish/connections.ts`)

Theo từng tài khoản đích, **không trộn**:

1. Có kết nối Studio đang dùng → mọi thông tin đăng nhập lấy từ kho DPAPI (client ID/secret + refresh token là một bộ).
2. Không có kết nối Studio, đủ mọi biến tên trong `config/publishing.json → credentialEnv`, và chưa bị tắt → lấy toàn bộ từ môi trường (`.env`). Đây là cách cũ, vẫn chạy.
3. Còn lại → chưa cấu hình. Sau khi **Gỡ khỏi Studio**, nếu `.env` còn biến thì chúng bị **tắt** và Studio báo "Có cấu hình từ môi trường nhưng đang TẮT". Bật lại bằng nút **Dùng lại cấu hình môi trường**.

- **Nhập vào kho Studio:** sao chép bộ `.env` vào kho DPAPI ngay trên máy chủ (không gửi xuống trình duyệt), rồi bấm Kiểm tra kết nối. Studio không sửa hay xoá `.env`; sau khi nhập có thể tự xoá các dòng đó khỏi `.env` nếu muốn.
- Biến thường dùng: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `FACEBOOK_PAGE_ACCESS_TOKEN`. Facebook nhập từ `.env` cần Page ID (ô trên thẻ, hoặc `pageId` trong `config/publishing.json`).
- `config/publishing.json` vẫn là danh sách tài khoản đích; `channelId`/`pageId`/`username` ở đó là giá trị **mong đợi** để đối chiếu, không phải danh tính đã xác minh.
- CLI `npm run publish:dry-run -- EPxxx` dùng cùng service, thử mở kho bí mật (không in giá trị) và báo rõ nếu kho không mở được dưới tài khoản Windows hiện tại.

## Bảo vệ

- Studio chỉ nghe `127.0.0.1`; kiểm Host, Origin, header `X-Studio` cho mọi API thay đổi.
- Callback OAuth (`GET /?state=…&code=…`) là điều hướng từ Google nên không có Origin. Nó được bảo vệ bằng: `state` ngẫu nhiên 256 bit, dùng một lần (đánh dấu đã dùng trước khi đổi code), hết hạn 10 phút, gắn với cookie HttpOnly SameSite=Lax đặt lúc bấm Kết nối; PKCE S256. Phiên và kết nối chờ xác nhận chỉ nằm trong bộ nhớ (khởi động lại = kết nối lại).
- Endpoint cố định trong `tools/publish/platforms.ts` (Google OAuth, YouTube Data API v3, Graph API v27.0). Timeout 20 s, không tự thử lại; chống bấm lặp khi đang kiểm tra.
- Lỗi từ nền tảng được lọc bỏ mọi chuỗi giống token trước khi hiển thị; không hiển thị phản hồi thô.
- CSP cho phép ảnh đại diện từ `yt3.ggpht.com`, `yt3.googleusercontent.com`, `*.fbcdn.net`, `*.fbsbx.com`.

## Chuyển máy hoặc tài khoản Windows

- Bí mật DPAPI không giải mã được ở máy/tài khoản khác. Studio không xuất token dạng văn bản thường.
- Trên máy mới: tải lại file JSON OAuth client (hoặc dùng lại file đã tải), thiết lập trong Studio, bấm **Kết nối YouTube**; nhập lại Page ID + Page token; nhập lại username TikTok. Sau đó gắn lại job nếu ID kết nối đổi.
- Chép nguyên `runtime/connections/` sang máy mới: metadata đọc được nhưng bí mật không giải mã được; Kiểm tra kết nối/dry-run báo cần kết nối lại.

## Kiểm thử (2026-11-12)

- **Tự động, bản sao dự án + nền tảng giả lập + DPAPI thật:** 95/95 đạt. Gồm lưu/giữ/thay/xoá bí mật; API không trả bí mật; nguồn Studio và `.env` không trộn; gỡ không tự bật lại `.env`; OAuth state sai/hết hạn/phát lại/thiếu cookie/người dùng từ chối/thiếu quyền readonly; callback hợp lệ với Host/Origin hiện có; Google không trả refresh token; đổi OAuth client và đổi kênh; Facebook token sai/hết hạn/token người dùng/sai Page/thiếu quyền/giới hạn/lỗi mạng; TikTok không bị đánh dấu xác minh; hai tab (409); kết nối mới lỗi không phá kết nối cũ; đổi tài khoản không đổi đích job; token không có trong log/báo cáo/delivery/ZIP; khởi động lại vẫn đọc đúng; kho bí mật hỏng → báo lỗi, không lưu plaintext; CLI dry-run.
- **Trình duyệt (bản sao, Google giả lập):** bấm Kết nối YouTube → trang giả lập chuyển về → màn hình xác nhận kênh → Dùng kênh này → Đã xác minh. Thẻ Facebook ở trạng thái "Không kiểm tra được"; tab Phát hành hiện cột Tài khoản đích. Kiểm ở 1366×768 và 1920×1080.
- **Chưa kiểm với Google/Meta thật** (chưa có kết nối do bạn chủ động cấp quyền).
