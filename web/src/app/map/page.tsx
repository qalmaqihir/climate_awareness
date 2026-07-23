import type { Metadata } from 'next';
import MapPageClient from './MapPageClient';

export const metadata: Metadata = {
  title: 'Impact Map',
  description:
    'Interactive map of verified GLOF, flood, landslide, and infrastructure-damage events across Gilgit-Baltistan.',
};

export default function MapPage() {
  return <MapPageClient />;
}
