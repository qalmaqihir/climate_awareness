import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Impact Map',
  description:
    'Interactive map of verified GLOF, flood, landslide, and infrastructure-damage events across Gilgit-Baltistan.',
};

// SSR disabled — MapLibre GL requires browser APIs
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return (
    <div style={{ height: 'calc(100dvh - 64px)' }} className="flex w-full overflow-hidden">
      <MapView />
    </div>
  );
}
