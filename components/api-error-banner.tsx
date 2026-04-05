'use client';

import { useEffect, useState } from 'react';
import { Copy, XCircle } from 'lucide-react';
import { subscribeApiErrors, type ApiErrorInfo } from '@/lib/api';
import { toast } from 'sonner';

export function ApiErrorBanner() {
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    return subscribeApiErrors((incoming) => {
      setError(incoming);
    });
  }, []);

  if (!error) return null;

  return (
    <div className="app-container mt-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
        <XCircle className="h-4 w-4 shrink-0" />
        <span className="font-semibold">{error.message}</span>
        {error.code && <span className="text-red-200/90">({error.code})</span>}
        {error.traceId && (
          <>
            <span className="text-red-200/90">traceId: {error.traceId}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(error.traceId ?? '');
                toast.success('traceId copied');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-red-300/40 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </>
        )}
        <button
          onClick={() => setError(null)}
          className="ml-auto rounded-md border border-red-300/35 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
        >
          Close
        </button>
      </div>
    </div>
  );
}
