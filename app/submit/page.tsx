'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { createAsset, uploadDocument } from '@/lib/api';
import { parseUsdc } from '@/lib/solana';
import { TxButton } from '@/components/tx-button';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubmitAssetPage() {
  const { publicKey } = useWallet();
  const router = useRouter();

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
      toast.error('Please upload at least one invoice document.');
      throw new Error('missing file');
    }

    // 1. Create asset draft
    const dueDateTs = Math.floor(new Date(form.dueDate).getTime() / 1000);
    const asset = await createAsset({
      faceValue: parseUsdc(parseFloat(form.faceValue)),
      discountBps: parseInt(form.discountBps),
      dueDateTs,
      debtorRefHash: btoa(form.debtorRef), // simple hash placeholder
      issuerWallet: publicKey.toBase58(),
    });
    setCreatedAssetId(asset.id);

    // 2. Upload document with progress simulation
    setUploadProgress(20);
    await uploadDocument(asset.id, file, 'invoice');
    setUploadProgress(100);

    toast.success('Asset submitted successfully!');
    setTimeout(() => router.push(`/asset/${asset.id}`), 1500);
  };

  if (!publicKey) {
    return (
      <GatedState message="Connect your wallet to submit an invoice asset." />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Submit Invoice Asset</h1>
        <p className="text-gray-400">
          Tokenize a verified invoice to attract investors and get liquidity early.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 space-y-6">
        {/* Face Value */}
        <FormField label="Invoice Face Value (USDC)" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              id="fv-input"
              type="number"
              min="0"
              value={form.faceValue}
              onChange={(e) => setForm((f) => ({ ...f, faceValue: e.target.value }))}
              placeholder="10000"
              className="input-base pl-7"
            />
          </div>
        </FormField>

        {/* Discount BPS */}
        <FormField label="Discount (%)" hint="Investor discount from face value. e.g. 5 = 5%">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="100"
              max="3000"
              step="25"
              value={form.discountBps}
              onChange={(e) => setForm((f) => ({ ...f, discountBps: e.target.value }))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-sm font-mono text-violet-300 w-12 text-right">
              {(parseInt(form.discountBps) / 100).toFixed(1)}%
            </span>
          </div>
          {form.faceValue && (
            <p className="text-xs text-gray-500 mt-1">
              Funding target:{' '}
              <span className="text-teal-400 font-medium">
                ${(parseFloat(form.faceValue) * (1 - parseInt(form.discountBps) / 10000)).toFixed(2)} USDC
              </span>
            </p>
          )}
        </FormField>

        {/* Due Date */}
        <FormField label="Invoice Due Date" required>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
            className="input-base"
          />
        </FormField>

        {/* Debtor Reference */}
        <FormField label="Debtor Reference" required hint="Internal reference for the debtor (will be hashed)">
          <input
            type="text"
            value={form.debtorRef}
            onChange={(e) => setForm((f) => ({ ...f, debtorRef: e.target.value }))}
            placeholder="e.g. INVOICE-2026-001 / Company Name"
            className="input-base"
          />
        </FormField>

        {/* Document Upload */}
        <FormField label="Invoice Document (PDF)" required>
          <label
            htmlFor="doc-upload"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              file
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-violet-500/5'
            }`}
          >
            {file ? (
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 text-violet-400 mx-auto mb-1" />
                <p className="text-sm text-gray-200">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-1" />
                <p className="text-sm text-gray-400">
                  Drop PDF here or <span className="text-violet-400">browse</span>
                </p>
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
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </FormField>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            Asset will be reviewed by a verifier before funding opens. All document hashes are stored on-chain.
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
          <p className="text-center text-sm text-teal-400">
            ✓ Asset created! Redirecting...
          </p>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-200 mb-1.5">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function GatedState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <p className="text-gray-300 text-lg font-medium">{message}</p>
    </div>
  );
}
