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
          <Descriptions bordered size="small" column={1} style={{ maxWidth: 420, margin: '0 auto' }}>
            <Descriptions.Item label="Chức năng">{item.fr}</Descriptions.Item>
            <Descriptions.Item label="Phụ trách">{item.owner}</Descriptions.Item>
            <Descriptions.Item label="Step">{item.step}</Descriptions.Item>
          </Descriptions>
        }
      />
    </Card>
  );
}
