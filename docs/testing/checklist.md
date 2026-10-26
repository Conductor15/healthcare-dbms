# Checklist kiểm thử E2E (S4.1)

Dùng ở S4.2: **test chéo** (Dương test FR của Hoàng và ngược lại). Mỗi dòng: làm theo cột *Thao tác*, so với *Kỳ vọng*, ghi ✅/❌ + người test + ngày. Lỗi → mở Issue template *Bug*.

Chuẩn bị: `npm run db:init` → `npm run dev` → đăng nhập theo cột *Vai trò* (`admin/admin123`, `reception/reception123`, `doctor1/doctor123`).
Tự động: `npm run test:e2e -w server` (14 test API của FR3/4/6/9, access log, DB Lab).

## 1. Theo chức năng

| # | FR | Vai trò | Thao tác | Kỳ vọng | Query type | Kết quả | Người test |
|---|---|---|---|---|---|---|---|
| 1 | FR1 | reception | Thêm bệnh nhân đủ thông tin | Xuất hiện trong danh sách | a | | |
| 2 | FR1 | reception | Thêm bệnh nhân thiếu tên / ngày sinh tương lai | Báo lỗi ngay trên form, không gửi | — | | |
| 3 | FR1 | reception | Sửa SĐT bệnh nhân | Cập nhật, thông báo thành công | c | | |
| 4 | FR1 | admin | Xoá bệnh nhân **đã có lượt khám** | Báo không xoá được (409), dữ liệu còn nguyên | b | | |
| 5 | FR1 | all | Tìm theo tên "Hoa" | Chỉ các bệnh nhân có "Hoa" | d | | |
| 6 | FR2 | admin | Thêm / sửa / ngừng hoạt động bác sĩ | Bác sĩ ngừng hoạt động không còn trong ô chọn đặt lịch | a, c | | |
| 7 | FR2 | admin | Xoá khoa đang có bác sĩ | 409 "Không thể xoá khoa đang có bác sĩ" | b | | |
| 8 | FR3 | reception | Đặt lịch: chọn bệnh nhân → bác sĩ → ngày → giờ trống | Lịch mới trạng thái *Chờ khám*, giờ đó bị khoá trong lưới | a | | |
| 9 | FR3 | reception | 2 cửa sổ trình duyệt cùng đặt **một** giờ, bấm gần như cùng lúc | Chỉ 1 thành công, cửa sổ kia báo "vừa có người đặt" và lưới tự cập nhật | a + concurrency | | |
| 10 | FR3 | reception | Đặt cho cùng bệnh nhân 2 bác sĩ cùng giờ | Lần 2 báo trùng giờ | e | | |
| 11 | FR3 | reception | Huỷ lịch | Trạng thái *Đã huỷ*, giờ mở lại | c | | |
| 12 | FR3 | admin | Xoá lịch *Chờ khám* / lịch *Đã huỷ* | Lịch chờ khám: không có nút xoá (API 409); lịch đã huỷ: xoá được | b | | |
| 13 | FR3 | doctor1 | Mở Lịch hẹn | Chỉ thấy lịch của mình, không có nút Đặt lịch | e | | |
| 14 | FR4 | doctor1 | Lịch hẹn → *Khám* → nhập chẩn đoán, kê 2 thuốc → Lưu | Lượt khám mới; hoá đơn = phí khám + tiền thuốc; lịch → *Đã khám*; tồn kho giảm | a, c (transaction) | | |
| 15 | FR4 | doctor1 | Kê Salbutamol số lượng > tồn kho (sửa ô SL bằng tay) | 409 nêu tên thuốc, **không** lưu gì (tồn kho thuốc khác không đổi) | atomicity | | |
| 16 | FR4 | reception | Chi tiết lượt khám → Thanh toán | Hoá đơn *Đã thanh toán*, nút biến mất | c | | |
| 17 | FR5 | all | Tìm bệnh nhân: giới tính + nhóm máu + khoảng tuổi + khoa đã khám | Kết quả thoả **tất cả** điều kiện | e | | |
| 18 | FR6 | all | Mở chi tiết lượt khám | Đủ: bệnh nhân, bác sĩ, khoa, lịch hẹn, đơn thuốc, hoá đơn | f | | |
| 19 | FR7 | admin | Dashboard thống kê | Biểu đồ lượt khám/doanh thu theo tháng, theo khoa | h | | |
| 20 | FR8 | admin | Truy vấn nâng cao: bệnh nhân khám nhiều hơn trung bình | Danh sách đúng (đối chiếu bằng SQL tay) | g | | |
| 21 | FR9 | doctor1 | Sinh hiệu: bật giả lập cho 3 bệnh nhân, chọn 1 bệnh nhân | Badge *Đang nhận trực tiếp*, biểu đồ chạy, chỉ số bất thường tô đỏ, bảng cảnh báo có dòng mới | a, d (Cassandra) | | |
| 22 | FR9 | doctor1 | Nhập chỉ số tay SpO₂ 85 | Thông báo cảnh báo, xuất hiện trong bảng cảnh báo | a | | |
| 23 | Log | admin | Nhật ký truy cập → chọn user doctor1, hôm nay | Thấy các request vừa làm ở dòng 13–22; không có token trong đường dẫn | d (Cassandra) | | |
| 24 | Auth | — | Đăng nhập sai mật khẩu; truy cập /db-lab bằng doctor1 | Báo sai mật khẩu; menu DB Lab không hiện, API 403 | — | | |

## 2. Ma trận 8 loại query-update (đề bài)

| Loại | Dòng checklist | Endpoint chính | Đạt |
|---|---|---|---|
| a. Insert | 1, 8, 14, 21 | `POST /patients`, `/appointments`, `/visits`, `/vitals` | |
| b. Delete | 4, 7, 12 | `DELETE /patients/:id`, `/departments/:id`, `/appointments/:id` | |
| c. Update | 3, 11, 14, 16 | `PUT /patients/:id`, `PATCH /appointments/:id/cancel`, `/invoices/:id/pay` | |
| d. Query 1 điều kiện | 5, 23 | `GET /patients?name=` | |
| e. Query đa điều kiện | 10, 13, 17 | `GET /patients/search`, `/appointments?date&doctorId&status` | |
| f. Join | 18 | `GET /visits/:id` (10 bảng) | |
| g. Subquery | 20 | `GET /insights/frequent-patients` | |
| h. Aggregate | 19 | `GET /stats/visits-by-month` | |

## 3. UX (tiêu chí "GUI user-friendly, best practices")

| Kiểm tra | Trang | Đạt |
|---|---|---|
| Mọi danh sách có loading, thông báo khi rỗng, phân trang | tất cả | |
| Thao tác xoá/huỷ có hộp xác nhận | Khoa, Bệnh nhân, Bác sĩ, Lịch hẹn | |
| Lỗi từ server hiện bằng tiếng Việt, dễ hiểu | tất cả | |
| Form validate trước khi gửi | tất cả form | |
| Màn hình 1366×768 không vỡ bố cục; thu gọn được menu | tất cả | |
| Vai trò nào chỉ thấy chức năng của vai trò đó | menu, nút | |
