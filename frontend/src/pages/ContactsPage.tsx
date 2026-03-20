import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteContact, getWaSyncPreview, importWaContacts, listContacts } from '../api/client';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import type { Contact, RelationshipType, WaSyncImportItem, WaSyncPreviewItem } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Smartphone, Upload, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const RELATIONSHIPS: RelationshipType[] = ['family', 'friend', 'colleague', 'acquaintance', 'other'];

const REL_COLORS: Record<string, string> = {
  family: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  friend: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  colleague: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  acquaintance: 'bg-muted text-muted-foreground',
  other: 'bg-muted text-muted-foreground',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [rel, setRel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const nav = useNavigate();

  // Sync dialog state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncPreview, setSyncPreview] = useState<WaSyncPreviewItem[]>([]);
  const [syncChecked, setSyncChecked] = useState<Set<string>>(new Set());
  const [syncRels, setSyncRels] = useState<Record<string, RelationshipType>>({});
  const [syncImporting, setSyncImporting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    listContacts(search, rel).then(setContacts);
  }, [search, rel]);

  async function handleDelete(c: Contact) {
    await deleteContact(c.id);
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setConfirmDelete(null);
  }

  async function openSyncDialog() {
    setSyncOpen(true);
    setSyncLoading(true);
    setSyncError('');
    setSyncPreview([]);
    setSyncResult(null);
    try {
      const preview = await getWaSyncPreview();
      setSyncPreview(preview);
      const newPhones = new Set(preview.filter((p) => !p.already_exists).map((p) => p.phone));
      setSyncChecked(newPhones);
      const rels: Record<string, RelationshipType> = {};
      preview.forEach((p) => { rels[p.phone] = 'friend'; });
      setSyncRels(rels);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Failed to load WhatsApp contacts');
    } finally {
      setSyncLoading(false);
    }
  }

  function toggleAll() {
    const newPhones = syncPreview.filter((p) => !p.already_exists).map((p) => p.phone);
    if (newPhones.every((p) => syncChecked.has(p))) {
      setSyncChecked(new Set());
    } else {
      setSyncChecked(new Set(newPhones));
    }
  }

  function toggleOne(phone: string) {
    setSyncChecked((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  async function handleSyncImport() {
    setSyncImporting(true);
    setSyncError('');
    try {
      const items: WaSyncImportItem[] = syncPreview
        .filter((p) => !p.already_exists && syncChecked.has(p.phone))
        .map((p) => ({
          phone: p.phone,
          name: p.name,
          chat_id: p.chat_id,
          relationship: syncRels[p.phone] ?? 'friend',
        }));
      const result = await importWaContacts(items);
      setSyncResult(result);
      listContacts(search, rel).then(setContacts);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSyncImporting(false);
    }
  }

  const newCount = syncPreview.filter((p) => !p.already_exists).length;
  const checkedCount = [...syncChecked].filter((phone) =>
    syncPreview.find((p) => p.phone === phone && !p.already_exists)
  ).length;
  const allNewSelected = newCount > 0 && newCount === checkedCount;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSyncDialog} className="gap-2">
            <Smartphone size={16} />
            Sync WhatsApp
          </Button>
          <Button variant="outline" onClick={() => nav('/contacts/import')} className="gap-2">
            <Upload size={16} />
            Import Calendar
          </Button>
          <Button onClick={() => nav('/contacts/new')} className="gap-2">
            <UserPlus size={16} />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-64"
        />
        <div className="flex flex-wrap gap-1.5">
          {['', ...RELATIONSHIPS].map((r) => (
            <button
              key={r}
              onClick={() => setRel(r)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                rel === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Users size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No contacts yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Add contacts manually or import from your calendar.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => nav('/contacts/import')}>Import Calendar</Button>
              <Button onClick={() => nav('/contacts/new')}>Add Contact</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {contacts.map((c) => (
            <Card key={c.id} data-testid="contact-card" className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="font-semibold text-base">{c.name}</div>
                <div className="text-sm text-muted-foreground mt-1 mb-2 flex items-center gap-2">
                  {c.phone}
                  <Badge className={cn('text-xs px-2 py-0.5 border-0', REL_COLORS[c.relationship] ?? REL_COLORS.other)}>
                    {c.relationship_label || c.relationship}
                  </Badge>
                </div>
                {c.notes && (
                  <p className="text-xs text-muted-foreground mb-2 leading-snug line-clamp-2">{c.notes}</p>
                )}
                {c.whatsapp_chat_id && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                    WhatsApp: {c.whatsapp_chat_name || c.whatsapp_chat_id}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => nav(`/contacts/${c.id}/edit`)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDelete(c)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete ${confirmDelete.name}? This will also remove all their occasions and drafts.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* WhatsApp Sync Dialog */}
      <Dialog open={syncOpen} onOpenChange={(open) => { if (!open) setSyncOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sync WhatsApp Contacts</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {syncLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 size={20} className="animate-spin" />
                Loading contacts from WhatsApp…
              </div>
            )}

            {syncError && !syncLoading && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-4">
                {syncError}
              </div>
            )}

            {syncResult && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm p-4">
                Imported {syncResult.created} contact{syncResult.created !== 1 ? 's' : ''}.
                {syncResult.skipped > 0 && ` ${syncResult.skipped} skipped (already exist).`}
              </div>
            )}

            {!syncLoading && !syncError && syncPreview.length > 0 && !syncResult && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3 w-6"></th>
                    <th className="text-left py-2 pr-3">Name</th>
                    <th className="text-left py-2 pr-3">Phone</th>
                    <th className="text-left py-2 pr-3">Relationship</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {syncPreview.map((item) => (
                    <tr key={item.phone} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={!item.already_exists && syncChecked.has(item.phone)}
                          disabled={item.already_exists}
                          onChange={() => toggleOne(item.phone)}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium">{item.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{item.phone}</td>
                      <td className="py-2 pr-3">
                        {item.already_exists ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={syncRels[item.phone] ?? 'friend'}
                            onValueChange={(v) =>
                              setSyncRels((prev) => ({ ...prev, [item.phone]: v as RelationshipType }))
                            }
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONSHIPS.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-2">
                        {item.already_exists ? (
                          <Badge className="text-xs bg-muted text-muted-foreground border-0">
                            Already imported
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                            New
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!syncLoading && !syncError && syncPreview.length === 0 && !syncResult && (
              <p className="text-center text-muted-foreground py-12 text-sm">
                No WhatsApp contacts found.
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center gap-3 pt-4 border-t mt-0">
            {!syncResult && newCount > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAll} className="mr-auto text-xs">
                {allNewSelected ? 'Deselect All' : 'Select All New'}
              </Button>
            )}
            {syncResult ? (
              <Button onClick={() => setSyncOpen(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setSyncOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSyncImport}
                  disabled={syncImporting || syncLoading || checkedCount === 0}
                >
                  {syncImporting && <Loader2 size={14} className="animate-spin mr-1" />}
                  Import {checkedCount > 0 ? checkedCount : ''} contact{checkedCount !== 1 ? 's' : ''}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
