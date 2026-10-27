// Topic iv: the 5-step "khám bệnh" workflow with a failure injected at step N.
import { PlayCircleOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Row, Segmented, Space, Steps, Table, Typography } from 'antd';
import { useState } from 'react';
import { api, errorMessage } from '../../api/client.js';

const MODES = [
  { value: 'mssql', label: 'SQL Server: 1 transaction' },
  { value: 'cassandra', label: 'Cassandra: từng câu lệnh' },
  { value: 'cassandra-batch', label: 'Cassandra: logged batch' },
];
const FAIL_AT = [
  { value: 0, label: 'Không lỗi' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `Lỗi ở bước ${n}` })),
];
const stepStatus = (s) =>
  s.startsWith('ok') || s === 'đã chuẩn bị' ? 'finish' : s === 'lỗi' ? 'error' : 'wait';
const LABELS = {
  visits: 'visits',
  prescriptions: 'prescriptions',
  items: 'prescription_items',
  invoices: 'invoices',
  stock: 'Tồn kho thuốc #1',
};

export default function TransactionPanel() {
  const { message } = App.useApp();
  const [mode, setMode] = useState('mssql');
  const [failAt, setFailAt] = useState(4);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const body = {
        dbms: mode === 'mssql' ? 'mssql' : 'cassandra',
        useBatch: mode === 'cassandra-batch',
        failAt: failAt || null,
      };
      setResult((await api.post('/lab/transaction', body)).data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  const compare = result
    ? Object.keys(result.before).map((key) => ({
        key,
        table: LABELS[key] ?? key,
        before: result.before[key],
        after: result.after[key],
        changed: result.before[key] !== result.after[key],
      }))
    : [];

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>
        Quy trình khám bệnh ghi 5 bảng:{' '}
        <Typography.Text code>
          visits → prescriptions → prescription_items → medicines (trừ kho) → invoices
        </Typography.Text>
        . Chọn bước gây lỗi (bước 4 là lỗi thật: kê vượt tồn kho, vi phạm{' '}
        <Typography.Text code>CK_medicines_stock</Typography.Text>) rồi so sánh dữ liệu trước/sau. Script
        tương ứng: <Typography.Text code>demos/04-transaction</Typography.Text>.
      </Typography.Paragraph>
      <Space wrap>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Segmented options={FAIL_AT} value={failAt} onChange={setFailAt} />
        <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={run}>
          Chạy
        </Button>
      </Space>
      {result && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title={`${result.dbms} · ${result.mode}`}>
              <Steps
                orientation="vertical"
                size="small"
                items={result.steps.map((s) => ({
                  title: `${s.n}. ${s.label}`,
                  status: stepStatus(s.status),
                  content: s.error ?? `${s.status}${s.ms != null ? ` · ${s.ms} ms` : ''}`,
                }))}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Alert
                showIcon
                type={/DỞ DANG|CẢNH BÁO/.test(result.verdict) ? 'error' : 'success'}
                title={result.verdict}
              />
              <Table
                size="small"
                pagination={false}
                dataSource={compare}
                columns={[
                  { title: 'Bảng', dataIndex: 'table' },
                  { title: 'Trước', dataIndex: 'before', align: 'right' },
                  {
                    title: 'Sau',
                    dataIndex: 'after',
                    align: 'right',
                    render: (v, r) => (
                      <Typography.Text type={r.changed ? 'danger' : undefined} strong={r.changed}>
                        {v}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            </Space>
          </Col>
        </Row>
      )}
    </Space>
  );
}
