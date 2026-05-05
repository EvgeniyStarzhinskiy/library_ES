import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setTokens } from '../api/client';
import { useAuth } from '../context/AuthContext';

const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const access = searchParams.get('access_token');
    const refresh = searchParams.get('refresh_token');
    if (access && refresh) {
      setTokens(access, refresh);
      navigate('/');
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return null;
};

export default OAuthCallbackPage;