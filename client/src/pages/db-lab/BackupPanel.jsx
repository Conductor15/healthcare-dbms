// Topic vi: on-demand backups, msdb history, point-in-time restore demo.
import { CloudUploadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Row, Space, Steps, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { fmtDateTime, money } from '../../utils/format.js';

const TYPE_COLOR = { FULL: 'blue', DIFF: 'purple', LOG: 'cyan' };

export default function BackupPanel() {
  const { message } = App.useApp();
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(null);
  const [pitr, setPitr] = useState(null);

  const load = useCallback(async () => setHistory((await api.get('/lab/backups')).data), []);
  useEffect(() => {
    load();
  }, [load]);

  async function backup(type) {
    setBusy(type);
    try {
      const { data } = await api.post('/lab/backups', { type });
      message.success(`Backup ${type} xong trong ${data.ms} ms (${data.compressedMb} MB sau nén)`);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function runPitr() {
    setBusy('PITR');
    try {
      setPitr((await api.post('/lab/backups/point-in-time-demo')).data);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const priceRows = pitr
    ? pitr.final.map((m, i) => ({
        id: m.id,
        name: m.name,
        damaged: pitr.damaged[i]?.price,
        restored: pitr.restored[i]?.price,
        final: m.price,
      }))
    : [];

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>
        SQL Server ở chế độ <Typography.Text code>FULL recovery</Typography.Text>: backup full/diff/log có{' '}
        <Typography.Text code>CHECKSUM</Typography.Text> và nén; lịch tự động bằng SQL Server Agent (
        <Typography.Text code>demos/06-backup-recovery/mssql/04_agent_jobs.sql</Typography.Text>).
      </Typography.Paragraph>

      <Card
        size="small"
        title="Point-in-time restore: sự cố UPDATE quên WHERE"
        extra={
          <Button
            type="primary"
            danger
            icon={<PlayCircleOutlined />}
            loading={busy === 'PITR'}
            disabled={Boolean(busy)}
            onClick={runPitr}
          >
            Chạy kịch bản
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          Full backup → thay đổi hợp lệ (Paracetamol 1500 → 1650) →{' '}
          <Typography.Text code>UPDATE medicines SET unit_price = 0</Typography.Text> → backup log → restore{' '}
          <Typography.Text strong>bản sao</Typography.Text> với <Typography.Text code>STOPAT</Typography.Text>{' '}
          1 giây trước sự cố → sửa bảng thật từ bản sao. DB chính không phải dừng. Lưới an toàn: nếu bước nào
          lỗi, giá gốc được ghi lại ngay. Kết thúc demo, giá Paracetamol trả về như cũ.
        </Typography.Paragraph>
        {pitr && (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={10}>
              <Steps
                orientation="vertical"
                size="small"
                items={pitr.steps.map((s) => ({ title: s.label, status: 'finish', content: `${s.ms} ms` }))}
              />
            </Col>
            <Col xs={24} lg={14}>
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 12 }}
                title={`Khôi phục ${pitr.repaired.rows} dòng tại STOPAT = ${pitr.stopAt}`}
              />
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={priceRows}
                columns={[
                  { title: 'Thuốc', dataIndex: 'name' },
                  {
                    title: 'Sau sự cố',
                    dataIndex: 'damaged',
                    align: 'right',
                    render: (v) => <Typography.Text type="danger">{money(v)}</Typography.Text>,
                  },
                  { title: 'Bản khôi phục', dataIndex: 'restored', align: 'right', render: money },
                  {
                    title: 'Sau khi sửa',
                    dataIndex: 'final',
                    align: 'right',
                    render: (v) => <Typography.Text strong>{money(v)}</Typography.Text>,
                  },
                ]}
              />
            </Col>
          </Row>
        )}
      </Card>

      <Card
        size="small"
        title="Lịch sử backup (msdb.dbo.backupset)"
        extra={
          <Space wrap>
            {['FULL', 'DIFF', 'LOG'].map((t) => (
              <Button
                key={t}
                icon={<CloudUploadOutlined />}
                loading={busy === t}
                disabled={Boolean(busy)}
                onClick={() => backup(t)}
              >
                Backup {t}
              </Button>
            ))}
            <Button icon={<ReloadOutlined />} onClick={load} aria-label="Tải lại" />
          </Space>
        }
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={history}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 900 }}
          columns={[
            {
              title: 'Loại',
              dataIndex: 'type',
              width: 80,
              render: (t) => <Tag color={TYPE_COLOR[t]}>{t}</Tag>,
            },
            { title: 'Hoàn tất', dataIndex: 'finishedAt', width: 150, render: fmtDateTime },
            { title: 'Kích thước (MB)', dataIndex: 'sizeMb', align: 'right', width: 130 },
            { title: 'Sau nén (MB)', dataIndex: 'compressedMb', align: 'right', width: 120 },
            { title: 'First LSN', dataIndex: 'firstLsn' },
            { title: 'Last LSN', dataIndex: 'lastLsn' },
            { title: 'File', dataIndex: 'file', ellipsis: true },
          ]}
        />
      </Card>

      <Alert
        type="info"
        showIcon
        title="Cassandra"
        description={
          <>
            Backup Cassandra dùng <Typography.Text code>nodetool snapshot</Typography.Text> / incremental
            backup trên từng node, không chạy được qua driver CQL nên được demo bằng script:{' '}
            <Typography.Text code>node demos/06-backup-recovery/snapshot_restore.js</Typography.Text>,{' '}
            <Typography.Text code>crash_recovery.js</Typography.Text>,{' '}
            <Typography.Text code>replication_vs_backup.js</Typography.Text>.
          </>
        }
      />
    </Space>
  );
}
