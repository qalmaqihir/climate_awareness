export interface RetrievedDoc {
  id: number;
  title: string;
  content: string;
  district: string | null;
  eventType: string;
  severity: string;
  sourceUrl: string | null;
  reportedAt: string;
  affectedCount: number | null;
  similarity: number;
}

export interface Citation {
  id: number;
  title: string;
  district: string | null;
  eventType: string;
  reportedAt: string;
  sourceUrl: string | null;
  similarity: number;
}

export interface SSEEvent {
  type: 'token' | 'citations' | 'done' | 'error' | 'blocked';
  content?: string;
  docs?: Citation[];
  model?: string;
  remaining?: number;
  message?: string;
}
