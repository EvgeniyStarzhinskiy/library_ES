export interface User {
  id: number;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  oauth_provider: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}