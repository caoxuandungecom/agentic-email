# Hướng dẫn Thêm Tên miền Email Mới vào Agentic Email

Để hệ thống Agentic Email có thể nhận (Inbound) và gửi (Outbound) thư từ một tên miền mới hoàn toàn (ví dụ: `massagevip.net`), bạn cần thực hiện các bước cấu hình sau trên **Cloudflare Dashboard**. 

> [!WARNING]
> Nếu bạn bỏ qua một trong các bước này, email gửi đến sẽ không vào được Inbox hoặc email bạn gửi đi sẽ bị đánh dấu là Spam.

---

## 1. Cấu hình Inbound (Nhận Email vào Hòm thư)
Hệ thống sử dụng tính năng **Email Routing** của Cloudflare để "hứng" toàn bộ email gửi đến tên miền của bạn và đẩy vào Worker `agentic-inbox`.

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com) và chọn tên miền mới của bạn.
2. Điều hướng đến menu **Email** > **Email Routing**.
3. Nhấp vào nút **Get Started** để kích hoạt tính năng này.
4. Ở phần **Email DNS records**, hãy làm theo hướng dẫn để thêm các bản ghi (hệ thống sẽ tự động thêm nếu domain được quản lý bởi Cloudflare DNS). 
   - 3 bản ghi `MX` trỏ về Cloudflare.
   - 1 bản ghi `TXT` cho SPF: `v=spf1 include:_spf.mx.cloudflare.net ~all`.
   - Đảm bảo tất cả đều hiện trạng thái **Verified** (Đã xác minh).
5. Chuyển sang tab **Routing rules** (Quy tắc định tuyến).
6. Ở phần **Catch-all address**, bật trạng thái sang **ON** và chọn hành động là **Send to a Worker** (Gửi tới một Worker).
7. Chọn Worker có tên là `agentic-inbox` trong danh sách.

> [!TIP]
> Kể từ lúc này, bất kỳ ai gửi email đến `bui-ky-ten@ten-mien-cua-ban.com` đều sẽ được tự động hứng và đẩy vào cơ sở dữ liệu của Agentic Email.

---

## 2. Cấu hình Outbound (Cho phép Gửi Email đi)
Để Agentic Email có thể gửi thư dưới tư cách là tên miền của bạn mà không bị Google/Microsoft chặn Spam, bạn cần cấp quyền cho Worker và gắn thêm "con dấu" DMARC.

1. **Thêm bản ghi DMARC:** Tại menu **DNS** > **Records** của tên miền, thêm bản ghi mới:
   - Type: `TXT`
   - Name: `_dmarc`
   - Content: `v=DMARC1; p=quarantine;` *(sử dụng quarantine để chống mạo danh và tăng điểm uy tín)*
   
   *(Lưu ý: Đối với bản ghi SPF `v=spf1...`, nên dùng đuôi `-all` hoặc `~all`)*
2. Trở lại màn hình chính của tài khoản Cloudflare, vào mục **Workers & Pages**.
3. Chọn ứng dụng Worker có tên là `agentic-inbox`.
4. Chuyển sang tab **Settings** (Cài đặt) > **Bindings**.
5. Tìm đến mục Binding có tên là **Send Email** (Gửi Email).
6. Ở mục cấu hình binding này, bạn cần phải nhập thêm Tên miền mới của bạn vào ô **Allowed Senders** (Người gửi được phép).
7. Bấm **Save and Deploy** (Lưu và Triển khai) để Worker nhận quyền mới.

> [!IMPORTANT]
> Bước cấu hình **Allowed Senders** ở trên là BẮT BUỘC. Nếu bạn quên bước này, Worker sẽ báo lỗi "Permission denied" mỗi khi bạn cố bấm nút Gửi (Send) trong giao diện Hòm thư.

---

## 3. Cập nhật Biến môi trường

Trong mã nguồn của bạn có định nghĩa biến `DOMAINS` và `EMAIL_ADDRESSES` để phục vụ cho các logic nhận diện nội bộ của Worker. Bạn có 2 cách để cập nhật:

