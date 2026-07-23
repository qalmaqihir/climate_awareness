import type { Metadata } from 'next';
import AskPageClient from './AskPageClient';

export const metadata: Metadata = {
  title: 'Ask the Data',
  description:
    'AI-powered Q&A over verified GLOF and flood events in Gilgit-Baltistan. Answers grounded in real event data — no hallucination.',
};

export default function AskPage() {
  return <AskPageClient />;
}
