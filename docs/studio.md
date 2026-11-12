# Office Comedy Studio (website local)

Ứng dụng web chạy trên máy này, dùng để quản lý sản xuất và phát hành từng tập bằng giao diện tiếng Việt. Bản đầu ghi ngày 2026-11-11.

## Chạy

| Cách | Lệnh |
|---|---|
| Nhấp đúp | `Studio.cmd` ở thư mục gốc dự án. Build giao diện, chạy máy chủ, tự mở trình duyệt |
| PowerShell | `npm run studio` (build + chạy) · `npm run studio:serve` (chỉ chạy, khi đã build) · `npm run studio:build` |

- Địa chỉ: **http://127.0.0.1:5178**. Đổi cổng: `$env:STUDIO_PORT=5180; npm run studio`.
- Chỉ nghe trên `127.0.0.1`, nên máy khác trong mạng LAN không vào được. Dừng bằng Ctrl+C trong cửa sổ đang chạy.
- Cần **Node 22.18 trở lên** (khuyên dùng Node 24): máy chủ chạy thẳng file TypeScript bằng tính năng type stripping có sẵn của Node. `studio/start.mjs` kiểm phiên bản trước khi nạp file `.ts`; Node cũ sẽ nhận thông báo rõ ràng thay vì lỗi cú pháp.
- Cần chạy `npm install` **một lần** trước đó. Launcher không tự cài dependency. `esbuild` (dùng để build giao diện) được khai báo trực tiếp trong `devDependencies`, không dựa vào bản đi kèm Remotion.
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
- Bố cục 1366×768 và 1920×1080 đã kiểm bằng giả lập kích thước khung nhìn trong trình duyệt tích hợp. Video dọc được giới hạn chiều cao theo màn hình để thấy thanh điều khiển.
- Nhấp đúp `Studio.cmd` bằng tay. Mình đã chạy launcher qua `cmd /c Studio.cmd`: kiểm Node, build, máy chủ lên và trả `/api/health`. Bước mở trình duyệt thì chưa quan sát được (lúc thử, stdin bị chuyển hướng). Bạn tự thử: nhấp đúp `Studio.cmd` → cửa sổ đen hiện "Office Comedy Studio đang chạy" → trình duyệt mở http://127.0.0.1:5178 sau khoảng 2 giây.

## Viết kịch bản bằng Claude (thêm ngày 2026-11-12)

### Cách dùng

1. **Thiết lập một lần trên máy:**
   - Tạo file `.env` ở thư mục dự án (sao từ `.env.example` nếu chưa có).
   - Điền `ANTHROPIC_API_KEY=` bằng khóa lấy từ Claude Console, rồi khởi động lại Studio.
   - Không dán khóa vào chat hay vào giao diện.
   - Gọi API tính phí theo tài khoản Claude Console. Chi phí này **tách với** gói thuê bao Claude Code.
2. **Tạo tập** (menu "Tạo tập mới"):
   - Nhập ý tưởng, hoặc bấm "Claude đề xuất 3 ý tưởng". Mỗi ý tưởng gồm tiêu đề, tiền đề, mâu thuẫn và hướng câu chốt. Chỉ xem ý tưởng thì **chưa cấp mã EP**.
   - Chọn nhân vật, bối cảnh, ghi chú, thời lượng (mặc định tối thiểu 60 s, mục tiêu 60–90 s).
   - Bấm "Tạo tập" rồi xác nhận. Máy chủ cấp mã EP mới, lưu `script/request.json` và xếp một lượt Claude viết bản nháp.
3. **Tab "Kịch bản" của tập:**
   - Xem trạng thái công việc AI: thời gian đã chạy, huỷ, thử lại, số token và chi phí ước tính.
   - Xem bản hiện hành cùng kết quả kiểm tra tự động.
   - Các thao tác: sửa thủ công, yêu cầu Claude sửa (toàn bộ hoặc chỉ các cảnh chọn), xem khác biệt, chấp nhận hoặc bỏ đề xuất, xem và phục hồi phiên bản, duyệt.

### Kiến trúc và nguồn dữ liệu

