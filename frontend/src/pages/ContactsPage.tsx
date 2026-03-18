import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteContact, listContacts } from '../api/client';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import type { Contact, RelationshipType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, UserPlus, Users } from 'lucide-react';
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

  useEffect(() => {
    listContacts(search, rel).then(setContacts);
  }, [search, rel]);

  async function handleDelete(c: Contact) {
    await deleteContact(c.id);
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setConfirmDelete(null);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
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
    </div>
  );
}
