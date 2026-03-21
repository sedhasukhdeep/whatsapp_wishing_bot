import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Plus, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProfile } from '@/context/ProfileContext';
import { listProfiles, createProfile, verifyProfilePin, deleteProfile } from '@/api/client';
import type { Profile } from '@/types';

export default function ProfileSelectionPage() {
  const { setProfile } = useProfile();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // PIN entry dialog
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Create profile dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  const selectProfile = (p: Profile) => {
    if (p.has_pin) {
      setPinProfile(p);
      setPin('');
      setPinError('');
    } else {
      setProfile(p);
      navigate('/dashboard', { replace: true });
    }
  };

  const submitPin = async () => {
    if (!pinProfile) return;
    setPinLoading(true);
    setPinError('');
    try {
      await verifyProfilePin(pinProfile.id, pin);
      setProfile(pinProfile);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setPinError((err as Error).message || 'Incorrect PIN.');
    } finally {
      setPinLoading(false);
    }
  };

  const submitCreate = async () => {
    if (!newName.trim()) { setCreateError('Name is required.'); return; }
    if (newPin && newPin !== newPinConfirm) { setCreateError('PINs do not match.'); return; }
    setCreateLoading(true);
    setCreateError('');
    try {
      const p = await createProfile({ name: newName.trim(), pin: newPin || undefined });
      setProfile(p);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setCreateError((err as Error).message || 'Failed to create profile.');
    } finally {
      setCreateLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      // Temporarily set the profile so the auth header is sent
      setProfile(deleteTarget);
      await deleteProfile(deleteTarget.id);
      setProfile(null);
      setDeleteTarget(null);
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err: unknown) {
      setProfile(null);
      setDeleteError((err as Error).message || 'Failed to delete profile.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            W
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Wishing Bot</div>
            <div className="text-xs text-muted-foreground">
              {profiles.length === 0 && !loading ? 'Create your profile to get started' : 'Select your profile'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm">Loading profiles…</div>
        ) : (
          <div className="space-y-2">
            {profiles.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No profiles yet. Create one to get started.
              </div>
            )}

            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  onClick={() => selectProfile(p)}
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.has_pin && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock size={10} /> PIN protected
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteError(''); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete profile"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button
              onClick={() => { setShowCreate(true); setNewName(''); setNewPin(''); setNewPinConfirm(''); setCreateError(''); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:bg-accent transition-colors text-muted-foreground text-sm"
            >
              <Plus size={14} />
              {profiles.length === 0 ? 'Create profile' : 'Add profile'}
            </button>
          </div>
        )}
      </div>

      {/* PIN dialog */}
      <Dialog open={!!pinProfile} onOpenChange={(o) => { if (!o) { setPinProfile(null); setPin(''); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter PIN — {pinProfile?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">PIN</label>
              <Input
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                autoFocus
              />
            </div>
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
            <Button className="w-full" onClick={submitPin} disabled={pinLoading || !pin}>
              {pinLoading ? 'Verifying…' : 'Continue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create profile dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>New Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Alice"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">PIN <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input
                type="password"
                placeholder="Leave blank for no PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
            </div>
            {newPin && (
              <div>
                <label className="text-sm font-medium">Confirm PIN</label>
                <Input
                  type="password"
                  placeholder="Repeat PIN"
                  value={newPinConfirm}
                  onChange={(e) => setNewPinConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
                />
              </div>
            )}
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <Button className="w-full" onClick={submitCreate} disabled={createLoading || !newName.trim()}>
              {createLoading ? 'Creating…' : 'Create Profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              Delete profile "{deleteTarget?.name}"?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive space-y-1">
              <p className="font-medium">This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-0.5 text-destructive/90">
                <li>All contacts and their occasions</li>
                <li>All message drafts and history</li>
                <li>All broadcasts</li>
                <li>All detected occasions</li>
                <li>WhatsApp targets and settings</li>
              </ul>
              <p className="font-medium mt-2">This cannot be undone.</p>
            </div>
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting…' : 'Delete everything'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
