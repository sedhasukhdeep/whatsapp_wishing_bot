import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBridgeStatus } from '../api/client';
import type { BridgeStatus } from '../types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_SEEN_KEY = 'wishing_bot_tour_seen';

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Wishing Bot',
    subtitle: 'Your personal AI assistant for sending heartfelt greetings on WhatsApp.',
  },
  {
    title: 'Connect WhatsApp',
    subtitle: 'Scan the QR code with your WhatsApp to enable sending messages.',
  },
  {
    title: 'Add Contacts & Occasions',
    subtitle: 'Add people you care about and set up their birthdays, anniversaries, and more.',
  },
  {
    title: 'The Dashboard',
    subtitle: 'Review AI-drafted messages each day, then send with one click.',
  },
  {
    title: 'Calendar, History & Broadcasts',
    subtitle: 'Visualise upcoming occasions, browse sent messages, and send group blasts.',
  },
  {
    title: 'Settings',
    subtitle: 'Configure your AI provider, Giphy GIFs, and WhatsApp admin notifications.',
  },
  {
    title: "You're all set!",
    subtitle: 'Everything you need to never miss another occasion.',
  },
];

export default function OnboardingWizard({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const nav = useNavigate();

  function dismiss() {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
    onDismiss();
  }

  async function checkBridge() {
    setChecking(true);
    try {
      const status = await getBridgeStatus();
      setBridgeStatus(status);
    } catch {
      setBridgeStatus({ ready: false, qr_image: null });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (step === 1) checkBridge();
  }, [step]);

  useEffect(() => {
    if (step !== 1) return;
    const timer = setInterval(checkBridge, 4000);
    return () => clearInterval(timer);
  }, [step]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground rounded-xl p-8 w-[500px] max-w-[95%] shadow-2xl border relative">
        {/* Close / skip button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X size={18} />
        </button>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i === step ? 'bg-primary' : i < step ? 'bg-emerald-500' : 'bg-border'
              )}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold mb-1">{STEPS[step].title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{STEPS[step].subtitle}</p>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div>
            <div className="rounded-lg bg-muted/50 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">🤖</span>
                <div>
                  <div className="font-medium">AI-generated drafts</div>
                  <div className="text-muted-foreground">Every morning, Claude writes personalised messages for today's occasions.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">👀</span>
                <div>
                  <div className="font-medium">You stay in control</div>
                  <div className="text-muted-foreground">Review, edit, or skip each draft from the Dashboard before anything is sent.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <div className="font-medium">One-click WhatsApp delivery</div>
                  <div className="text-muted-foreground">Approved messages are sent via your own WhatsApp account — no third-party services.</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={dismiss}>Skip tour</Button>
              <Button onClick={() => setStep(1)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 1: Connect WhatsApp */}
        {step === 1 && (
          <div>
            {bridgeStatus?.ready ? (
              <div className="text-center p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <div className="font-semibold mb-1">WhatsApp Connected</div>
                <div className="text-sm text-muted-foreground">Your WhatsApp is connected and ready.</div>
              </div>
            ) : bridgeStatus?.qr_image ? (
              <div className="text-center">
                <p className="text-sm text-foreground mb-3">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
                <img src={bridgeStatus.qr_image} alt="WhatsApp QR Code" className="max-w-[200px] mx-auto rounded-lg border" />
                <p className="text-xs text-muted-foreground mt-2">Refreshing automatically...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                {checking ? (
                  <p className="text-muted-foreground text-sm">Connecting to WhatsApp bridge...</p>
                ) : (
                  <div>
                    <p className="text-destructive text-sm mb-3">
                      WhatsApp bridge is not running. Start the app with{' '}
                      <code className="bg-muted px-1 rounded">./start.sh</code>
                    </p>
                    <Button variant="outline" size="sm" onClick={checkBridge}>Retry</Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
              <Button onClick={() => setStep(2)} disabled={!bridgeStatus?.ready}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Add Contacts & Occasions */}
        {step === 2 && (
          <div>
            <div className="rounded-lg bg-muted/50 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">👤</span>
                <div>
                  <div className="font-medium">Contacts page</div>
                  <div className="text-muted-foreground">Add name, phone number, relationship, and a short "about" note so the AI can personalise messages.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🎂</span>
                <div>
                  <div className="font-medium">Occasion types</div>
                  <div className="text-muted-foreground">Birthday, anniversary, work anniversary, custom — you can add multiple occasions per contact.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📲</span>
                <div>
                  <div className="font-medium">Link WhatsApp chat</div>
                  <div className="text-muted-foreground">Go to WhatsApp → Targets and grab the chat ID, then paste it on the contact form.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📅</span>
                <div>
                  <div className="font-medium">ICS import tip</div>
                  <div className="text-muted-foreground">Use <span className="font-mono text-xs bg-background px-1 rounded">Import Calendar</span> in the sidebar to bulk-import birthdays from a .ics file.</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { dismiss(); nav('/contacts/new'); }}>
                  Add Contact →
                </Button>
                <Button onClick={() => setStep(3)}>Next →</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: The Dashboard */}
        {step === 3 && (
          <div>
            <div className="rounded-lg bg-muted/50 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <div className="font-medium">Generate Today's Messages</div>
                  <div className="text-muted-foreground">Hit the button (or wait for 8 am) to create AI drafts for all of today's occasions.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">✏️</span>
                <div>
                  <div className="font-medium">Approve / Edit / Skip</div>
                  <div className="text-muted-foreground">Each card lets you approve the draft as-is, tweak the text, skip it, or regenerate with a fresh AI attempt.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🎉</span>
                <div>
                  <div className="font-medium">GIF picker</div>
                  <div className="text-muted-foreground">Add a Giphy GIF to any message before sending — add your Giphy API key in Settings to unlock this.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📤</span>
                <div>
                  <div className="font-medium">Send</div>
                  <div className="text-muted-foreground">Approved messages are sent directly to the contact's WhatsApp chat with one click.</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={() => setStep(4)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 4: Calendar, History & Broadcasts */}
        {step === 4 && (
          <div>
            <div className="rounded-lg bg-muted/50 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">📆</span>
                <div>
                  <div className="font-medium">Calendar</div>
                  <div className="text-muted-foreground">Month-view overview of all upcoming occasions — great for planning ahead.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📜</span>
                <div>
                  <div className="font-medium">History</div>
                  <div className="text-muted-foreground">Browse all messages you've sent, skipped, or left pending — full audit trail.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📡</span>
                <div>
                  <div className="font-medium">Broadcasts</div>
                  <div className="text-muted-foreground">Send the same message to multiple contacts at once — useful for group announcements or festival wishes.</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
              <Button onClick={() => setStep(5)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 5: Settings */}
        {step === 5 && (
          <div>
            <div className="rounded-lg bg-muted/50 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">🧠</span>
                <div>
                  <div className="font-medium">AI Provider</div>
                  <div className="text-muted-foreground">Switch between Claude (cloud) and a local LLM via LM Studio / Ollama for offline use.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🎬</span>
                <div>
                  <div className="font-medium">Giphy API Key</div>
                  <div className="text-muted-foreground">Get a free key at developers.giphy.com and paste it here to enable the GIF picker in Dashboard cards.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🔔</span>
                <div>
                  <div className="font-medium">Admin WhatsApp Notifications</div>
                  <div className="text-muted-foreground">Receive a WhatsApp message each morning listing today's occasions and draft status.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🤖</span>
                <div>
                  <div className="font-medium">Bot Commands</div>
                  <div className="text-muted-foreground">Reply to the bot's messages with commands like <span className="font-mono text-xs bg-background px-1 rounded">send all</span> to approve and send everything remotely.</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(4)}>← Back</Button>
              <Button onClick={() => setStep(6)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 6: All set */}
        {step === 6 && (
          <div>
            <div className="text-center py-2 mb-4">
              <div className="text-5xl mb-3">🎉</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-5 text-sm space-y-2">
              <div className="font-medium mb-2">Quick-start checklist</div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>✅ Connect WhatsApp (Targets page → scan QR)</li>
                <li>✅ Add contacts with occasions (Contacts page)</li>
                <li>✅ Generate today's drafts (Dashboard → Generate button)</li>
                <li>✅ Review, approve, and send!</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border mt-3">
                You can always reopen this guide from the <strong>"How to use"</strong> link at the bottom of the sidebar.
              </p>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(5)}>← Back</Button>
              <Button onClick={dismiss}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
