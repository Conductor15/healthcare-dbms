// FR6: everything about one visit (one 10-table join on the server) + invoice payment.
import { DollarOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { age, fmtDate, fmtDateTime, GENDER, INVOICE_STATUS, money } from '../../utils/format.js';

export default function VisitDetailDrawer({ visitId, onClose, onChanged }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [visit, setVisit] = useState(null);

  const load = useCallback(async () => {
    if (!visitId) return setVisit(null);
    try {
      setVisit((await api.get(`/visits/${visitId}`)).data);
    } catch (err) {
      message.error(errorMessage(err));
    }
  }, [visitId, message]);

  useEffect(() => {
    load();
  }, [load]);

  async function pay() {
    try {
      setVisit((await api.patch(`/invoices/${visit.invoice.id}/pay`)).data);
      message.success('Đã ghi nhận thanh toán');
      onChanged?.();
    } catch (err) {
      message.error(errorMessage(err));
    }
  }

  const v = visit;
  return (
    <Drawer
      title={v ? `Lượt khám #${v.id}` : 'Lượt khám'}
      open={Boolean(visitId)}
      onClose={onClose}
      size={760}
    >
      {!v ? (
        <Skeleton active />
      ) : (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions
            title="Bệnh nhân"
            bordered
            size="small"
            column={2}
            items={[
              { key: 'name', label: 'Họ tên', children: v.patient.fullName },
              {
                key: 'dob',
                label: 'Ngày sinh',
                children: `${fmtDate(v.patient.dateOfBirth)} (${age(v.patient.dateOfBirth)} tuổi)`,
              },
              { key: 'gender', label: 'Giới tính', children: GENDER[v.patient.gender] },
              { key: 'blood', label: 'Nhóm máu', children: v.patient.bloodType ?? '—' },
              { key: 'phone', label: 'SĐT', children: v.patient.phone ?? '—' },
              { key: 'history', label: 'Tiền sử', children: v.patient.medicalHistory ?? '—' },
            ]}
          />
          <Descriptions
            title="Lượt khám"
            bordered
            size="small"
            column={2}
            items={[
              { key: 'date', label: 'Thời gian', children: fmtDateTime(v.visitDate) },
              {
                key: 'appt',
                label: 'Lịch hẹn',
                children: v.appointment
                  ? `#${v.appointment.id} · ${v.appointment.time} ${fmtDate(v.appointment.date)}`
                  : 'Khám vãng lai',
              },
              {
                key: 'doctor',
                label: 'Bác sĩ',
                children: `${v.doctor.fullName} (${v.doctor.specialization ?? '—'})`,
              },
              {
                key: 'dept',
                label: 'Khoa',
                children: `${v.department.name} · ${v.department.location ?? ''}`,
              },
              { key: 'symptoms', label: 'Triệu chứng', span: 2, children: v.symptoms ?? '—' },
              {
                key: 'diagnosis',
                label: 'Chẩn đoán',
                span: 2,
                children: <Typography.Text strong>{v.diagnosis}</Typography.Text>,
              },
              { key: 'notes', label: 'Ghi chú', span: 2, children: v.notes ?? '—' },
            ]}
          />
          <div>
            <Typography.Title level={5}>Đơn thuốc</Typography.Title>
            {v.prescription ? (
              <Table
                size="small"
                rowKey="medicineId"
                pagination={false}
                dataSource={v.prescription.items}
                columns={[
                  { title: 'Thuốc', dataIndex: 'name' },
                  { title: 'SL', dataIndex: 'quantity', align: 'right', render: (q, r) => `${q} ${r.unit}` },
                  { title: 'Liều dùng', dataIndex: 'dosage' },
                  { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
                  { title: 'Thành tiền', dataIndex: 'amount', align: 'right', render: money },
                ]}
                footer={v.prescription.notes ? () => `Lời dặn: ${v.prescription.notes}` : undefined}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không kê đơn" />
            )}
          </div>
          {v.invoice && (
            <Descriptions
              title="Hoá đơn"
              bordered
              size="small"
              column={2}
              extra={
                v.invoice.status === 'UNPAID' &&
                ['ADMIN', 'RECEPTIONIST'].includes(user.role) && (
                  <Popconfirm
                    title={`Xác nhận đã thu ${money(v.invoice.totalAmount)}?`}
                    okText="Đã thu"
                    cancelText="Huỷ"
                    onConfirm={pay}
                  >
                    <Button type="primary" icon={<DollarOutlined />}>
                      Thanh toán
                    </Button>
                  </Popconfirm>
                )
              }
              items={[
                { key: 'fee', label: 'Phí khám', children: money(v.invoice.consultationFee) },
                { key: 'med', label: 'Tiền thuốc', children: money(v.invoice.medicineTotal) },
                {
                  key: 'total',
                  label: 'Tổng cộng',
                  children: <Typography.Text strong>{money(v.invoice.totalAmount)}</Typography.Text>,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: (
                    <Tag color={INVOICE_STATUS[v.invoice.status].color}>
                      {INVOICE_STATUS[v.invoice.status].label}
                      {v.invoice.paidAt ? ` · ${fmtDateTime(v.invoice.paidAt)}` : ''}
                    </Tag>
                  ),
                },
              ]}
            />
          )}
        </Space>
      )}
    </Drawer>
  );
}
