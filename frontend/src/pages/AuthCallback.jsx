import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/');
      return;
    }

    const exchangeSession = async () => {
      try {
        const res = await axios.post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true });
        updateUser(res.data);
        if (res.data.is_first_login || !res.data.role) {
          navigate('/select-role', { state: { user: res.data } });
        } else {
          navigate('/dashboard', { state: { user: res.data } });
        }
      } catch (err) {
        console.error('Auth exchange failed:', err);
        navigate('/');
      }
    };

    exchangeSession();
  }, [navigate, updateUser]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDFCDC' }}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full animate-pulse" style={{ background: '#FFD166' }} />
        <p className="text-lg font-nunito" style={{ color: '#073B4C' }}>Signing you in...</p>
      </div>
    </div>
  );
}
