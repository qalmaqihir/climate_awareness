'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function MapPageClient() {
  return (
    <div style={{ height: 'calc(100dvh - 64px)' }} className="flex w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
            Loading map…
          </div>
        }
      >
        <MapView />
      </Suspense>
    </div>
  );
}
