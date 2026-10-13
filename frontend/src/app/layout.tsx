import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: "Meme'd — Campaign Payout Tracker",
  description: 'Creator marketplace where brands run campaigns and creators earn through milestone-based payouts',
  keywords: ['meme', 'creator marketplace', 'campaign', 'payout', 'influencer'],
  openGraph: {
    title: "Meme'd — Campaign Payout Tracker",
    description: 'Creator marketplace for milestone-based campaign payouts',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#16161f',
                color: '#f1f0f7',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '0.875rem',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#0a0a0f' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#0a0a0f' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
