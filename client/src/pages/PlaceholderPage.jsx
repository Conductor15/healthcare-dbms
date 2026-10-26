import { Card, Descriptions, Result } from 'antd';

/** Shown for menu items whose page has not been built yet. */
export default function PlaceholderPage({ item }) {
  return (
    <Card>
      <Result
        status="info"
        title={`${item.label}: đang phát triển`}
        subTitle="Trang này chưa được hiện thực. Xem docs/PLAN.md để biết tiến độ."
        extra={
          <Descriptions
            bordered
            size="small"
            column={1}
            style={{ maxWidth: 420, margin: '0 auto' }}
            items={[
              { key: 'fr', label: 'Chức năng', children: item.fr },
              { key: 'owner', label: 'Phụ trách', children: item.owner },
              { key: 'step', label: 'Step', children: item.step },
            ]}
          />
        }
      />
    </Card>
  );
}
