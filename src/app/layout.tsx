import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WINAI | AI 跨境法律智能平台',
  description:
    'WINAI — AI-powered cross-border legal consultation platform for China and Thailand legal affairs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
