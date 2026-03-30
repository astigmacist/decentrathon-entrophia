'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRole } from '@/hooks/useRole';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace', roles: ['investor', 'issuer', 'verifier', 'admin', 'unknown'] },
  { href: '/portfolio', label: 'Portfolio', roles: ['investor'] },
  { href: '/submit', label: 'Submit Asset', roles: ['issuer'] },
  { href: '/verifier', label: 'Verifier', roles: ['verifier', 'admin'] },
  { href: '/admin', label: 'Admin', roles: ['admin'] },
];

export function Navigation() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { role } = useRole();

  const visibleLinks = NAV_LINKS.filter((l) =>
    l.roles.includes(role) || l.roles.includes('unknown')
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-20">
        {/* Logo */}
        <Link
          href="/marketplace"
          className="flex items-center shrink-0 transition-opacity hover:opacity-90"
          aria-label="Factora"
        >
          <Image
            src="/factora-logo.svg"
            alt="Factora RWA Receivables"
            width={300}
            height={80}
            priority
            className="h-14 w-auto sm:h-16"
          />
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet + Role badge */}
        <div className="flex items-center gap-3">
          {publicKey && role !== 'unknown' && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 capitalize">
              {role}
            </span>
          )}
          <WalletMultiButton
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: '8px',
              height: '36px',
              fontSize: '13px',
              padding: '0 16px',
            }}
          />
        </div>
      </div>
    </nav>
  );
}
