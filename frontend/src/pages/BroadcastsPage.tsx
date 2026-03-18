import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBroadcast, deleteBroadcast, listBroadcasts } from '../api/client';
import type { Broadcast } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { Plus, Radio } from 'lucide-react';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOccasion, setNewOccasion] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Broadcast | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    listBroadcasts().then(setBroadcasts).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim() || !newOccasion.trim()) return;
    setCreating(true);
    try {
      const b = await createBroadcast({ name: newName.trim(), occasion_name: newOccasion.trim() });
      setBroadcasts((prev) => [b, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewOccasion('');
      nav(`/broadcasts/${b.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(b: Broadcast) {
    await deleteBroadcast(b.id);
    setBroadcasts((prev) => prev.filter((x) => x.id !== b.id));
    setConfirmDelete(null);
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Broadcasts</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus size={16} />
          New Campaign
        </Button>
      </div>

      {broadcasts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Radio size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Create a campaign to send the same message to multiple contacts.
            </p>
            <Button onClick={() => setShowCreate(true)}>New Campaign</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Occasion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => nav(`/broadcasts/${b.id}`)}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-muted-foreground">{b.occasion_name}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'sent' ? 'secondary' : 'outline'}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(b.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(b.sent_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => setConfirmDelete(b)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name *</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. New Year Wishes 2027"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Occasion *</label>
              <Input
                value={newOccasion}
                onChange={(e) => setNewOccasion(e.target.value)}
                placeholder="e.g. New Year, Diwali, Product Launch..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newOccasion.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete campaign "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
