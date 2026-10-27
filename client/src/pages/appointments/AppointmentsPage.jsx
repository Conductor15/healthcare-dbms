// FR3: appointments of a day (or all), filter by doctor/status, book, cancel, delete, start the visit.
import {
  CalendarOutlined,
  DeleteOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DoctorSelect from '../../components/DoctorSelect.jsx';
import { APPOINTMENT_STATUS, toIsoDate } from '../../utils/format.js';
import BookingDrawer from './BookingDrawer.jsx';

export default function AppointmentsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFrontDesk = ['ADMIN', 'RECEPTIONIST'].includes(user.role);
  const canExamine = ['ADMIN', 'DOCTOR'].includes(user.role);

  const [filters, setFilters] = useState({ date: dayjs(), doctorId: undefined, status: undefined });
  const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/appointments', {
        params: {
          date: toIsoDate(filters.date),
          doctorId: filters.doctorId,
          status: filters.status,
          page: page.current,
          pageSize: page.pageSize,
        },
      });
      setData(data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, message]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage((p) => ({ ...p, current: 1 }));
  };

  async function act(request, success) {
    try {
      await request();
      message.success(success);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  }

  const columns = [
    {
      title: 'Thời gian',
      key: 'time',
      width: 150,
      render: (_, r) => (
        <>
          <Typography.Text strong>
            {r.startTime}–{r.endTime}
          </Typography.Text>
          <br />
          <Typography.Text type="secondary">{dayjs(r.date).format('DD/MM/YYYY')}</Typography.Text>
        </>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, r) => (
        <>
          {r.patientName}
          <br />
          <Typography.Text type="secondary">{r.patientPhone ?? '—'}</Typography.Text>
        </>
      ),
    },
    {
      title: 'Bác sĩ',
      key: 'doctor',
      render: (_, r) => (
        <>
          {r.doctorName}
          <br />
          <Typography.Text type="secondary">{r.departmentName}</Typography.Text>
        </>
      ),
    },
    { title: 'Lý do', dataIndex: 'reason', ellipsis: true, render: (v) => v ?? '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (s) => <Tag color={APPOINTMENT_STATUS[s].color}>{APPOINTMENT_STATUS[s].label}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      render: (_, r) => (
        <Space wrap>
          {r.status === 'SCHEDULED' && canExamine && (
            <Button
              size="small"
              type="primary"
              icon={<MedicineBoxOutlined />}
              onClick={() => navigate(`/visits?appointmentId=${r.id}`)}
            >
              Khám
            </Button>
          )}
          {r.visitId && (
            <Button size="small" onClick={() => navigate(`/visits?visitId=${r.visitId}`)}>
              Xem lượt khám
            </Button>
          )}
          {r.status === 'SCHEDULED' && isFrontDesk && (
            <Popconfirm
              title="Huỷ lịch hẹn này?"
              description="Khung giờ sẽ được mở lại cho người khác."
              okText="Huỷ lịch"
              cancelText="Không"
              okButtonProps={{ danger: true }}
              onConfirm={() => act(() => api.patch(`/appointments/${r.id}/cancel`), 'Đã huỷ lịch hẹn')}
            >
              <Tooltip title="Huỷ lịch">
                <Button size="small" icon={<StopOutlined />} aria-label="Huỷ lịch" />
              </Tooltip>
            </Popconfirm>
          )}
          {r.status === 'CANCELLED' && user.role === 'ADMIN' && (
            <Popconfirm
              title="Xoá vĩnh viễn lịch đã huỷ?"
              okText="Xoá"
              cancelText="Không"
              okButtonProps={{ danger: true }}
              onConfirm={() => act(() => api.delete(`/appointments/${r.id}`), 'Đã xoá lịch hẹn')}
            >
              <Tooltip title="Xoá">
                <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xoá" />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div className="page-toolbar">
        <Space wrap>
          <DatePicker
            value={filters.date}
            onChange={setFilter('date')}
            format="DD/MM/YYYY"
            placeholder="Tất cả các ngày"
            prefix={<CalendarOutlined />}
          />
          {user.role !== 'DOCTOR' && (
            <DoctorSelect value={filters.doctorId} onChange={setFilter('doctorId')} style={{ width: 240 }} />
          )}
          <Select
            allowClear
            placeholder="Trạng thái"
            value={filters.status}
            onChange={setFilter('status')}
            style={{ width: 150 }}
            options={Object.entries(APPOINTMENT_STATUS).map(([value, s]) => ({ value, label: s.label }))}
          />
        </Space>
        {isFrontDesk && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setBooking(true)}>
            Đặt lịch
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.items}
        loading={loading}
        scroll={{ x: 900 }}
        locale={{ emptyText: 'Không có lịch hẹn' }}
        pagination={{
          ...page,
          total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `${t} lịch hẹn`,
          onChange: (current, pageSize) => setPage({ current, pageSize }),
        }}
      />

      <BookingDrawer
        open={booking}
        onClose={() => setBooking(false)}
        onBooked={(appt) => {
          setBooking(false);
          setFilters((f) => ({ ...f, date: dayjs(appt.date), status: undefined }));
        }}
      />
    </Card>
  );
}
