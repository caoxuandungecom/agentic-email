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
   - Content: `v=DMARC1; p=none; sp=none;`
2. Trở lại màn hình chính của tài khoản Cloudflare, vào mục **Workers & Pages**.
3. Chọn ứng dụng Worker có tên là `agentic-inbox`.
4. Chuyển sang tab **Settings** (Cài đặt) > **Bindings**.
5. Tìm đến mục Binding có tên là **Send Email** (Gửi Email).
6. Ở mục cấu hình binding này, bạn cần phải nhập thêm Tên miền mới của bạn vào ô **Allowed Senders** (Người gửi được phép).
7. Bấm **Save and Deploy** (Lưu và Triển khai) để Worker nhận quyền mới.

> [!IMPORTANT]
> Bước cấu hình **Allowed Senders** ở trên là BẮT BUỘC. Nếu bạn quên bước này, Worker sẽ báo lỗi "Permission denied" mỗi khi bạn cố bấm nút Gửi (Send) trong giao diện Hòm thư.

---

## 3. Cập nhật Biến môi trường (Tùy chọn)
Trong mã nguồn của bạn có định nghĩa biến `DOMAINS` và `EMAIL_ADDRESSES` để phục vụ cho các logic nhận diện nội bộ của Worker.
- Đừng quên vào Cloudflare Dashboard > `agentic-inbox` > **Settings** > **Variables and Secrets** để bổ sung tên miền mới của bạn vào biến môi trường này nếu cần.

🎉 **Hoàn tất! Hệ thống của bạn đã sẵn sàng nhận và gửi email bằng tên miền mới!**
