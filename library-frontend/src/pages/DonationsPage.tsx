import { useState, useEffect } from 'react';
import { Table, Typography, Spin, Empty } from 'antd';
import apiClient from '../api/client';

const { Title } = Typography;

interface Donation {
  id: number;
  amount: number;
  transaction_id: string;
  donated_at: string;
}

const DonationsPage: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/donations')
      .then(res => setDonations(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: 'Дата', dataIndex: 'donated_at', key: 'date', render: (d: string) => new Date(d).toLocaleString('ru') },
    { title: 'Сумма', dataIndex: 'amount', key: 'amount', render: (a: number) => `${a} ₽` },
    { title: 'ID транзакции', dataIndex: 'transaction_id', key: 'txn' },
  ];

  return (
    <div>
      <Title level={2}>История пожертвований</Title>
      <Spin spinning={loading}>
        {donations.length > 0 ? (
          <Table dataSource={donations} columns={columns} rowKey="id" />
        ) : (
          <Empty description="Вы ещё не делали пожертвований" />
        )}
      </Spin>
    </div>
  );
};

export default DonationsPage;