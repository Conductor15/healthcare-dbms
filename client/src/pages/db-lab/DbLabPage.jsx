// Bonus: run the DBMS topic experiments from inside the application.
// Tabs i-iii belong to Dương (S3.10): replace the placeholder `children` on your own lines.
import { Card, Result, Tabs } from 'antd';
import BackupPanel from './BackupPanel.jsx';
import ConcurrencyPanel from './ConcurrencyPanel.jsx';
import TransactionPanel from './TransactionPanel.jsx';

const pending = (topic) => (
  <Result status="info" title={`${topic}: đang phát triển`} subTitle="Phụ trách: Dương · Step S3.10" />
);

const TABS = [
  { key: 'storage', label: 'i. Storage', children: pending('Data storage & management') },
  { key: 'indexing', label: 'ii. Indexing', children: pending('Indexing') },
  { key: 'query', label: 'iii. Query processing', children: pending('Query processing') },
  { key: 'transaction', label: 'iv. Transaction', children: <TransactionPanel /> },
  { key: 'concurrency', label: 'v. Concurrency', children: <ConcurrencyPanel /> },
  { key: 'backup', label: 'vi. Backup & recovery', children: <BackupPanel /> },
];

export default function DbLabPage() {
  return (
    <Card>
      <Tabs items={TABS} defaultActiveKey="transaction" destroyOnHidden />
    </Card>
  );
}
