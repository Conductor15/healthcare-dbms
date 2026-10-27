// S3.12: per-user, per-day API access log stored in Cassandra (partition = (user_id, day)).
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fmtTime, ROLE_LABEL, toIsoDate } from '../../utils/format.js';

const METHOD_COLOR = { GET: 'blue', POST: 'green', PUT: 'orange', PATCH: 'gold', DELETE: 'red' };
const statusColor = (s) => (s >= 500 ? 'red' : s >= 400 ? 'orange' : 'green');

export default function AccessLogsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(user.id);
  const [day, setDay] = useState(dayjs());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/lookups/users').then(({ data }) => setUsers(data));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/access-logs', { params: { userId, day: toIsoDate(day), limit: 500 } });
      setRows(data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId, day, message]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Mỗi request API được middleware ghi bất đồng bộ vào Cassandra"
        description={
          <>
            Bảng <Typography.Text code>access_logs_by_user_day</Typography.Text>, partition key{' '}
            <Typography.Text code>(user_id, day)</Typography.Text>, clustering{' '}
            <Typography.Text code>ts DESC</Typography.Text> (timeuuid), TTL 90 ngày: ghi liên tục, khối lượng
            lớn, chỉ đọc theo đúng một mẫu truy vấn.
          </>
        }
      />
      <div className="page-toolbar">
        <Space wrap>
          <Select
            value={userId}
            onChange={setUserId}
            style={{ width: 260 }}
            options={users.map((u) => ({
              value: u.id,
              label: `${u.fullName} (${u.username}, ${ROLE_LABEL[u.role]})`,
            }))}
          />
          <DatePicker
            value={day}
            onChange={(d) => setDay(d ?? dayjs())}
            allowClear={false}
            format="DD/MM/YYYY"
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Tải lại
        </Button>
      </div>
      <Table
        rowKey={(r) => `${r.at}-${r.path}`}
        size="small"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: 'Không có truy cập nào' }}
        pagination={{ pageSize: 20, showTotal: (t) => `${t} request` }}
        columns={[
          { title: 'Thời gian', dataIndex: 'at', width: 110, render: fmtTime },
          {
            title: 'Method',
            dataIndex: 'method',
            width: 90,
            render: (m) => <Tag color={METHOD_COLOR[m]}>{m}</Tag>,
          },
          {
            title: 'Đường dẫn',
            dataIndex: 'path',
            render: (p) => <Typography.Text code>{p}</Typography.Text>,
          },
          {
            title: 'Mã',
            dataIndex: 'statusCode',
            width: 80,
            render: (s) => <Tag color={statusColor(s)}>{s}</Tag>,
          },
          { title: 'IP', dataIndex: 'ip', width: 140 },
        ]}
      />
    </Card>
  );
}
