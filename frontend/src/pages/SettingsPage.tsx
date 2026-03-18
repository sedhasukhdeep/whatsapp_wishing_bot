import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { getAISettings, getAIStatus, getWaChats, updateAISettings } from '../api/client';
import type { WaChat } from '../api/client';
import type { AISettings, AIStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const CLAUDE_MODELS = [
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (default, fast)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast, cheap)' },
  { value: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'o4-mini', label: 'o4-mini (reasoning)' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (default, fast)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (balanced)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (most capable)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

const AI_PROVIDERS = [
  { value: 'auto', label: 'Auto (local first, fall back to Claude)' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'local', label: 'Local only (LM Studio / Ollama)' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI form state
  const [aiProvider, setAiProvider] = useState('auto');
  const [apiKey, setApiKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-3-5-haiku-20241022');
  const [showKey, setShowKey] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [localAiUrl, setLocalAiUrl] = useState('http://localhost:1234/v1');
  const [localAiModel, setLocalAiModel] = useState('');

  // Giphy form state
  const [giphyKey, setGiphyKey] = useState('');
  const [showGiphyKey, setShowGiphyKey] = useState(false);

  // Admin WA form state
  const [adminChatId, setAdminChatId] = useState('');
  const [adminChatName, setAdminChatName] = useState('');
  const [adminNotificationsEnabled, setAdminNotificationsEnabled] = useState(false);
  const [waChats, setWaChats] = useState<WaChat[]>([]);
  const [waChatsLoading, setWaChatsLoading] = useState(false);

  useEffect(() => {
    Promise.all([getAISettings(), getAIStatus()])
      .then(([s, st]) => {
        setSettings(s);
        setStatus(st);
        setAiProvider(s.ai_provider);
        setClaudeModel(s.claude_model);
        setOpenaiModel(s.openai_model);
        setGeminiModel(s.gemini_model);
        setLocalAiUrl(s.local_ai_url);
        setLocalAiModel(s.local_ai_model);
        setAdminChatId(s.admin_wa_chat_id ?? '');
        setAdminChatName(s.admin_wa_chat_name ?? '');
        setAdminNotificationsEnabled(s.admin_notifications_enabled);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadWaChats = async () => {
    setWaChatsLoading(true);
    try {
      const chats = await getWaChats();
      setWaChats(chats);
    } catch {
      // Bridge not connected — ok, user can type chat_id manually
    } finally {
      setWaChatsLoading(false);
    }
  };

  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const st = await getAIStatus();
      setStatus(st);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAISettings({
        ai_provider: aiProvider,
        anthropic_api_key: apiKey !== '' ? apiKey : null,
        claude_model: claudeModel,
        openai_api_key: openaiApiKey !== '' ? openaiApiKey : null,
        openai_model: openaiModel,
        gemini_api_key: geminiApiKey !== '' ? geminiApiKey : null,
        gemini_model: geminiModel,
        local_ai_url: localAiUrl,
        local_ai_model: localAiModel,
        giphy_api_key: giphyKey !== '' ? giphyKey : null,
        admin_wa_chat_id: adminChatId !== '' ? adminChatId : null,
        admin_wa_chat_name: adminChatName !== '' ? adminChatName : null,
        admin_notifications_enabled: adminNotificationsEnabled,
      });
      setSettings(updated);
      setApiKey('');
      setOpenaiApiKey('');
      setGeminiApiKey('');
      setGiphyKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const st = await getAIStatus();
      setStatus(st);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const showClaudeFields = aiProvider === 'claude' || aiProvider === 'auto';
  const showOpenAIFields = aiProvider === 'openai';
  const showGeminiFields = aiProvider === 'gemini';
  const showLocalFields = aiProvider === 'local' || aiProvider === 'auto';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI provider, Giphy, and admin WhatsApp notifications.
          Settings saved here override environment variables.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Current Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={refreshStatus} disabled={statusLoading}>
              <RefreshCw size={14} className={statusLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status ? (
            <>
              <StatusRow label="Active provider" value={status.active_provider} ok={true} />
              <StatusRow
                label="Claude"
                value={status.claude_configured ? `Configured — ${status.claude_model}` : 'No API key'}
                ok={status.claude_configured}
              />
              <StatusRow
                label="OpenAI"
                value={status.openai_configured ? `Configured — ${status.openai_model}` : 'No API key'}
                ok={status.openai_configured}
              />
              <StatusRow
                label="Gemini"
                value={status.gemini_configured ? `Configured — ${status.gemini_model}` : 'No API key'}
                ok={status.gemini_configured}
              />
              <StatusRow
                label="Local AI"
                value={status.local_available ? `Available — ${status.local_model}` : 'Not reachable'}
                ok={status.local_available}
              />
            </>
          ) : (
            <p className="text-muted-foreground">Status unavailable</p>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="AI Provider" description="Which AI backend to use for generating messages.">
            <Select value={aiProvider} onValueChange={setAiProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {showClaudeFields && (
            <>
              <Field
                label="Anthropic API Key"
                description={
                  settings?.anthropic_api_key_masked
                    ? `Current key: ${settings.anthropic_api_key_masked}. Leave blank to keep unchanged.`
                    : 'No API key set. Paste your key from console.anthropic.com.'
                }
              >
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={settings?.anthropic_api_key_masked ?? 'sk-ant-...'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              <Field label="Claude Model" description="Model used when Claude is the active provider.">
                <Select value={claudeModel} onValueChange={setClaudeModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAUDE_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {showOpenAIFields && (
            <>
              <Field
                label="OpenAI API Key"
                description={
                  settings?.openai_api_key_masked
                    ? `Current key: ${settings.openai_api_key_masked}. Leave blank to keep unchanged.`
                    : 'No API key set. Paste your key from platform.openai.com.'
                }
              >
                <div className="relative">
                  <Input
                    type={showOpenaiKey ? 'text' : 'password'}
                    placeholder={settings?.openai_api_key_masked ?? 'sk-...'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOpenaiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              <Field label="OpenAI Model" description="Model used when OpenAI is the active provider.">
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {showGeminiFields && (
            <>
              <Field
                label="Gemini API Key"
                description={
                  settings?.gemini_api_key_masked
                    ? `Current key: ${settings.gemini_api_key_masked}. Leave blank to keep unchanged.`
                    : 'No API key set. Paste your key from aistudio.google.com.'
                }
              >
                <div className="relative">
                  <Input
                    type={showGeminiKey ? 'text' : 'password'}
                    placeholder={settings?.gemini_api_key_masked ?? 'AIza...'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              <Field label="Gemini Model" description="Model used when Gemini is the active provider.">
                <Select value={geminiModel} onValueChange={setGeminiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {showLocalFields && (
            <>
              <Field
                label="Local AI Endpoint URL"
                description="OpenAI-compatible base URL. LM Studio default: http://localhost:1234/v1"
              >
                <Input
                  value={localAiUrl}
                  onChange={(e) => setLocalAiUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                  className="font-mono text-sm"
                />
              </Field>

              <Field
                label="Local Model Name"
                description="Leave blank to auto-detect the first loaded model."
              >
                <Input
                  value={localAiModel}
                  onChange={(e) => setLocalAiModel(e.target.value)}
                  placeholder="auto-detect"
                  className="font-mono text-sm"
                />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      {/* Giphy Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Giphy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="Giphy API Key"
            description={
              settings?.giphy_api_key_masked
                ? `Current key: ${settings.giphy_api_key_masked}. Leave blank to keep unchanged.`
                : 'No key set. Get a free key at developers.giphy.com.'
            }
          >
            <div className="relative">
              <Input
                type={showGiphyKey ? 'text' : 'password'}
                placeholder={settings?.giphy_api_key_masked ?? 'Paste Giphy API key…'}
                value={giphyKey}
                onChange={(e) => setGiphyKey(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowGiphyKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showGiphyKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Admin WhatsApp Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Admin WhatsApp Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="Admin WhatsApp Chat"
            description="This chat receives daily summaries and accepts bot commands (approve, send, skip, etc.)."
          >
            <div className="space-y-2">
              {waChats.length > 0 ? (
                <Select
                  value={adminChatId}
                  onValueChange={(val) => {
                    const chat = waChats.find((c) => c.id === val);
                    setAdminChatId(val);
                    if (chat) setAdminChatName(chat.name);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a chat…" />
                  </SelectTrigger>
                  <SelectContent>
                    {waChats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={adminChatId}
                  onChange={(e) => setAdminChatId(e.target.value)}
                  placeholder="e.g. 911234567890@c.us"
                  className="font-mono text-sm"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadWaChats}
                disabled={waChatsLoading}
              >
                {waChatsLoading ? 'Loading…' : waChats.length > 0 ? 'Refresh chats' : 'Load chats from WhatsApp'}
              </Button>
              {settings?.admin_wa_chat_name && adminChatId === settings.admin_wa_chat_id && (
                <p className="text-xs text-muted-foreground">Currently set to: {settings.admin_wa_chat_name}</p>
              )}
            </div>
          </Field>

          <div className="flex items-center gap-3">
            <Switch
              id="admin-notifications"
              checked={adminNotificationsEnabled}
              onCheckedChange={setAdminNotificationsEnabled}
            />
            <label htmlFor="admin-notifications" className="text-sm font-medium cursor-pointer">
              Enable daily notifications
            </label>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Bot commands</p>
            <p><code>list</code> — today's drafts</p>
            <p><code>approve &lt;id&gt;</code></p>
            <p><code>send &lt;id&gt;</code></p>
            <p><code>skip &lt;id&gt;</code></p>
            <p><code>regenerate &lt;id&gt;</code></p>
            <p><code>upcoming</code></p>
            <p><code>help</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 font-medium ${ok ? '' : 'text-amber-600 dark:text-amber-400'}`}>
        {ok
          ? <CheckCircle2 size={12} className="text-green-500" />
          : <AlertCircle size={12} />
        }
        {value}
      </span>
    </div>
  );
}