| Phần | File | Vai trò |
|---|---|---|
| Adapter Claude | `tools/ai/claude.ts` | SDK chính thức `@anthropic-ai/sdk` 1.8.0. Một lời gọi Messages API, đầu ra JSON theo schema (`output_config.format`), `fallbacks: "default"` cho trường hợp từ chối. **Không có tool, shell hay quyền đọc ghi file** |
| Hợp đồng chung | `tools/ai/provider.ts` | Interface `AiProvider`, các loại lỗi. Nghiệp vụ không phụ thuộc nhà cung cấp |
| Mock | `tools/ai/mock.ts` | **Chỉ để kiểm thử**: cần cả `STUDIO_TEST=1` và `STUDIO_AI_MOCK=<file>`. Kết quả mang nhãn `[MOCK]`; giao diện hiện cảnh báo "Chế độ kiểm thử" |
| Cấu hình | `config/studio.json` | Model (mặc định `claude-opus-5-5`, chỉ được chọn trong danh sách đã khai báo), effort, `maxTokens`, `timeoutMs`, số lần thử, số việc AI chạy cùng lúc, bảng giá để ước tính |
| Prompt | `tools/ai/prompts.ts` | Quy tắc lấy từ `config/casting.json` và CLAUDE.md. Các tập trước chỉ đưa tiêu đề và tóm tắt, không nạp media hay cả repo |
| Schema, chuyển đổi, kiểm tra, diff | `tools/episode/scriptdoc.ts` | Đầu ra AI được chuyển về đúng định dạng `script.json` của EP001 |
| Phiên bản, đề xuất | `tools/episode/scriptstore.ts` | Xem cấu trúc thư mục bên dưới |
| Lint | `tools/tts/scriptlint.ts` | Hàm dùng chung cho `npm run script:lint` và máy chủ, không gọi tiến trình con |
| Công việc AI | `studio/server/aijobs.ts`, `tasks.ts` | Hàng đợi, huỷ, thử lại, gián đoạn, sổ token |

Thư mục kịch bản của mỗi tập (đều đưa vào Git, trừ `rejected/`):

```
script/script.json            bản hiện hành (công cụ TTS/render/duyệt đọc file này)
script/request.json           yêu cầu ban đầu
script/versions/v0001.json…   mọi phiên bản (nguồn: bạn sửa / Claude / phục hồi / bản có sẵn); không bao giờ xoá
script/proposals/<id>.json    bản đề xuất của Claude, không tự áp dụng
script/rejected/…             đầu ra không qua kiểm tra, chỉ để chẩn đoán (không đưa vào Git)
```

Sổ token `runtime/studio/ai-usage.jsonl` và lịch sử công việc `runtime/studio/tasks.json` chỉ là dữ liệu vận hành, không chứa prompt hay khóa.

### Quy tắc đã cài đặt

- **Không bao giờ gọi Claude khi chỉ mở trang, xem hay duyệt.** Chỉ các nút đề xuất ý tưởng, tạo tập, viết nháp, yêu cầu sửa và thử lại mới gọi.
- **Cấp mã tập:**
  - Dùng bộ cấp mã hiện có (`tools/episode/create.ts`, khoá `mkdir`), đây cũng là code `npm run episode:new` dùng.
  - Bấm tạo nhiều lần với cùng `requestToken` thì trả lại đúng tập đã tạo (máy chủ chặn, không chỉ khoá nút).
  - AI lỗi thì tập vẫn giữ để thử lại. Không xoá tập, không tái dùng mã.
- **Kiểm tra phía máy chủ:**
  - Gồm cấu trúc, ID cảnh và lượt (duy nhất, đúng dạng), bối cảnh, biểu cảm và tư thế có trong rig, nhân vật thuộc dàn đã chọn, rồi lint theo quy tắc ngôn ngữ.
  - **Lỗi chặn** (không lưu): sai cấu trúc, ID trùng, xưng hô sai với Sếp, từ miền Nam trong lời Sếp, câu quá 58 ký tự, quá 2 người nói trong một cảnh.
  - **Lưu ý** (vẫn lưu): ước tính dưới 60 s, câu có "anh" trong cảnh có Sếp…
  - Đạt kiểm tra **không** có nghĩa là nội dung đã hay.
- **Tự sửa có giới hạn:** sai thì nhờ Claude sửa tối đa `maxRepairAttempts` lần (mặc định 1). Vẫn sai thì lưu vào `rejected/` và báo lỗi, kịch bản hiện hành không đổi.
- **Phiên bản và đề xuất:**
  - Bản Claude sửa luôn là **đề xuất**. Nguồn được ghi lại trước khi gọi; nếu nguồn đổi trong lúc Claude chạy thì đề xuất bị đánh dấu "xung đột" và không áp dụng được.
  - Sửa theo cảnh: máy chủ chỉ lấy các cảnh đã chọn từ kết quả, các cảnh khác giữ nguyên.
  - Mọi lần ghi bản hiện hành đều kiểm hash bản bạn đang xem (409 nếu đã đổi).
  - Phục hồi tạo phiên bản mới. Mỗi phiên bản ghi nguồn (bạn / Claude / phục hồi).
