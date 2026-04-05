'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Coins,
  FileCheck2,
  Globe2,
  Lock,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatUsdc } from '@/lib/solana';
import { MOCK_STATS } from '@/lib/mock-data';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function LandingPage() {
  const { t } = useTranslation();
  const stats = MOCK_STATS;

  const steps = [
    {
      number: '01',
      icon: <FileCheck2 className="h-5 w-5 text-slate-200" />,
      title: t('steps.upload.title'),
      description: t('steps.upload.desc'),
    },
    {
      number: '02',
      icon: <ShieldCheck className="h-5 w-5 text-slate-200" />,
      title: t('steps.verify.title'),
      description: t('steps.verify.desc'),
    },
    {
      number: '03',
      icon: <TrendingUp className="h-5 w-5 text-slate-200" />,
      title: t('steps.fund.title'),
      description: t('steps.fund.desc'),
    },
    {
      number: '04',
      icon: <Coins className="h-5 w-5 text-slate-200" />,
      title: t('steps.settle.title'),
      description: t('steps.settle.desc'),
    },
  ];

  const roles = [
    {
      icon: <Wallet className="h-4 w-4 text-slate-300" />,
      title: 'Issuer',
      description: 'Creates invoice-backed assets and receives liquidity before maturity.',
    },
    {
      icon: <ShieldCheck className="h-4 w-4 text-slate-300" />,
      title: 'Verifier',
      description: 'Reviews evidence and approves assets for marketplace funding.',
    },
    {
      icon: <BarChart3 className="h-4 w-4 text-slate-300" />,
      title: 'Investor',
      description: 'Buys fractional exposure and tracks claimable payouts.',
    },
    {
      icon: <CalendarClock className="h-4 w-4 text-slate-300" />,
      title: 'Settlement Operator',
      description: 'Records repayment and finalizes lifecycle events.',
    },
  ];

  const capabilities = [
    {
      icon: <Globe2 className="h-5 w-5 text-slate-300" />,
      title: t('features.f1.title'),
      description: t('features.f1.desc'),
    },
    {
      icon: <Lock className="h-5 w-5 text-slate-300" />,
      title: t('features.f2.title'),
      description: t('features.f2.desc'),
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-slate-300" />,
      title: t('features.f3.title'),
      description: t('features.f3.desc'),
    },
    {
      icon: <CalendarClock className="h-5 w-5 text-slate-300" />,
      title: t('features.f4.title'),
      description: t('features.f4.desc'),
    },
  ];

  return (
    <div className="page-wrap">
      <section className="app-container section-space">
        <div className="panel p-6 sm:p-8 lg:p-10">
          <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {t('hero.title1')}
                <span className="mt-2 block text-slate-200">{t('hero.title2')}</span>
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">{t('hero.desc')}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/marketplace" className="btn-primary">
                  {t('hero.exploreMarketplace')} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/submit" className="btn-secondary">
                  {t('hero.submitInvoice')}
                </Link>
              </div>
            </div>

            <aside className="panel-soft p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Snapshot</p>
              <div className="mt-4 space-y-2">
                <SnapshotRow label="Invoice face value" value="$10,000" />
                <SnapshotRow label="Issuer receives now" value="$9,500" />
                <SnapshotRow label="Investor payout at maturity" value="$10,000" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="app-container section-space">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('common.totalAssets')} value={stats.totalAssets.toString()} />
          <StatCard label={t('common.activeFunding')} value={stats.activeFunding.toString()} />
          <StatCard label={t('common.totalVolume')} value={`$${formatUsdc(stats.totalVolume)}`} />
          <StatCard label={t('common.investors')} value={stats.totalInvestors.toString()} />
        </div>
      </section>

      <section className="app-container section-space">
        <SectionHeader
          eyebrow={t('howItWorks.eyebrow')}
          title={t('howItWorks.title')}
          description={t('howItWorks.desc')}
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <StepCard
              key={step.number}
              number={step.number}
              icon={step.icon}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </section>

      <section className="app-container section-space">
        <SectionHeader
          eyebrow="Participants"
          title="Who Uses Factora"
          description="Each role has a clear workflow in the interface: submit, verify, fund, settle, and claim."
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roles.map((role) => (
            <InfoCard
              key={role.title}
              icon={role.icon}
              title={role.title}
              description={role.description}
            />
          ))}
        </div>
      </section>

      <section className="app-container section-space">
        <SectionHeader
          eyebrow={t('features.eyebrow')}
          title={t('features.title')}
          description={t('features.desc')}
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {capabilities.map((item) => (
            <InfoCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </section>

      <section className="app-container section-space">
        <div className="panel p-6 text-center sm:p-8">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            {t('cta.title1')}
            <span className="block text-slate-200">{t('cta.title2')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{t('cta.desc')}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/marketplace" className="btn-primary">
              {t('cta.openMarketplace')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/submit" className="btn-secondary">
              {t('cta.submitInvoice')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="app-container section-space border-t border-white/10 pt-6">
        <div className="flex flex-col items-center justify-between gap-3 pb-3 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-slate-500">{t('common.footer')}</p>
          <span className="text-sm text-slate-500">{t('common.devnet')}</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h2>
      <p className="text-base leading-8 text-slate-400 sm:text-lg">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{value}</p>
    </div>
  );
}

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="glass glass-hover p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="step-badge">{number}</span>
        <div className="rounded-xl border border-white/10 bg-white/4 p-2">{icon}</div>
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>
    </article>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="glass glass-hover p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl border border-white/10 bg-white/4 p-2.5">{icon}</div>
        <div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-base leading-8 text-slate-400">{description}</p>
        </div>
      </div>
    </article>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
