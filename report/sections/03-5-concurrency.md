# 3.5 Concurrency control

> Bản nháp (Hoàng, T5.6). Số liệu, script và output: `demos/05-concurrency/`. Thí nghiệm 1, 2, 4 chạy được trong ứng dụng (DB Lab → v. Concurrency).

## 3.5.1 Cơ sở lý thuyết

**SQL Server** mặc định dùng *pessimistic locking*: khoá chia sẻ (S), cập nhật (U), độc quyền (X) cùng khoá ý định (IS/IX/SIX) theo cây tài nguyên KEY → PAGE → OBJECT. Khi một câu lệnh giữ quá nhiều khoá (~5000) thì *leo thang* thành khoá cả bảng. Mức cô lập quyết định khoá S được giữ bao lâu: READ UNCOMMITTED (không lấy khoá S), READ COMMITTED (nhả sau mỗi dòng), REPEATABLE READ (giữ tới cuối transaction), SERIALIZABLE (giữ thêm khoá khoảng). Ngoài ra có hai mức dựa trên **MVCC** (version store trong tempdb): SNAPSHOT và READ COMMITTED SNAPSHOT. Deadlock được một tiến trình nền phát hiện, nó chọn một *victim* để huỷ (lỗi 1205).

**Cassandra** không dùng khoá. Mỗi ô dữ liệu mang *write timestamp* và giá trị có timestamp lớn nhất thắng (*last-write-wins*). Nhất quán giữa các bản sao là **tunable**: mỗi câu lệnh chọn consistency level (ONE, QUORUM, ALL). Đọc và ghi nhất quán mạnh khi R + W > RF. Muốn compare-and-set thì dùng LWT (Paxos) trên một partition.

## 3.5.2 Kết quả

**Thí nghiệm 1: hiện tượng × mức cô lập** (SQL Server, 2 phiên xen kẽ tất định, lock timeout 1.5 s). ✗ = hiện tượng xảy ra.

| Hiện tượng | READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ | SERIALIZABLE | SNAPSHOT |
|---|---|---|---|---|---|
| Dirty read | ✗ | ✓ khoá | ✓ khoá | ✓ khoá | ✓ phiên bản |
| Non-repeatable read | ✗ | ✗ | ✓ khoá | ✓ khoá | ✓ phiên bản |
| Phantom read | ✗ | ✗ | ✗ | ✓ khoá khoảng | ✓ phiên bản |
| Lost update (đọc rồi ghi) | ✗ | ✗ | ✓ chặn → thử lại | ✓ chặn → thử lại | ✓ xung đột 3960 |
| Lost update (`qty = qty - 10`) | ✓ | ✓ | ✓ | ✓ | ✓ |

Kết quả khớp hoàn toàn bảng lý thuyết (25/25 ô) và cho thấy ba cơ chế: khoá, đa phiên bản, phát hiện xung đột.

**Thí nghiệm 2: 50 bệnh nhân đặt cùng một khung giờ** (chức năng FR3):

| Cách làm | Báo thành công | Bản ghi lưu |
|---|---|---|
| SQL Server, đọc `is_booked` rồi ghi, không khoá | 50 | **50** |
| SQL Server, transaction + `WITH (UPDLOCK, HOLDLOCK)` | 1 | 1 |
| SQL Server, chỉ UNIQUE index | 1 (49 lỗi 2627) | 1 |
| Cassandra, SELECT rồi INSERT | 50 | 1 (**ghi đè âm thầm**) |
| Cassandra, `INSERT … IF NOT EXISTS` | 1 | 1 |

**Thí nghiệm 3: khoá và leo thang khoá.** UPDATE 100 dòng giữ 100 khoá `KEY X` và khoá ý định IX ở PAGE/OBJECT. UPDATE 10 000 dòng thì leo thang thành `OBJECT X`. Tắt leo thang thì giữ 10 000 khoá `KEY X`.

**Thí nghiệm 4: deadlock.** T1 giữ thuốc 1 chờ thuốc 2, T2 ngược lại; `sys.dm_tran_locks` cho thấy khoá `KEY X` ở trạng thái WAIT. SQL Server phát hiện sau khoảng 1.2 s, chọn một victim (1205); victim thử lại thì tồn kho cuối đúng.

**Thí nghiệm 5: last-write-wins.** Bản đo t=5 thắng bản t=3 dù đến trước. Bản retry cũ (t=1) đến sau **bị bỏ qua không báo lỗi**. Xung đột được giải quyết theo từng ô (2 client sửa 2 cột khác nhau đều giữ được).

**Thí nghiệm 6: tunable consistency** (3 node, RF = 3, tắt hinted handoff). Câu chuyện: node 3 chết đúng lúc y tá ghi dị ứng *penicillin*.

| Bước | CL | Kết quả |
|---|---|---|
| Ghi khi node 3 chết | ALL | Unavailable (cần 3, còn 2) |
| Ghi khi node 3 chết | QUORUM | OK |
| Node 3 sống lại, đọc ×5 qua node 3 | ONE | `penicillin ×2, none ×3`: **bỏ sót dị ứng 3/5 lần** |
| Đọc qua node 3 | QUORUM | `penicillin` (R + W = 4 > 3), read repair sửa node 3 |

## 3.5.3 Thảo luận và kết luận cho bối cảnh phòng khám

- Tài nguyên khan hiếm bị nhiều người tranh (khung giờ khám, tồn kho thuốc) cần điều khiển đồng thời chặt. Cách viết ngây thơ trên **cả hai** DBMS đều sai: SQL Server tạo 50 lịch hẹn trùng, Cassandra ghi đè âm thầm. SQL Server cho nhiều công cụ để làm đúng (khoá, mức cô lập, ràng buộc UNIQUE, UPDATE atomic), còn Cassandra chỉ có LWT trên một partition.
- Ứng dụng dùng `UPDLOCK + HOLDLOCK` kèm filtered UNIQUE index khi đặt lịch, và `UPDATE … WHERE stock_quantity >= @qty` khi trừ kho. Test E2E bắn 20 request cùng lúc vào cùng 1 slot qua API thật: đúng 1 thành công.
- Với sinh hiệu, mỗi bệnh nhân chỉ có một nguồn ghi là thiết bị, nên last-write-wins chấp nhận được. Ứng dụng ghi `USING TIMESTAMP` bằng thời điểm đo để gói tin đến muộn không đè số mới.
- Dữ liệu lâm sàng quan trọng (dị ứng) **không được** đọc ở CL ONE nếu đặt trên Cassandra. Phải dùng QUORUM/QUORUM, chấp nhận độ trễ cao hơn.