- **Duyệt:**
  - Dùng đúng cơ chế cũ: hash nội dung kịch bản kèm `viewToken`.
  - Đổi kịch bản thì duyệt kịch bản thành "cần duyệt lại", các sản phẩm phụ thuộc (âm thanh, video, phụ đề, social) thành "cần kiểm tra lại".
  - Không bao giờ tự duyệt. Chấp nhận đề xuất không phải là duyệt.
- **Công việc AI:**
  - Mặc định 1 việc chạy cùng lúc, các việc khác chờ lượt. Mỗi tập chỉ có 1 việc AI sửa kịch bản (409 nếu tạo thêm).
  - Đóng tab công việc vẫn chạy. Huỷ thì kết quả về muộn bị bỏ.
  - Máy chủ khởi động lại thì việc đang chạy thành "Bị gián đoạn" và **không tự gọi lại**.
  - Không hiển thị phần trăm giả, không hiển thị suy luận nội bộ của model.
- **Thử lại và giới hạn:**
  - 429 và 529 được thử lại tự động tối đa `maxRateLimitRetries` lần (yêu cầu chưa được xử lý).
  - Timeout hoặc lỗi mạng **không** tự thử lại, vì không biết yêu cầu đã được xử lý và tính phí chưa. Giao diện ghi rõ điều này.
  - Có giới hạn thời gian chờ (`timeoutMs`) và độ dài đầu ra (`maxTokens`).
- **Chi phí:**
  - Số token lấy từ API.
  - Chi phí luôn ghi là **ước tính** theo bảng giá trong `config/studio.json`. Thiếu số token hoặc thiếu giá thì ghi "không xác định", không ghi 0.
  - Hoá đơn thật xem ở Claude Console.

### Kiểm tra (2026-11-12)

- **Bằng mock, trên bản sao dự án:** 47/47 kiểm tra đạt.
  - Đề xuất ý tưởng không cấp mã, bấm lặp ra 1 việc.
  - Tạo tập 2 lần cùng token ra 1 mã.
  - Các lỗi rate limit, timeout, mạng, xác thực đều báo rõ, không đổi kịch bản; thử lại giữ nguyên mã.
  - Đầu ra sai cấu trúc 2 lần thì thất bại sau 1 lần sửa và được lưu để chẩn đoán. Vi phạm quy tắc giọng thì Claude sửa 1 lần rồi đạt.
  - Sửa theo cảnh chỉ đổi đúng cảnh đó. Chấp nhận tạo phiên bản mới.
  - Duyệt, rồi sửa tay, thì kịch bản thành "cần duyệt lại". Sửa tay vi phạm quy tắc trả 422; sửa trên bản cũ trả 409.
  - Hai việc AI cùng sửa một tập trả 409. Nguồn đổi trong lúc AI chạy thì đề xuất là "xung đột" và không áp dụng được.
  - Huỷ thì kết quả về muộn bị bỏ.
  - Mặc định 1 việc AI cùng lúc, việc sau chờ lượt.
  - Khởi động lại: việc đang chạy thành "Bị gián đoạn", không tự gọi lại.
  - Phục hồi tạo phiên bản mới.
  - Mở, xem, duyệt không gọi model. EP001 không đổi.
  - Thiếu khóa thì báo "Chưa cấu hình Claude".
- **Gọi API thật với khóa giả:** API trả 401, Studio báo "Khóa API bị từ chối" và không lưu khóa ở đâu (tasks, sổ token, API cấu hình).
- **Trên giao diện (trình duyệt, chế độ mock):** tạo tập → bản nháp v1 → yêu cầu sửa cảnh S2 → xem khác biệt → chấp nhận (v2) → duyệt.
- **Chưa kiểm tra:** chưa chạy lượt nào với **khóa thật và Claude thật** (trên máy chưa có khóa, chưa có ngân sách thử được xác nhận). Chất lượng kịch bản Claude viết thật chưa được đánh giá.

## Chưa triển khai (nút liên quan bị khoá và có ghi lý do)

- Tạo TTS, render video, tạo ảnh bìa từ giao diện. Hiện dùng các lệnh npm có sẵn.
- OAuth, kết nối tài khoản, upload, đặt lịch, đăng thật.
- Tạo hoặc đổi trạng thái job, đặt lịch trong dự án (vẫn có `npm run publish:plan`).

## Bước tiếp theo đề xuất

1. Chạy thử một lượt với khóa thật, trong ngân sách bạn đặt, rồi đọc và chỉnh prompt theo kết quả.
2. Nối TTS (`episode:audio`) và render vào cùng hệ công việc nền, chạy trong tiến trình con như delivery, với duyệt kịch bản là điều kiện bắt buộc.
