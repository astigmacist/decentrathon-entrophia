import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/components/navigation';
import { ApiErrorBanner } from '@/components/api-error-banner';

export const metadata: Metadata = {
  title: 'Factora — Tokenized Invoice Financing on Solana',
  description:
    'Factora turns verified invoices into Solana tokens. Businesses get liquidity early. Investors earn real-world yield.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col text-slate-50">
            <Navigation />
            <ApiErrorBanner />
            <main className="flex-1 w-full overflow-x-clip">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
