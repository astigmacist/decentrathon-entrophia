'use client';

import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { getHealth } from '@/lib/api';
import { useRole } from '@/hooks/useRole';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useI18nStore } from '@/store/i18n-store';
import { shortenAddress } from '@/lib/solana';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const NAV_LINKS = [
  { href: '/', key: 'nav.home', roles: ['investor', 'issuer', 'verifier', 'admin', 'unknown'] },
  { href: '/marketplace', key: 'nav.marketplace', roles: ['investor', 'issuer', 'verifier', 'admin', 'unknown'] },
  { href: '/portfolio', key: 'nav.portfolio', roles: ['investor'] },
  { href: '/submit', key: 'nav.submit', roles: ['issuer'] },
  { href: '/verifier', key: 'nav.verifier', roles: ['verifier', 'admin'] },
  { href: '/admin', key: 'nav.admin', roles: ['admin'] },
];

const ROLE_COLORS: Record<string, string> = {
  investor: 'bg-teal-500/14 text-teal-200 border-teal-500/35',
  issuer: 'bg-violet-500/14 text-violet-200 border-violet-500/35',
  verifier: 'bg-indigo-500/14 text-indigo-200 border-indigo-500/35',
  admin: 'bg-amber-500/14 text-amber-200 border-amber-500/35',
};

const WalletMultiButtonNoSSR = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((module) => module.WalletMultiButton),
  { ssr: false }
);

export function Navigation() {
  const pathname = usePathname();
  const { role, demoRole, setDemoRole } = useRole();
  const { connectedWallet, manualWallet, activeWallet, setManualWallet, clearManualWallet } = useActiveWallet();
  const { t } = useTranslation();
  const { lang, setLang } = useI18nStore();
  const [open, setOpen] = useState(false);
  const { data: health, isError, isFetching } = useQuery({
    queryKey: ['api-health'],
    queryFn: getHealth,
    refetchInterval: (query) => (query.state.error ? false : 60_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
    retry: 0,
  });

  const visible = NAV_LINKS.filter((item) => item.roles.includes(role) || item.roles.includes('unknown'));
  const healthLabel = isError ? 'API down' : health ? 'API up' : isFetching ? 'API check' : 'API unknown';
  const healthClass = isError
    ? 'border-red-500/35 bg-red-500/12 text-red-200'
    : health
    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200'
    : 'border-white/15 bg-white/5 text-slate-300';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050919]/90 backdrop-blur-xl">
        <div className="app-container flex h-[74px] items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Factora"
            className="shrink-0 transition-opacity hover:opacity-90"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/factora-logo.svg"
              alt="Factora"
              width={250}
              height={62}
              priority
              className="h-10 w-auto sm:h-11"
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {visible.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-violet-500/20 text-white'
                      : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className={cn('hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold lg:inline-flex', healthClass)}>
              {healthLabel}
            </span>

            <div className="hidden items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-2 py-1.5 lg:flex">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">x-wallet</span>
              <input
                value={manualWallet}
                onChange={(event) => setManualWallet(event.target.value)}
                placeholder={connectedWallet ?? 'enter wallet'}
                className="w-[180px] bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
              />
              {manualWallet.trim() && (
                <button
                  onClick={clearManualWallet}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-white/8 hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>

            {process.env.NODE_ENV !== 'production' && (
              <select
                value={demoRole ?? 'unknown'}
                onChange={(event) => {
                  const next = event.target.value as UserRole;
                  setDemoRole(next === 'unknown' ? null : next);
                }}
                className="hidden rounded-lg border border-white/12 bg-white/5 px-2 py-1.5 text-xs text-slate-300 outline-none lg:block"
                title="Demo role"
              >
                <option value="unknown">Demo: Auto</option>
                <option value="investor">Demo: Investor</option>
                <option value="issuer">Demo: Issuer</option>
                <option value="verifier">Demo: Verifier</option>
                <option value="admin">Demo: Admin</option>
              </select>
            )}

            <button
              onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
              className="hidden rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:block"
              title="Language"
            >
              {lang}
            </button>

            {activeWallet && role !== 'unknown' && (
              <span
                className={cn(
                  'hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize sm:inline-flex',
                  ROLE_COLORS[role] ?? 'bg-white/10 text-slate-300 border-white/20'
                )}
              >
                {role}
              </span>
            )}

            {activeWallet && (
              <span className="hidden max-w-[140px] truncate rounded-md border border-white/10 bg-white/4 px-2 py-0.5 text-[11px] font-mono text-slate-300 lg:inline-block">
                {shortenAddress(activeWallet)}
              </span>
            )}

            <WalletMultiButtonNoSSR
              style={{
                background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                borderRadius: '12px',
                height: '38px',
                padding: '0 14px',
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 8px 20px rgba(124,58,237,0.35)',
              }}
            />

            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 transition-colors hover:bg-white/5 md:hidden"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#050919]/95 backdrop-blur-xl md:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="app-container pt-24" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="rounded-xl border border-white/10 bg-white/4 p-2.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">x-wallet</p>
                <input
                  value={manualWallet}
                  onChange={(event) => setManualWallet(event.target.value)}
                  placeholder={connectedWallet ?? 'enter wallet'}
                  className="input-base py-2 text-xs"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', healthClass)}>
                    {healthLabel}
                  </span>
                  {manualWallet.trim() && (
                    <button
                      onClick={clearManualWallet}
                      className="rounded border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              {visible.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-xl px-3 py-3 text-sm font-semibold',
                      active ? 'bg-violet-500/20 text-white' : 'text-slate-300 hover:bg-white/6'
                    )}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
