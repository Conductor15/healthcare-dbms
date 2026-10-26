// FR4: record a visit with an optional prescription. The server writes everything in ONE transaction;
// if a medicine runs out meanwhile, nothing is saved and the error names the medicine.
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DoctorSelect from '../../components/DoctorSelect.jsx';
import PatientSelect from '../../components/PatientSelect.jsx';
import { money } from '../../utils/format.js';

export default function VisitFormDrawer({ open, appointment, onClose, onCreated }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const isDoctor = user.role === 'DOCTOR';
  const [form] = Form.useForm();
  const [medicines, setMedicines] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);
  const items = Form.useWatch('items', form) ?? [];
  const watchedDoctorId = Form.useWatch('doctorId', form);
  const doctorId = isDoctor ? user.doctorId : watchedDoctorId; // doctors have no doctor field in the form

  useEffect(() => {
    if (!open) return;
    api.get('/medicines').then(({ data }) => setMedicines(data));
    api.get('/lookups/doctors').then(({ data }) => setDoctors(data));
    form.setFieldsValue({
      patientId: appointment?.patientId,
      doctorId: isDoctor ? user.doctorId : appointment?.doctorId,
      symptoms: appointment?.reason ?? undefined,
      items: [],
    });
  }, [open, appointment, form, isDoctor, user.doctorId]);

  const byId = useMemo(() => Object.fromEntries(medicines.map((m) => [m.id, m])), [medicines]);
  const fee = doctors.find((d) => d.id === doctorId)?.consultationFee ?? 0;
  const medicineTotal = items.reduce(
    (sum, it) => sum + (it?.medicineId && it?.quantity ? byId[it.medicineId].unitPrice * it.quantity : 0),
    0,
  );

  async function submit(values) {
    setSaving(true);
    try {
      const { data } = await api.post('/visits', { ...values, appointmentId: appointment?.id });
      message.success(`Đã lưu lượt khám #${data.id}, hoá đơn ${money(data.invoice.totalAmount)}`);
      form.resetFields();
      onCreated(data);
    } catch (err) {
      message.error(errorMessage(err));
      api.get('/medicines').then(({ data }) => setMedicines(data)); // stock may have changed
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title={appointment ? `Khám bệnh: lịch hẹn #${appointment.id}` : 'Ghi nhận lượt khám'}
      open={open}
      onClose={onClose}
      size={720}
      destroyOnHidden
      extra={
        <Button type="primary" loading={saving} onClick={() => form.submit()}>
          Lưu lượt khám
        </Button>
      }
    >
      {appointment && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${appointment.patientName} · ${appointment.startTime} ${appointment.date} · ${appointment.doctorName}`}
          description="Lưu lượt khám sẽ chuyển lịch hẹn sang trạng thái Đã khám."
        />
      )}
      <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
        <Space wrap style={{ width: '100%' }} styles={{ item: { flex: 1, minWidth: 260 } }}>
          <Form.Item
            name="patientId"
            label="Bệnh nhân"
            rules={[{ required: true, message: 'Chọn bệnh nhân' }]}
          >
            <PatientSelect
              disabled={Boolean(appointment)}
              initialOption={appointment && { value: appointment.patientId, label: appointment.patientName }}
            />
          </Form.Item>
          {!isDoctor && (
            <Form.Item
              name="doctorId"
              label="Bác sĩ khám"
              rules={[{ required: true, message: 'Chọn bác sĩ' }]}
            >
              <DoctorSelect disabled={Boolean(appointment)} />
            </Form.Item>
          )}
        </Space>
        <Form.Item name="symptoms" label="Triệu chứng" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} showCount maxLength={500} />
        </Form.Item>
        <Form.Item
          name="diagnosis"
          label="Chẩn đoán"
          rules={[
            { required: true, message: 'Nhập chẩn đoán' },
            { min: 2, max: 500 },
          ]}
        >
          <Input placeholder="VD: Viêm họng cấp" />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú của bác sĩ">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider titlePlacement="start">Đơn thuốc</Divider>
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => {
                const med = byId[items[name]?.medicineId];
                return (
                  <Space key={key} align="start" wrap style={{ display: 'flex' }}>
                    <Form.Item
                      name={[name, 'medicineId']}
                      rules={[
                        { required: true, message: 'Chọn thuốc' },
                        {
                          validator: (_, v) =>
                            items.filter((it) => it?.medicineId === v).length > 1
                              ? Promise.reject(new Error('Thuốc đã có trong đơn'))
                              : Promise.resolve(),
                        },
                      ]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Thuốc"
                        style={{ width: 300 }}
                        options={medicines.map((m) => ({
                          value: m.id,
                          label: `${m.name} · ${money(m.unitPrice)}/${m.unit} · còn ${m.stock}`,
                          disabled: m.stock === 0,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name={[name, 'quantity']} rules={[{ required: true, message: 'Số lượng' }]}>
                      <InputNumber min={1} max={med?.stock ?? 1000} placeholder="SL" style={{ width: 90 }} />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'dosage']}
                      rules={[{ required: true, min: 2, message: 'Nhập liều dùng' }]}
                    >
                      <Input placeholder="Liều dùng, VD: sáng 1 viên" style={{ width: 220 }} />
                    </Form.Item>
                    <Button icon={<DeleteOutlined />} onClick={() => remove(name)} aria-label="Bỏ thuốc" />
                  </Space>
                );
              })}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })} block>
                Thêm thuốc
              </Button>
            </>
          )}
        </Form.List>
        <Form.Item name="prescriptionNotes" label="Lời dặn" style={{ marginTop: 16 }}>
          <Input placeholder="VD: Tái khám sau 5 ngày nếu còn sốt" />
        </Form.Item>
      </Form>

      <Descriptions
        bordered
        size="small"
        column={1}
        title="Dự kiến hoá đơn"
        items={[
          { key: 'fee', label: 'Phí khám', children: money(fee) },
          { key: 'med', label: 'Tiền thuốc', children: money(medicineTotal) },
          {
            key: 'total',
            label: 'Tổng',
            children: <Typography.Text strong>{money(fee + medicineTotal)}</Typography.Text>,
          },
        ]}
      />
    </Drawer>
  );
}
