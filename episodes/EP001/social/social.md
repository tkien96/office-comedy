# EP001: nội dung social (bản đọc để duyệt)

Tạo từ `social/social.json` bằng `npm run episode:social -- EP001`. Đừng sửa file này; sửa `social.json` rồi chạy lại lệnh.
Mỗi bài duyệt riêng, gắn với hash nội dung của bài đó: `npm run episode:approve -- EP001 social.<nền tảng>.<bài>` (ví dụ `social.youtube.video`). Trạng thái duyệt xem bằng `npm run episode:status -- EP001`.

## Giữ bí mật

- Câu chốt (không đưa vào bài): Công cụ tiết kiệm ba tiếng, nhưng giải thích nó tốn bảy tiếng (bảy buổi họp); Trinh còn dùng chính công cụ đó làm biên bản họp.
- Không nhắc: chuỗi buổi họp và con số bảy; cả cuối tuần viết báo cáo; Trinh dùng công cụ làm biên bản; câu 'báo cáo về việc không phải làm báo cáo'.
- Được dùng: Kiên làm công cụ tiết kiệm ba tiếng mỗi tuần, Trinh nhờ làm giùm, Sếp nghe tin và rất mê số liệu. Câu móc 3 giây đầu ('sai lầm lớn nhất đời tôi') đã có ngay đầu video.
- Danh sách từ khóa chỉ là lưới lọc thô, KHÔNG chứng minh bài không spoil. Người duyệt cần đọc lại từng bài.

## YouTube

### Video · `youtube.video`

- Cách đăng: **API (sau khi tích hợp)** · loại: short
- Media: ảnh bìa `thumbnails/thumb-9x16.png` · phụ đề `exports/EP001.srt`
- Giới hạn: Tiêu đề ≤ 100 ký tự (nên ≤ 60 để không bị cắt); mô tả ≤ 5000; > 15 hashtag thì YouTube bỏ qua toàn bộ.
- Hash nội dung: `1cde614eb4c1a496`

**Tiêu đề**

```text
Tiết kiệm 3 tiếng mỗi tuần, rồi sếp biết 😶 | Hài công sở
```

**Mô tả (bản dán)**

```text
Kiên viết được công cụ tự làm báo cáo: bấm một cái là xong, mỗi tuần đỡ ba tiếng. Trinh xin làm giùm luôn. Rồi sếp nghe tin… mà sếp thì rất mê số liệu.

Bạn đã bao giờ làm việc nhanh hơn rồi được “thưởng” thêm việc chưa?

Phim hoạt hình hài công sở, lồng tiếng Việt.

#haicongso #congso #hoathinh #Shorts
```

### Bài nhá hàng (tùy chọn) · `youtube.teaser`

- Cách đăng: **thủ công** · loại: community_text
- Media: ảnh `thumbnails/teaser-1x1.png`
- Ghi chú: Tùy chọn. YouTube Data API không có endpoint đăng bài cộng đồng; nếu dùng thì đăng tay trong YouTube Studio. Không tạo job API.
- Giới hạn: Bài cộng đồng, đăng tay.
- Hash nội dung: `95bd074ad58dd8bb`

**Nội dung (bản dán)**

```text
Có ai từng làm việc nhanh hơn… rồi được giao thêm việc không? 🙋
Tập mới của Kiên kể đúng chuyện đó.
```

## Facebook Page

### Video · `facebook.video`

- Cách đăng: **API (sau khi tích hợp)** · loại: reel
- Media: ảnh bìa `thumbnails/thumb-9x16.png` · phụ đề `exports/EP001.srt`
- Giới hạn: Mô tả Reel: không có giới hạn ngắn; dòng đầu hiển thị khoảng 125 ký tự trước “Xem thêm”.
- Hash nội dung: `530765717d224a1a`

**Nội dung (bản dán)**

```text
Bấm một cái là báo cáo xong. Kiên tưởng mình vừa thắng lớn ở công ty… 😌

Tag ngay đồng nghiệp hay “làm giùm” cả phòng 👇

#haicongso #congso #vanphong #hoathinh
```

### Bài nhá hàng · `facebook.teaser`

- Cách đăng: **API (sau khi tích hợp)** · loại: photo
- Media: ảnh `thumbnails/teaser-1x1.png`
- Giới hạn: Bài ảnh trên Page.
- Hash nội dung: `5cddcad946f4189c`

**Nội dung (bản dán)**

```text
Kiên vừa làm được công cụ tiết kiệm ba tiếng mỗi tuần.
Sếp thì đang đứng ngay sau lưng. 👀

Bạn đoán chuyện gì xảy ra tiếp theo?

#haicongso #congso
```

## TikTok

### Video · `tiktok.video`

- Cách đăng: **thủ công** · loại: video
- Media: ảnh bìa `thumbnails/thumb-9x16.png`
- Khung bìa gợi ý: 16.5 s
- Ghi chú: Đăng thủ công trong app TikTok (API không hẹn giờ; client chưa audit chỉ đăng riêng tư). Ảnh bìa: chọn khung hình gợi ý ở coverTimestampMs, hoặc tải ảnh bìa lên nếu app cho phép (xem delivery/tiktok.md).
- Giới hạn: Caption TikTok ≤ 2200 ký tự (gồm hashtag).
- Hash nội dung: `e5a4d4bda011d9e9`

**Nội dung (bản dán)**

```text
Tiết kiệm được 3 tiếng mỗi tuần. Rồi sếp biết 😶

#haicongso #congso #vanphong #hoathinh
```

### Bài nhá hàng · `tiktok.teaser`

- Cách đăng: **thủ công** · loại: photo
- Media: ảnh `thumbnails/teaser-1x1.png`
- Giới hạn: Bài ảnh TikTok, đăng tay.
- Hash nội dung: `0f1efa550cc33bbb`

**Nội dung (bản dán)**

```text
Ba tiếng mỗi tuần. Đổi lại cái gì? 👀

#haicongso #congso
```
