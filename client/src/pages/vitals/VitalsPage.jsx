// FR9 (Cassandra): live vital signs of one patient (SSE), today's history chart, abnormal alerts,
// and a device simulator that streams readings for several patients.
import { HeartOutlined, PlayCircleOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import PatientSelect from '../../components/PatientSelect.jsx';
import { fmtTime, toIsoDate } from '../../utils/format.js';

// same thresholds as server/src/modules/vitals/vitals.service.js
const ABNORMAL = {
  heartRate: (v) => v > 120 || v < 50,
  spo2: (v) => v < 92,
  systolicBp: (v) => v >= 160 || v < 90,
  temperature: (v) => v >= 38.5,
};
const ALERT_LABEL = {
  HEART_RATE: 'Nhịp tim',
  SPO2: 'SpO₂',
  BLOOD_PRESSURE: 'Huyết áp',
  TEMPERATURE: 'Nhiệt độ',
};
const MAX_POINTS = 300;

function Tile({ title, value, suffix, abnormal }) {
  return (
    <Card size="small">
      <Statistic
        title={title}
        value={value ?? '—'}
        suffix={value == null ? null : suffix}
        styles={{ content: { color: abnormal ? '#cf1322' : undefined } }}
      />
    </Card>
  );
}

export default function VitalsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const clinical = ['ADMIN', 'DOCTOR'].includes(user.role);

  const [patientId, setPatientId] = useState();
  const [day, setDay] = useState(dayjs());
  const [history, setHistory] = useState([]);
  const [stream, setStream] = useState('connecting'); // connecting | live | error
  const [alerts, setAlerts] = useState([]);
  const [sim, setSim] = useState({ running: false });
  const [simForm] = Form.useForm();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm] = Form.useForm();
  const isToday = day.isSame(dayjs(), 'day');

  const loadHistory = useCallback(async () => {
    if (!patientId) return setHistory([]);
    try {
      const { data } = await api.get(`/vitals/${patientId}`, {
        params: { day: toIsoDate(day), limit: MAX_POINTS },
      });
      setHistory(data);
    } catch (err) {
      message.error(errorMessage(err));
    }
  }, [patientId, day, message]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // live stream for today's data
  useEffect(() => {
    if (!patientId || !isToday) return undefined;
    const es = new EventSource(`/api/vitals/${patientId}/stream?token=${localStorage.getItem('token')}`);
    es.onopen = () => setStream('live');
    es.onerror = () => setStream('error'); // EventSource retries by itself (retry: 3000)
    es.onmessage = (e) => {
      const reading = JSON.parse(e.data);
      setHistory((h) => [reading, ...h].slice(0, MAX_POINTS));
    };
    return () => {
      es.close();
      setStream('connecting');
    };
  }, [patientId, isToday]);

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts((await api.get('/vitals/alerts', { params: { day: toIsoDate(day), limit: 100 } })).data);
    } catch {
      // alerts are secondary; the main view still works
    }
  }, [day]);

  const loadSim = useCallback(async () => setSim((await api.get('/vitals/simulator')).data), []);

  useEffect(() => {
    loadAlerts();
    loadSim();
    const timer = setInterval(() => {
      loadAlerts();
      loadSim();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadAlerts, loadSim]);

  async function startSim(values) {
    try {
      setSim((await api.post('/vitals/simulator', values)).data);
      message.success('Đã bật trình giả lập thiết bị');
      if (!patientId) setPatientId(values.patientIds[0]);
    } catch (err) {
      message.error(errorMessage(err));
    }
  }

  async function stopSim() {
    const { data } = await api.delete('/vitals/simulator');
    setSim(data);
    message.info(`Đã dừng: ghi ${data.written ?? 0} bản đo`);
  }

  async function saveManual(values) {
    try {
      const { data } = await api.post('/vitals', { ...values, patientId });
      message[data.alerts.length ? 'warning' : 'success'](
        data.alerts.length
          ? `Đã lưu, cảnh báo: ${data.alerts.map((a) => a.detail).join(', ')}`
          : 'Đã lưu chỉ số',
      );
      setManualOpen(false);
      manualForm.resetFields();
      if (!isToday) loadHistory();
    } catch (err) {
      message.error(errorMessage(err));
    }
  }

  const latest = history[0];
  const chartData = [...history].reverse().map((r) => ({ ...r, time: fmtTime(r.recordedAt) }));

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <div className="page-toolbar" style={{ marginBottom: 0 }}>
          <Space wrap>
            <PatientSelect
              value={patientId}
              onChange={setPatientId}
              style={{ width: 300 }}
              placeholder="Chọn bệnh nhân để theo dõi"
            />
            <DatePicker
              value={day}
              onChange={(d) => setDay(d ?? dayjs())}
              allowClear={false}
              format="DD/MM/YYYY"
            />
            {patientId && isToday && (
              <Badge
                status={{ live: 'processing', connecting: 'warning', error: 'error' }[stream]}
                text={
                  {
                    live: 'Đang nhận trực tiếp',
                    connecting: 'Đang kết nối…',
                    error: 'Mất kết nối, đang thử lại',
                  }[stream]
                }
              />
            )}
          </Space>
          {clinical && patientId && (
            <Button icon={<PlusOutlined />} onClick={() => setManualOpen(true)}>
              Nhập chỉ số
            </Button>
          )}
        </div>
      </Card>

      {!patientId ? (
        <Card>
          <Empty description="Chọn bệnh nhân (hoặc bật trình giả lập bên dưới) để xem sinh hiệu" />
        </Card>
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={5}>
              <Tile
                title="Nhịp tim"
                value={latest?.heartRate}
                suffix="bpm"
                abnormal={latest && ABNORMAL.heartRate(latest.heartRate)}
              />
            </Col>
            <Col xs={12} md={5}>
              <Tile
                title="Huyết áp"
                value={latest && `${latest.systolicBp}/${latest.diastolicBp}`}
                suffix="mmHg"
                abnormal={latest && ABNORMAL.systolicBp(latest.systolicBp)}
              />
            </Col>
            <Col xs={12} md={5}>
              <Tile
                title="SpO₂"
                value={latest?.spo2}
                suffix="%"
                abnormal={latest && ABNORMAL.spo2(latest.spo2)}
              />
            </Col>
            <Col xs={12} md={4}>
              <Tile
                title="Nhiệt độ"
                value={latest?.temperature}
                suffix="°C"
                abnormal={latest && ABNORMAL.temperature(latest.temperature)}
              />
            </Col>
            <Col xs={24} md={5}>
              <Tile title="Cập nhật lúc" value={latest ? fmtTime(latest.recordedAt) : null} />
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            {[
              {
                title: 'Nhịp tim & SpO₂',
                lines: [
                  ['heartRate', 'Nhịp tim', '#cf1322'],
                  ['spo2', 'SpO₂', '#0f766e'],
                ],
              },
              {
                title: 'Huyết áp',
                lines: [
                  ['systolicBp', 'Tâm thu', '#1d4ed8'],
                  ['diastolicBp', 'Tâm trương', '#7c3aed'],
                ],
              },
            ].map((chart) => (
              <Col xs={24} lg={12} key={chart.title}>
                <Card size="small" title={`${chart.title} (${history.length} bản đo)`}>
                  {history.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu trong ngày" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" minTickGap={40} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        {chart.lines.map(([key, name, color]) => (
                          <Line
                            key={key}
                            dataKey={key}
                            name={name}
                            stroke={color}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Row gutter={[12, 12]}>
        {clinical && (
          <Col xs={24} lg={10}>
            <Card
              size="small"
              title={
                <>
                  <HeartOutlined /> Trình giả lập thiết bị đo
                </>
              }
            >
              {sim.running ? (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    title={`Đang ghi cho ${sim.patientIds.length} bệnh nhân, mỗi ${sim.intervalMs} ms`}
                    description={`Đã ghi ${sim.written} bản đo vào Cassandra · dừng lúc ${fmtTime(sim.endsAt)}`}
                  />
                  <Button danger icon={<StopOutlined />} onClick={stopSim} block>
                    Dừng
                  </Button>
                </Space>
              ) : (
                <Form
                  form={simForm}
                  layout="vertical"
                  onFinish={startSim}
                  initialValues={{ intervalMs: 1000, durationSec: 120 }}
                >
                  <Form.Item
                    name="patientIds"
                    label="Bệnh nhân đeo thiết bị"
                    rules={[{ required: true, message: 'Chọn ít nhất 1 bệnh nhân' }]}
                  >
                    <PatientSelect mode="multiple" maxCount={20} />
                  </Form.Item>
                  <Space wrap>
                    <Form.Item name="intervalMs" label="Tần suất">
                      <Select
                        style={{ width: 140 }}
                        options={[200, 500, 1000, 2000].map((v) => ({ value: v, label: `mỗi ${v} ms` }))}
                      />
                    </Form.Item>
                    <Form.Item name="durationSec" label="Trong">
                      <Select
                        style={{ width: 120 }}
                        options={[60, 120, 300, 600].map((v) => ({ value: v, label: `${v / 60} phút` }))}
                      />
                    </Form.Item>
                  </Space>
                  <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} block>
                    Bật giả lập
                  </Button>
                </Form>
              )}
            </Card>
          </Col>
        )}
        <Col xs={24} lg={clinical ? 14 : 24}>
          <Card
            size="small"
            title={`Cảnh báo bất thường ngày ${day.format('DD/MM/YYYY')} (Cassandra, bảng vital_alerts_by_day)`}
          >
            <Table
              size="small"
              rowKey={(r) => `${r.recordedAt}-${r.patientId}-${r.type}`}
              dataSource={alerts}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: 'Không có cảnh báo' }}
              columns={[
                { title: 'Lúc', dataIndex: 'recordedAt', width: 90, render: fmtTime },
                {
                  title: 'Bệnh nhân',
                  dataIndex: 'patientId',
                  width: 100,
                  render: (id) => <Typography.Link onClick={() => setPatientId(id)}>#{id}</Typography.Link>,
                },
                {
                  title: 'Loại',
                  dataIndex: 'type',
                  width: 110,
                  render: (t) => <Tag color="red">{ALERT_LABEL[t] ?? t}</Tag>,
                },
                { title: 'Chi tiết', dataIndex: 'detail' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Nhập chỉ số sinh hiệu"
        open={manualOpen}
        onCancel={() => setManualOpen(false)}
        okText="Lưu"
        cancelText="Huỷ"
        onOk={() => manualForm.submit()}
        destroyOnHidden
      >
        <Form
          form={manualForm}
          layout="vertical"
          onFinish={saveManual}
          initialValues={{ heartRate: 75, systolicBp: 120, diastolicBp: 80, spo2: 98, temperature: 36.8 }}
        >
          <Space wrap>
            <Form.Item name="heartRate" label="Nhịp tim (bpm)" rules={[{ required: true }]}>
              <InputNumber min={20} max={250} />
            </Form.Item>
            <Form.Item name="systolicBp" label="Tâm thu" rules={[{ required: true }]}>
              <InputNumber min={50} max={260} />
            </Form.Item>
            <Form.Item name="diastolicBp" label="Tâm trương" rules={[{ required: true }]}>
              <InputNumber min={30} max={160} />
            </Form.Item>
            <Form.Item name="spo2" label="SpO₂ (%)" rules={[{ required: true }]}>
              <InputNumber min={50} max={100} />
            </Form.Item>
            <Form.Item name="temperature" label="Nhiệt độ (°C)" rules={[{ required: true }]}>
              <InputNumber min={30} max={45} step={0.1} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
