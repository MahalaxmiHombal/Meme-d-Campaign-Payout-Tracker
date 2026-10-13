'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link href={user?.role === 'brand' ? '/brand' : '/creator'} className="navbar-brand">
          <div className="navbar-logo-icon">🎭</div>
          Meme&apos;d
        </Link>

        <div className="navbar-actions">
          {user && (
            <>
              <span className={`badge-role ${user.role}`}>{user.role}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                id="logout-btn"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