- **Cách 1 (Khuyên dùng):** Sửa trực tiếp trong file `wrangler.jsonc` trên mã nguồn, sau đó lưu lại và đẩy code lên GitHub. Hệ thống (GitHub Actions) sẽ tự động deploy và cập nhật biến này lên Cloudflare.
- **Cách 2:** Vào trực tiếp Cloudflare Dashboard > `agentic-inbox` > **Settings** > **Variables and Secrets** để bổ sung tên miền mới của bạn vào biến môi trường.

---

## 4. Kiểm tra Khả năng Gửi thư (Deliverability Test)
Sau khi hoàn tất cấu hình DNS, hãy dùng công cụ miễn phí **Mail-Tester** để kiểm tra xem email có bị đánh dấu Spam hay không.

1. Truy cập [mail-tester.com](https://www.mail-tester.com/).
2. Copy địa chỉ email tạm thời mà trang web cung cấp cho bạn (ví dụ: `test-xyz@srv1.mail-tester.com`).
3. Mở giao diện Agentic Email, soạn một email mới và gửi đến địa chỉ vừa copy.
4. Quay lại mail-tester.com và bấm **Then check your score** để xem kết quả.

| Điểm | Đánh giá |
|------|----------|
| **9-10/10** | ✅ Hoàn hảo — Email sẽ vào thẳng Inbox |
| **7-8/10** | ⚠️ Khá tốt — Có thể cần tinh chỉnh nhỏ |
| **Dưới 7** | ❌ Có vấn đề — Kiểm tra lại SPF/DKIM/DMARC |

> [!TIP]
> Hãy đảm bảo điểm số đạt ít nhất **9/10** trước khi gửi email thật đến khách hàng.

---

## 5. Khởi động Uy tín với Gmail (Gmail Warm-up)
Gmail rất khắt khe với tên miền mới chưa có lịch sử gửi thư. Ngay cả khi Mail-Tester cho **10/10**, Gmail vẫn có thể chặn email nếu tên miền quá mới. Hãy làm các bước sau để "phá băng":

1. **Đăng ký Google Postmaster Tools (Miễn phí):**
   - Truy cập [Google Postmaster Tools](https://postmaster.google.com/).
   - Thêm tên miền của bạn vào và xác minh quyền sở hữu (thêm 1 bản ghi TXT vào DNS).
   - Sau khi xác minh, Google sẽ "biết" tên miền của bạn và dần nới lỏng bộ lọc spam.

2. **Thêm vào Danh bạ Gmail:**
   - Mở [Google Contacts](https://contacts.google.com/), tạo một liên hệ mới với email là địa chỉ bạn dùng để gửi (ví dụ: `admin@ten-mien.com`).
   - Gmail tin tưởng email từ người nằm trong danh bạ hơn.

3. **Dùng chiến thuật Reply-first (Trả lời trước):**
   - Từ Gmail, gửi 1 email đến `@ten-mien.com` trước.
   - Sau đó dùng Agentic Email **Reply lại** email đó.
   - Gmail tin tưởng email Reply trong cuộc hội thoại có sẵn hơn rất nhiều so với email mới hoàn toàn.

4. **Gửi thử sang hòm thư khác trước:**
   - Thử gửi email sang Outlook/Yahoo/Hotmail trước để xác nhận hệ thống hoạt động bình thường.
   - Sau vài ngày gửi email hợp lệ, Gmail sẽ tự động nâng uy tín tên miền của bạn.

> [!IMPORTANT]
> Quá trình xây dựng uy tín tên miền mới với Gmail thường mất từ **vài ngày đến 1-2 tuần**. Hãy kiên nhẫn và tránh gửi email hàng loạt trong giai đoạn đầu.

---

🎉 **Hoàn tất! Hệ thống của bạn đã sẵn sàng nhận và gửi email bằng tên miền mới!**
