// Topic v: isolation anomaly matrix, double-booking race, deadlock.
import { PlayCircleOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';
import { api, errorMessage } from '../../api/client.js';

const BOOKING_MODES = [
  { value: 'mssql-naive', label: 'SQL Server: đọc rồi ghi, không khoá' },
  { value: 'mssql-locked', label: 'SQL Server: UPDLOCK + HOLDLOCK' },
  { value: 'mssql-unique', label: 'SQL Server: chỉ UNIQUE index' },
  { value: 'cassandra-naive', label: 'Cassandra: SELECT rồi INSERT' },
  { value: 'cassandra-lwt', label: 'Cassandra: IF NOT EXISTS (LWT)' },
];

function useRunner() {
  const { message } = App.useApp();
  const [running, setRunning] = useState(false);
  const run = async (request) => {
    setRunning(true);
    try {
      return (await request()).data;
    } catch (err) {
      message.error(errorMessage(err));
      return null;
    } finally {
      setRunning(false);
    }
  };
  return [running, run];
}

function IsolationMatrix() {
  const [running, run] = useRunner();
  const [matrix, setMatrix] = useState(null);
  return (
    <Card
      size="small"
      title="Hiện tượng × mức isolation (SQL Server)"
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={running}
          onClick={async () => setMatrix(await run(() => api.get('/lab/concurrency/isolation-matrix')))}
        >
          Chạy (~15 giây)
        </Button>
      }
    >
      <Typography.Paragraph type="secondary">
        Mỗi ô chạy 2 phiên xen kẽ trên bảng <Typography.Text code>lab_stock</Typography.Text> (lock timeout
        1.5 s). Rê chuột vào ô để xem cơ chế đã ngăn hiện tượng: khoá, phiên bản (SNAPSHOT) hay phát hiện xung
        đột.
      </Typography.Paragraph>
      {matrix && (
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          scroll={{ x: 800 }}
          dataSource={matrix.rows}
          columns={[
            { title: 'Hiện tượng', dataIndex: 'anomaly', fixed: 'left', width: 220 },
            ...matrix.levels.map((level) => ({
              title: level,
              key: level,
              align: 'center',
              render: (_, row) => {
                const cell = row.cells[level];
                return (
                  <Tooltip title={cell.how}>
                    <Tag color={cell.anomaly ? 'red' : 'green'}>{cell.anomaly ? '✗ Có' : '✓ Không'}</Tag>
                  </Tooltip>
                );
              },
            })),
          ]}
        />
      )}
    </Card>
  );
}

function DoubleBooking() {
  const [running, run] = useRunner();
  const [mode, setMode] = useState('mssql-naive');
  const [requests, setRequests] = useState(50);
  const [runs, setRuns] = useState([]);
  const start = async () => {
    const r = await run(() => api.post('/lab/concurrency/double-booking', { mode, requests }));
    if (r) setRuns((list) => [{ ...r, key: Date.now() }, ...list]);
  };
  return (
    <Card size="small" title="Đặt trùng lịch: N bệnh nhân đặt CÙNG một khung giờ cùng lúc">
      <Space wrap style={{ marginBottom: 12 }}>
        <Select value={mode} onChange={setMode} options={BOOKING_MODES} style={{ width: 300 }} />
        <InputNumber
          min={2}
          max={200}
          value={requests}
          onChange={setRequests}
          suffix="request"
          style={{ width: 140 }}
        />
        <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={start}>
          Chạy
        </Button>
      </Space>
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        dataSource={runs}
        locale={{ emptyText: 'Chạy từng chế độ để so sánh' }}
        columns={[
          { title: 'Cách làm', dataIndex: 'description' },
          { title: 'Request', dataIndex: 'requests', align: 'right', width: 80 },
          {
            title: 'Báo "thành công"',
            dataIndex: 'toldBooked',
            align: 'right',
            width: 130,
            render: (v) => <Tag color={v > 1 ? 'red' : 'green'}>{v}</Tag>,
          },
          {
            title: 'Lưu trong DB',
            dataIndex: 'rowsStored',
            align: 'right',
            width: 110,
            render: (v, r) => <Tag color={v > 1 || r.toldBooked > v ? 'red' : 'green'}>{v}</Tag>,
          },
          { title: 'Người giữ slot', dataIndex: 'owner', ellipsis: true },
          {
            title: 'Lỗi',
            dataIndex: 'errors',
            render: (e) => Object.entries(e).map(([k, n]) => <Tag key={k}>{`${n} × ${k}`}</Tag>),
          },
          { title: 'ms', dataIndex: 'ms', align: 'right', width: 70 },
        ]}
      />
    </Card>
  );
}

function Deadlock() {
  const [running, run] = useRunner();
  const [result, setResult] = useState(null);
  const lockColumns = [
    { title: 'Giao dịch', dataIndex: 'tx', width: 90 },
    { title: 'Tài nguyên', dataIndex: 'resource' },
    { title: 'Mode', dataIndex: 'mode', render: (m) => <Tag>{m}</Tag> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (s) => <Tag color={s === 'WAIT' ? 'red' : 'green'}>{s}</Tag>,
    },
  ];
  return (
    <Card
      size="small"
      title="Deadlock: T1 khoá thuốc 1 rồi cần thuốc 2, T2 ngược lại"
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={running}
          onClick={async () => setResult(await run(() => api.post('/lab/concurrency/deadlock')))}
        >
          Tạo deadlock
        </Button>
      }
    >
      {result && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Alert
              type="warning"
              showIcon
              title={`SQL Server phát hiện deadlock sau ${result.detectedAfterMs} ms, chọn ${result.victim} làm victim (lỗi 1205)`}
              description={`Victim tự thử lại → tồn kho cuối: ${result.finalStock.map((s) => `${s.name} ${s.qty}`).join(', ')}`}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>Khoá tại thời điểm chờ vòng (sys.dm_tran_locks)</Typography.Text>
            <Table
              size="small"
              rowKey={(r) => `${r.spid}-${r.resource}-${r.mode}-${r.status}`}
              pagination={false}
              dataSource={result.locksWaiting}
              columns={lockColumns}
            />
          </Col>
        </Row>
      )}
    </Card>
  );
}

export default function ConcurrencyPanel() {
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>
        Cùng code với <Typography.Text code>demos/05-concurrency</Typography.Text> (
        <Typography.Text code>server/src/modules/lab/concurrency.lab.js</Typography.Text>). Chức năng đặt lịch
        thật (FR3) dùng cách <Typography.Text strong>UPDLOCK + HOLDLOCK</Typography.Text>, thêm UNIQUE index
        làm lớp chặn cuối.
      </Typography.Paragraph>
      <IsolationMatrix />
      <DoubleBooking />
      <Deadlock />
    </Space>
  );
}
