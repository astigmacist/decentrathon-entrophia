import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/components/navigation';

export const metadata: Metadata = {
  title: 'RWA Receivables — Tokenized Invoice Financing on Solana',
  description:
    'Tokenize and invest in verified invoices. Real-world asset financing powered by Solana.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <Providers>
          <Navigation />
          <main className="min-h-screen pt-20">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
