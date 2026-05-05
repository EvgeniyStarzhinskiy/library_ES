import { Card, Tag, Rate, Typography } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Paragraph } = Typography;

interface DocProps {
  id: number;
  title: string;
  author?: string;
  year?: number;
  description?: string;
  file_type?: string;
  avg_rating?: number;
  preview_cloud_path?: string;
  /** Колбэк после клика (если нужна дополнительная логика) */
  onClick?: () => void;
}

const DocumentCard: React.FC<DocProps> = ({
  id,
  title,
  author,
  year,
  description,
  file_type,
  avg_rating,
  preview_cloud_path,
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/documents/${id}`);
    }
  };

  return (
    <Card
      hoverable
      onClick={handleClick}
      style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}
      bodyStyle={{ padding: 16 }}
      cover={
        preview_cloud_path ? (
          <img
            alt={title}
            src={`/library_ES/api/v1/documents/${id}/preview`}
            style={{ height: 180, objectFit: 'cover', background: '#f0f0f0' }}
          />
        ) : (
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--ant-color-bg-container-secondary, #f5f5f5)'
            }}
          >
            <FileOutlined style={{ fontSize: 48, color: 'var(--ant-color-text-quaternary, #bfbfbf)' }} />
          </div>
        )
      }
    >
      <Card.Meta
        title={title}
        description={
          <>
            {description && (
              <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                {description}
              </Paragraph>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {file_type && <Tag color="blue">{file_type.toUpperCase()}</Tag>}
              {author && <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{author}</span>}
              {year && <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>, {year}</span>}
            </div>
            {avg_rating && avg_rating > 0 && (
              <Rate disabled value={Math.round(avg_rating)} count={5} style={{ fontSize: 14 }} />
            )}
          </>
        }
      />
    </Card>
  );
};

export default DocumentCard;