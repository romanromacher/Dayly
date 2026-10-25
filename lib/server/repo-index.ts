import type { Repo } from './repo';
import { createFileRepo } from './repo-file';
import { createSupabaseRepo } from './repo-supabase';

let repo: Repo | null = null;

export function getRepo(): Repo {
  if (repo) return repo;
  if (process.env.DATA_BACKEND === 'file') {
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
      throw new Error('DATA_BACKEND=file ist nur für die lokale Entwicklung gedacht.');
    }
    repo = createFileRepo();
  } else {
    repo = createSupabaseRepo();
  }
  return repo;
}
