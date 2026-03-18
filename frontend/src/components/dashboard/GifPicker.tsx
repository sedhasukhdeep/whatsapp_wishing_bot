import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { searchGifs } from '@/api/client';
import type { GiphyResult } from '@/types';

interface Props {
  onSelect: (mp4Url: string, previewUrl: string) => void;
  onCancel: () => void;
}

export default function GifPicker({ onSelect, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const json = await searchGifs(query);
      setResults(json.data ?? []);
      if ((json.data ?? []).length === 0) setError('No GIFs found.');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.includes('not configured')) {
        setError('Giphy API key not configured — set it in Settings');
      } else {
        setError('Failed to fetch GIFs.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a GIF</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Giphy..."
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          />
          <Button onClick={search} disabled={loading} className="gap-1 shrink-0">
            <Search size={14} />
            {loading ? '...' : 'Search'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
          {results.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.images.original_mp4.mp4, gif.images.fixed_height_small.url)}
              className="rounded overflow-hidden border hover:border-primary transition-colors p-0"
              title={gif.title}
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title}
                className="w-full h-20 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>

        {results.length === 0 && !loading && !error && (
          <p className="text-sm text-center text-muted-foreground py-4">Type a query and press Search.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
