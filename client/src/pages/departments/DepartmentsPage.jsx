// Reference CRUD page (S0.4). Copy this structure for patients/doctors/...:
// load list → Table, search box → query param, Modal + Form for create/edit, Popconfirm for delete.
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function DepartmentsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canEdit = user.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = create, row = edit
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/departments', { params: { q: q || undefined } });
      setRows(data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, message]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(values) {
    setSaving(true);
    try {
      if (editing.id) await api.put(`/departments/${editing.id}`, values);
      else await api.post('/departments', values);
      message.success(editing.id ? 'Đã cập nhật khoa' : 'Đã thêm khoa');
      setEditing(null);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    try {
      await api.delete(`/departments/${row.id}`);
      message.success(`Đã xoá khoa ${row.name}`);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  }

  const columns = [
    { title: 'Tên khoa', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name, 'vi') },
    { title: 'Vị trí', dataIndex: 'location', render: (v) => v ?? '—' },
    { title: 'Mô tả', dataIndex: 'description', ellipsis: true, render: (v) => v ?? '—' },
    {
      title: 'Số bác sĩ',
      dataIndex: 'doctorCount',
      align: 'center',
      width: 110,
      sorter: (a, b) => a.doctorCount - b.doctorCount,
      render: (n) => <Tag color={n ? 'green' : 'default'}>{n}</Tag>,
    },
    canEdit && {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row)} aria-label="Sửa" />
          <Popconfirm
            title={`Xoá khoa "${row.name}"?`}
            description={
              row.doctorCount ? 'Khoa đang có bác sĩ nên sẽ không xoá được.' : 'Không thể hoàn tác.'
            }
            okText="Xoá"
            okButtonProps={{ danger: true }}
            cancelText="Huỷ"
            onConfirm={() => remove(row)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xoá" />
          </Popconfirm>
        </Space>
      ),
    },
  ].filter(Boolean);

  return (
    <Card>
      <div className="page-toolbar">
        <Input.Search
          placeholder="Tìm theo tên khoa"
          allowClear
          enterButton
          onSearch={setQ}
          style={{ maxWidth: 360 }}
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>
            Thêm khoa
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Sửa khoa' : 'Thêm khoa'}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={saving}
        onCancel={() => setEditing(null)}
        okButtonProps={{ htmlType: 'submit' }}
        destroyOnHidden
        modalRender={(dom) => (
          <Form layout="vertical" form={form} initialValues={editing ?? {}} clearOnDestroy onFinish={save}>
            {dom}
          </Form>
        )}
      >
        <Form.Item
          name="name"
          label="Tên khoa"
          rules={[
            { required: true, message: 'Nhập tên khoa' },
            { min: 2, max: 100, message: 'Từ 2 đến 100 ký tự' },
          ]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="location" label="Vị trí" rules={[{ max: 100 }]}>
          <Input placeholder="VD: Tầng 2 - Khu A" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ max: 500 }]}>
          <Input.TextArea rows={3} showCount maxLength={500} />
        </Form.Item>
      </Modal>
    </Card>
  );
}
