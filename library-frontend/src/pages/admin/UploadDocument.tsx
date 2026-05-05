import { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Upload, message, Typography, Breadcrumb, Space } from 'antd';
import { UploadOutlined, HomeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

const { Title } = Typography;
const { TextArea } = Input;

const UploadDocument: React.FC = () => {
  const [form] = Form.useForm();
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/categories'),
      apiClient.get('/admin/tags')
    ]).then(([catRes, tagRes]) => {
      setCategories(catRes.data.data || []);
      setTags(tagRes.data.data || []);
    });
  }, []);

  const onFinish = async (values: any) => {
    if (fileList.length === 0) {
      message.error('Выберите файл для загрузки');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileList[0].originFileObj || fileList[0]);
    formData.append('title', values.title || '');
    formData.append('author', values.author || '');
    formData.append('year', values.year || '');
    formData.append('theme', values.theme || '');
    formData.append('publisher', values.publisher || '');
    formData.append('pages', values.pages || '');
    formData.append('description', values.description || '');
    formData.append('category_ids', JSON.stringify(values.category_ids || []));
    formData.append('tag_ids', JSON.stringify(values.tag_ids || []));

    try {
      await apiClient.post('/admin/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Документ загружен!');
      navigate('/admin');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/admin"><HomeOutlined /> Админка</Link> },
        { title: 'Загрузка документа' }
      ]} />
      
      <Title level={3}>Загрузка документа</Title>
      
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Файл" required>
            <Upload
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([file]);
                return false;
              }}
              onRemove={() => setFileList([])}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Выбрать файл</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="title" label="Название">
            <Input placeholder="Если не указано, будет взято из имени файла" />
          </Form.Item>

          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="author" label="Автор">
              <Input placeholder="Автор" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="year" label="Год">
              <InputNumber placeholder="2025" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="publisher" label="Издательство">
              <Input placeholder="Издательство" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="pages" label="Страниц">
              <InputNumber placeholder="100" style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item name="theme" label="Тематика">
            <Input placeholder="Оборудование очистки бурового раствора" />
          </Form.Item>

          <Form.Item name="category_ids" label="Категории">
            <Select mode="multiple" placeholder="Выберите категории" allowClear>
              {categories.map((cat: any) => (
                <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="tag_ids" label="Теги">
            <Select mode="multiple" placeholder="Выберите теги" allowClear>
              {tags.map((tag: any) => (
                <Select.Option key={tag.id} value={tag.id}>{tag.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <TextArea rows={4} placeholder="Описание документа" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={uploading} icon={<UploadOutlined />}>
              Загрузить
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UploadDocument;