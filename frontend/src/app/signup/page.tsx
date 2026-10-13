'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'brand' | 'creator'>('creator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup(name, email, password, role);
      toast.success('Account created! Welcome to Meme\'d 🎉');
      router.push('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Signup failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🎭</div>
          <div className="auth-logo-text">Meme&apos;d</div>
        </div>

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">Join the creator marketplace today</p>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">I am a...</label>
          <div className="role-selector">
            <button
              type="button"
              id="role-brand"
              className={`role-option ${role === 'brand' ? 'selected' : ''}`}
              onClick={() => setRole('brand')}
            >
              <div className="role-option-icon">🏢</div>
              <div className="role-option-label">Brand</div>
              <div className="role-option-desc">Run campaigns</div>
            </button>
            <button
              type="button"
              id="role-creator"
              className={`role-option ${role === 'creator' ? 'selected' : ''}`}
              onClick={() => setRole('creator')}
            >
              <div className="role-option-icon">🎨</div>
              <div className="role-option-label">Creator</div>
              <div className="role-option-desc">Earn through posts</div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} id="signup-form">
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              className="form-input"
              placeholder="Your name or brand name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <button
            id="signup-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <div className="auth-link">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
