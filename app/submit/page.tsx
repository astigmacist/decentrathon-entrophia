'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { createAsset, uploadDocument } from '@/lib/api';
import { parseUsdc } from '@/lib/solana';
import { sha256File, sha256Text } from '@/lib/hash';
import { useDemoStore } from '@/store/demo-store';
import { TxButton } from '@/components/tx-button';
import { Upload, AlertCircle, CheckCircle2, ArrowRight, Coins, Calendar, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { n: 1, label: 'Invoice Details' },
  { n: 2, label: 'Upload Document' },
  { n: 3, label: 'Submit' },
];

export default function SubmitAssetPage() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const createAssetDemo = useDemoStore((state) => state.createAssetDemo);
  const addDocumentDemo = useDemoStore((state) => state.addDocumentDemo);

  const [form, setForm] = useState({
    faceValue: '',
    discountBps: '500',
    dueDate: '',
    debtorRef: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!publicKey) { toast.error('Connect your wallet first'); throw new Error(); }
    if (!form.faceValue || !form.dueDate || !form.debtorRef) {
      toast.error('Please fill all required fields.');
      throw new Error('missing fields');
    }
    if (!file) {
      toast.error('Please upload an invoice document.');
      throw new Error('missing file');
    }

    const dueDateTs = Math.floor(new Date(form.dueDate).getTime() / 1000);
    const faceValue = parseUsdc(parseFloat(form.faceValue));
    const discountBps = parseInt(form.discountBps);
    const debtorRefHash = await sha256Text(form.debtorRef.trim());
    const invoiceHash = await sha256File(file);

    try {
      const asset = await createAsset({
        faceValue,
        discountBps,
        dueDateTs,
        debtorRefHash,
        issuerWallet: publicKey.toBase58(),
      });
      setCreatedAssetId(asset.id);

      setUploadProgress(20);
      await uploadDocument(asset.id, file, 'invoice');
      setUploadProgress(100);

      toast.success('Asset submitted! Awaiting verifier review.');
      setTimeout(() => router.push(`/asset/${asset.id}`), 1500);
      return;
    } catch {
      const demoAsset = createAssetDemo({
        issuerWallet: publicKey.toBase58(),
        faceValue,
        discountBps,
        dueDateTs,
        debtorRefHash,
        invoiceHash,
      });
      setCreatedAssetId(demoAsset.id);
      setUploadProgress(35);
      addDocumentDemo(demoAsset.id, file, 'invoice', invoiceHash);
      setUploadProgress(100);
      toast.success('Demo asset submitted! You can continue the flow locally.');
      setTimeout(() => router.push(`/asset/${demoAsset.id}`), 1200);
    }
  };

  if (!publicKey) {
    return (
      <div className="app-container page-wrap">
        <div className="panel mx-auto max-w-xl p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl
          bg-white/5 border border-white/10 mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Required</h1>
        <p className="text-slate-400">Connect your Solana wallet to submit an invoice asset.</p>
        </div>
      </div>
    );
  }

  const discountPct = (parseInt(form.discountBps) / 100).toFixed(1);
  const fundingTarget = form.faceValue
    ? (parseFloat(form.faceValue) * (1 - parseInt(form.discountBps) / 10000)).toFixed(2)
    : null;
  const expectedYield = form.faceValue
    ? ((parseInt(form.discountBps) / (10000 - parseInt(form.discountBps))) * 100).toFixed(2)
    : null;

  return (
    <div className="app-container page-wrap">
      <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Submit Invoice Asset</h1>
        <p className="text-slate-400 text-sm">
          Tokenize a verified invoice to attract investors and get early liquidity.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                s.n === 1 ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                : 'bg-white/4 border-white/10 text-slate-500'
              }`}>
                {s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                s.n === 1 ? 'text-slate-200' : 'text-slate-500'
              }`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="w-3 h-3 text-slate-700 mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="panel p-8 space-y-6">
        {/* Face Value */}
        <FormField
          label="Invoice Face Value (USDC)"
          required
          icon={<Coins className="w-4 h-4 text-violet-400" />}
        >
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">$</span>
            <input
              type="number"
              min="0"
              value={form.faceValue}
              onChange={(e) => setForm((f) => ({ ...f, faceValue: e.target.value }))}
              placeholder="10000"
              className="input-base pl-8"
            />
          </div>
        </FormField>

        {/* Discount BPS */}
        <FormField
          label="Investor Discount"
          hint="Discount from face value offered to investors"
          icon={<Users className="w-4 h-4 text-teal-400" />}
        >
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="100"
              max="3000"
              step="25"
              value={form.discountBps}
              onChange={(e) => setForm((f) => ({ ...f, discountBps: e.target.value }))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-base font-black text-violet-300 w-14 text-right">
              {discountPct}%
            </span>
          </div>
          {form.faceValue && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-xl bg-white/4 border border-white/6">
                <p className="text-xs text-slate-500 mb-0.5">Funding target</p>
                <p className="text-sm font-bold text-teal-300">${fundingTarget} USDC</p>
              </div>
              <div className="p-3 rounded-xl bg-white/4 border border-white/6">
                <p className="text-xs text-slate-500 mb-0.5">Investor yield</p>
                <p className="text-sm font-bold text-violet-300">{expectedYield}%</p>
              </div>
            </div>
          )}
        </FormField>

        {/* Due Date */}
        <FormField
          label="Invoice Due Date"
          required
          icon={<Calendar className="w-4 h-4 text-amber-400" />}
        >
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
            className="input-base"
          />
        </FormField>

        {/* Debtor Reference */}
        <FormField
          label="Debtor Reference"
          required
          hint="Company name or internal reference (will be hashed on-chain)"
          icon={<Users className="w-4 h-4 text-indigo-400" />}
        >
          <input
            type="text"
            value={form.debtorRef}
            onChange={(e) => setForm((f) => ({ ...f, debtorRef: e.target.value }))}
            placeholder="e.g. INVOICE-2026-001 / ACME Corp"
            className="input-base"
          />
        </FormField>

        {/* Document Upload */}
        <FormField
          label="Invoice Document (PDF)"
          required
          icon={<FileText className="w-4 h-4 text-violet-400" />}
        >
          <label
            htmlFor="doc-upload"
            className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              file
                ? 'border-violet-500/50 bg-violet-500/8'
                : 'border-white/10 bg-white/3 hover:border-violet-500/35 hover:bg-violet-500/4'
            }`}
          >
            {file ? (
              <div className="text-center px-4">
                <CheckCircle2 className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                <p className="text-sm text-slate-200 font-medium">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · PDF</p>
              </div>
            ) : (
              <div className="text-center px-4">
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  Drop PDF here or{' '}
                  <span className="text-violet-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-slate-600 mt-1">Max 10MB · PDF only</p>
              </div>
            )}
            <input
              id="doc-upload"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1">Uploading… {uploadProgress}%</p>
            </div>
          )}
        </FormField>

        {/* Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/6 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            After submission, a verifier will review your asset before funding opens.
            All document hashes are stored permanently on Solana.
          </p>
        </div>

        <TxButton
          label="Submit Asset"
          pendingLabel="Submitting to blockchain..."
          onAction={handleSubmit}
          className="w-full justify-center"
          size="lg"
        />

      {createdAssetId && (
          <p className="text-center text-sm text-teal-400 font-medium">
            ✓ Asset created! Redirecting…
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-1.5">
        {icon}
        {label}
        {required && <span className="text-violet-400 text-xs">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      {children}
    </div>
  );
}
