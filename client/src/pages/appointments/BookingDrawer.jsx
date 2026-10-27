// FR3: pick patient → doctor → day → free slot. A 409 (someone booked the slot first) refreshes the grid.
import { App, Button, DatePicker, Drawer, Empty, Flex, Form, Input, Radio, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import DoctorSelect from '../../components/DoctorSelect.jsx';
import PatientSelect from '../../components/PatientSelect.jsx';
import { toIsoDate } from '../../utils/format.js';

const now = () => dayjs();

export default function BookingDrawer({ open, onClose, onBooked }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const doctorId = Form.useWatch('doctorId', form);
  const date = Form.useWatch('date', form);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSlots = useCallback(async () => {
    if (!doctorId || !date) return setSlots([]);
    setLoadingSlots(true);
    try {
      const { data } = await api.get('/slots', { params: { doctorId, date: toIsoDate(date) } });
      setSlots(data);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    form.setFieldValue('slotId', undefined);
    loadSlots();
  }, [loadSlots, form]);

  const isPast = (slot) => date && dayjs(`${toIsoDate(date)}T${slot.startTime}`).isBefore(now());

  async function submit(values) {
    setSaving(true);
    try {
      const { data } = await api.post('/appointments', {
        patientId: values.patientId,
        slotId: values.slotId,
        reason: values.reason,
      });
      message.success(`Đã đặt lịch #${data.id}: ${data.patientName}, ${data.startTime} ngày ${data.date}`);
      form.resetFields();
      onBooked(data);
    } catch (err) {
      message.error(errorMessage(err));
      if (err.response?.status === 409) loadSlots();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Đặt lịch khám"
      open={open}
      onClose={onClose}
      size={520}
      destroyOnHidden
      extra={
        <Button type="primary" loading={saving} onClick={() => form.submit()}>
          Đặt lịch
        </Button>
      }
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ date: now().add(1, 'day') }}>
        <Form.Item name="patientId" label="Bệnh nhân" rules={[{ required: true, message: 'Chọn bệnh nhân' }]}>
          <PatientSelect />
        </Form.Item>
        <Flex gap={12} wrap>
          <Form.Item
            name="doctorId"
            label="Bác sĩ"
            rules={[{ required: true, message: 'Chọn bác sĩ' }]}
            style={{ flex: 1, minWidth: 220 }}
          >
            <DoctorSelect />
          </Form.Item>
          <Form.Item name="date" label="Ngày khám" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <DatePicker
              format="DD/MM/YYYY"
              allowClear={false}
              disabledDate={(d) => d.isBefore(now(), 'day') || d.isAfter(now().add(13, 'day'), 'day')}
            />
          </Form.Item>
        </Flex>
        <Form.Item
          name="slotId"
          label="Khung giờ"
          rules={[{ required: true, message: 'Chọn khung giờ còn trống' }]}
        >
          {!doctorId ? (
            <Typography.Text type="secondary">Chọn bác sĩ và ngày để xem giờ trống</Typography.Text>
          ) : loadingSlots ? (
            <Spin />
          ) : slots.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bác sĩ không có lịch ngày này" />
          ) : (
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
            >
              {slots.map((s) => (
                <Radio.Button
                  key={s.id}
                  value={s.id}
                  disabled={s.isBooked || isPast(s)}
                  style={{ borderRadius: 6 }}
                >
                  {s.startTime}
                </Radio.Button>
              ))}
            </Radio.Group>
          )}
        </Form.Item>
        <Form.Item name="reason" label="Lý do khám" rules={[{ max: 255 }]}>
          <Input.TextArea rows={2} placeholder="VD: Sốt, ho 3 ngày" showCount maxLength={255} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
