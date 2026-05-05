import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallbackPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    login('oauth_user@mail.ru', 'oauth_temp').then(() => {
      navigate('/');
    }).catch(() => {
      navigate('/login');
    });
  }, [login, navigate]);

  return <div>Авторизация через OAuth...</div>;
};

export default OAuthCallbackPage;
