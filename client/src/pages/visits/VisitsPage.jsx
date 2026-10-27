// FR4 + FR6: visit history with filters, record a new visit, open the full detail.
// Deep links: /visits?appointmentId=12 opens the form for that appointment, /visits?visitId=5 opens a detail.
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, DatePicker, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DoctorSelect from '../../components/DoctorSelect.jsx';
import PatientSelect from '../../components/PatientSelect.jsx';
import { fmtDateTime, INVOICE_STATUS, money, toIsoDate } from '../../utils/format.js';
import VisitDetailDrawer from './VisitDetailDrawer.jsx';
import VisitFormDrawer from './VisitFormDrawer.jsx';

export default function VisitsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const canExamine = ['ADMIN', 'DOCTOR'].includes(user.role);

  const [filters, setFilters] = useState({ patientId: undefined, doctorId: undefined, range: null });
  const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ open: false, appointment: null });
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/visits', {
        params: {
          patientId: filters.patientId,
          doctorId: filters.doctorId,
          from: toIsoDate(filters.range?.[0]),
          to: toIsoDate(filters.range?.[1]),
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

  // deep links from the appointments page
  useEffect(() => {
    const appointmentId = params.get('appointmentId');
    const visitId = params.get('visitId');
    if (appointmentId) {
      api
        .get(`/appointments/${appointmentId}`)
        .then(({ data }) => setForm({ open: true, appointment: data }))
        .catch((err) => message.error(errorMessage(err)));
    }
    if (visitId) setDetailId(Number(visitId));
    if (appointmentId || visitId) setParams({}, { replace: true });
  }, [params, setParams, message]);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage((p) => ({ ...p, current: 1 }));
  };

  const columns = [
    { title: 'Thời gian', dataIndex: 'visitDate', width: 150, render: fmtDateTime },
    { title: 'Bệnh nhân', dataIndex: 'patientName' },
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
    { title: 'Chẩn đoán', dataIndex: 'diagnosis', ellipsis: true },
    {
      title: 'Hoá đơn',
      key: 'invoice',
      width: 190,
      render: (_, r) =>
        r.invoiceId ? (
          <Space orientation="vertical" size={0}>
            <Typography.Text>{money(r.totalAmount)}</Typography.Text>
            <Tag color={INVOICE_STATUS[r.invoiceStatus].color}>{INVOICE_STATUS[r.invoiceStatus].label}</Tag>
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <div className="page-toolbar">
        <Space wrap>
          <PatientSelect value={filters.patientId} onChange={setFilter('patientId')} style={{ width: 260 }} />
          {user.role !== 'DOCTOR' && (
            <DoctorSelect value={filters.doctorId} onChange={setFilter('doctorId')} style={{ width: 220 }} />
          )}
          <DatePicker.RangePicker value={filters.range} onChange={setFilter('range')} format="DD/MM/YYYY" />
        </Space>
        {canExamine && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ open: true, appointment: null })}
          >
            Khám vãng lai
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.items}
        loading={loading}
        scroll={{ x: 900 }}
        locale={{ emptyText: 'Chưa có lượt khám' }}
        onRow={(r) => ({ onDoubleClick: () => setDetailId(r.id) })}
        pagination={{
          ...page,
          total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `${t} lượt khám`,
          onChange: (current, pageSize) => setPage({ current, pageSize }),
        }}
      />

      <VisitFormDrawer
        open={form.open}
        appointment={form.appointment}
        onClose={() => setForm({ open: false, appointment: null })}
        onCreated={(visit) => {
          setForm({ open: false, appointment: null });
          setDetailId(visit.id);
          load();
        }}
      />
      <VisitDetailDrawer visitId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
    </Card>
  );
}
