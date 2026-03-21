import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProfile } from '@/context/ProfileContext';
import { listProfiles, createProfile, verifyProfilePin } from '@/api/client';
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
            <div className="text-xs text-muted-foreground">Select your profile</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm">Loading profiles…</div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProfile(p)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
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
            ))}

            <button
              onClick={() => { setShowCreate(true); setNewName(''); setNewPin(''); setNewPinConfirm(''); setCreateError(''); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border hover:bg-accent transition-colors text-muted-foreground text-sm"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Plus size={16} />
              </div>
              Add profile
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
    </div>
  );
}
