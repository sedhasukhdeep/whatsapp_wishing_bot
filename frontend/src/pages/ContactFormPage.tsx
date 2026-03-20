import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createContact, deleteOccasion, getContact, updateContact } from '../api/client';
import ChatPicker from '../components/contacts/ChatPicker';
import OccasionForm from '../components/contacts/OccasionForm';
import type { ContactWithOccasions, LengthType, Occasion, RelationshipType, ToneType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TONES: { value: ToneType; label: string; desc: string }[] = [
  { value: 'warm', label: 'Warm', desc: 'Heartfelt and caring' },
  { value: 'funny', label: 'Funny', desc: 'Lighthearted with humor' },
  { value: 'formal', label: 'Formal', desc: 'Polite and professional' },
];

export default function ContactFormPage() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('friend');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [tone, setTone] = useState<ToneType>('warm');
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState<LengthType>('medium');
  const [customInstructions, setCustomInstructions] = useState('');
  const [alias, setAlias] = useState('');
  const [useAliasInBroadcast, setUseAliasInBroadcast] = useState(false);
  const [useAlias, setUseAlias] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [whatsappChatId, setWhatsappChatId] = useState<string | null>(null);
  const [whatsappChatName, setWhatsappChatName] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [showOccasionForm, setShowOccasionForm] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<Occasion | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getContact(Number(id)).then((c: ContactWithOccasions) => {
        setName(c.name); setPhone(c.phone); setRelationship(c.relationship);
        setRelationshipLabel(c.relationship_label ?? '');
        setNotes(c.notes ?? ''); setTone(c.tone_preference); setLanguage(c.language);
        setLength(c.message_length); setCustomInstructions(c.custom_instructions ?? '');
        setAlias(c.alias ?? '');
        setUseAliasInBroadcast(c.use_alias_in_broadcast);
        setUseAlias(c.use_alias);
        setAutoSend(c.auto_send);
        setWhatsappChatId(c.whatsapp_chat_id);
        setWhatsappChatName(c.whatsapp_chat_name);
        setOccasions(c.occasions);
        if (c.language !== 'en' || c.message_length !== 'medium' || c.custom_instructions) {
          setAdvancedMode(true);
        }
      });
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = {
        name, phone, relationship,
        relationship_label: (relationship === 'other' && relationshipLabel) ? relationshipLabel : null,
        alias: alias || null,
        use_alias_in_broadcast: useAliasInBroadcast,
        use_alias: useAlias,
        auto_send: autoSend,
        notes: notes || null,
        tone_preference: tone,
        language,
        message_length: length,
        custom_instructions: customInstructions || null,
        whatsapp_chat_id: whatsappChatId,
        whatsapp_chat_name: whatsappChatName,
      };
      if (isEdit) {
        await updateContact(Number(id), data);
      } else {
        await createContact(data);
      }
      nav('/contacts');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving contact');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOccasion(occ: Occasion) {
    await deleteOccasion(occ.id);
    setOccasions((prev) => prev.filter((o) => o.id !== occ.id));
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => nav('/contacts')} className="gap-1">
          <ArrowLeft size={16} />
          Back
        </Button>
        <h1 className="text-xl font-bold">{isEdit ? 'Edit Contact' : 'Add Contact'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alias <span className="text-muted-foreground font-normal">(nickname)</span></label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Maa, Bhai, Di..." />
              {alias && (
                <div className="mt-2 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={useAlias}
                      onChange={(e) => setUseAlias(e.target.checked)}
                    />
                    Use alias in AI-generated individual messages
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={useAliasInBroadcast}
                      onChange={(e) => setUseAliasInBroadcast(e.target.checked)}
                    />
                    Use alias instead of name in broadcast messages
                  </label>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone * (international format)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+919876543210" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Relationship</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(['family', 'friend', 'colleague', 'acquaintance', 'other'] as RelationshipType[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRelationship(r)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      relationship === r
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              {relationship === 'other' && (
                <div className="mt-2">
                  <Input
                    value={relationshipLabel}
                    onChange={(e) => setRelationshipLabel(e.target.value)}
                    placeholder="e.g. Mentor, Neighbour, Gym buddy..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Personal Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. loves cricket, has two kids named Arjun and Priya, big Arsenal fan..."
                className="resize-y"
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Chat */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">WhatsApp Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Link this contact to a WhatsApp chat for one-click sending.
            </p>
            <ChatPicker
              chatId={whatsappChatId}
              chatName={whatsappChatName}
              onChange={(cid, cname) => { setWhatsappChatId(cid); setWhatsappChatName(cname); }}
            />
            {whatsappChatId && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                />
                <span>
                  Send immediately when approved{' '}
                  <span className="text-muted-foreground font-normal">(Approve button becomes "Approve & Send")</span>
                </span>
              </label>
            )}
          </CardContent>
        </Card>

        {/* Message Preferences */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Message Preferences</CardTitle>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdvancedMode(false)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium border-0 cursor-pointer transition-colors',
                    !advancedMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancedMode(true)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium border-0 cursor-pointer transition-colors',
                    advancedMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  Advanced
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={cn(
                      'p-3 rounded-lg border text-left cursor-pointer transition-colors',
                      tone === t.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-accent'
                    )}
                  >
                    <div className="font-semibold text-xs mb-0.5">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {advancedMode && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message Length</label>
                  <div className="flex gap-4">
                    {(['short', 'medium', 'long'] as LengthType[]).map((l) => (
                      <label key={l} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={length === l} onChange={() => setLength(l)} />
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Custom AI Instructions</label>
                  <Textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={2}
                    placeholder="e.g. Always end with a Punjabi phrase. Mention their pet dog Bruno."
                    className="resize-y"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Occasions */}
        {isEdit && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Occasions</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingOccasion(undefined); setShowOccasionForm(true); }}
                  className="gap-1"
                >
                  <Plus size={14} />
                  Add Occasion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {occasions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No occasions yet.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {occasions.map((occ) => (
                        <TableRow key={occ.id}>
                          <TableCell className="font-medium">{occ.label || occ.type}</TableCell>
                          <TableCell>{MONTHS[occ.month]} {occ.day}</TableCell>
                          <TableCell>{occ.year ?? '—'}</TableCell>
                          <TableCell>{occ.active ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => { setEditingOccasion(occ); setShowOccasionForm(true); }}>
                                Edit
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                                onClick={() => handleDeleteOccasion(occ)}>
                                Del
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isEdit && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Save the contact first, then add occasions from the edit screen.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => nav('/contacts')}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Contact'}</Button>
        </div>
      </form>

      {showOccasionForm && (
        <OccasionForm
          contactId={Number(id)}
          occasion={editingOccasion}
          onSave={(saved) => {
            setOccasions((prev) => {
              const idx = prev.findIndex((o) => o.id === saved.id);
              return idx >= 0 ? prev.map((o) => o.id === saved.id ? saved : o) : [...prev, saved];
            });
            setShowOccasionForm(false);
          }}
          onCancel={() => setShowOccasionForm(false)}
        />
      )}
    </div>
  );
}
