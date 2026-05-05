import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/MainLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import CategoryPage from './pages/CategoryPage';
import DocumentPage from './pages/DocumentPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UploadDocument from './pages/admin/UploadDocument';
import SearchResultsPage from './pages/SearchResultsPage';
import CategoryManager from './pages/admin/CategoryManager';
import ProfilePage from './pages/ProfilePage';
import FavoritesPage from './pages/FavoritesPage';
import DonationsPage from './pages/DonationsPage';
import BrowsePage from './pages/BrowsePage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';

import { Spin } from 'antd';

const queryClient = new QueryClient();

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/library_ES">
        <AuthProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/admin/categories" element={<AdminRoute><CategoryManager /></AdminRoute>} />
              <Route path="/admin/categories/v2" element={<AdminRoute><AdminCategoriesPage /></AdminRoute>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/favorites" element={<FavoritesPage />} />
              <Route path="/profile/donations" element={<DonationsPage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/documents/:id" element={<DocumentPage />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/documents/upload" element={<AdminRoute><UploadDocument /></AdminRoute>} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;