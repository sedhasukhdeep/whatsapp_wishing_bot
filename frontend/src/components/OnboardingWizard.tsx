import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBridgeStatus } from '../api/client';
import type { BridgeStatus } from '../types';

interface Props {
  onDismiss: () => void;
}

export default function OnboardingWizard({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const nav = useNavigate();

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
    if (step === 0) checkBridge();
  }, [step]);

  // Poll for QR code or connected status
  useEffect(() => {
    if (step !== 0) return;
    const timer = setInterval(checkBridge, 4000);
    return () => clearInterval(timer);
  }, [step]);

  const steps = [
    {
      title: 'Connect WhatsApp',
      subtitle: 'Scan the QR code with your WhatsApp to enable sending messages.',
    },
    {
      title: 'Add your first contact',
      subtitle: 'Add someone you want to send greetings to.',
    },
    {
      title: "You're all set!",
      subtitle: 'The dashboard shows today\'s occasions. Click "Generate Today\'s Messages" to create drafts.',
    },
  ];

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Step indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === step ? '#2563eb' : i < step ? '#10b981' : '#e5e7eb',
              }}
            />
          ))}
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>{steps[step].title}</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>{steps[step].subtitle}</p>

        {/* Step 0: Connect WhatsApp */}
        {step === 0 && (
          <div>
            {bridgeStatus?.ready ? (
              <div style={successBox}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>WhatsApp Connected</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Your WhatsApp is connected and ready to send messages.</div>
              </div>
            ) : bridgeStatus?.qr_image ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                </p>
                <img
                  src={bridgeStatus.qr_image}
                  alt="WhatsApp QR Code"
                  style={{ maxWidth: 220, border: '1px solid #e5e7eb', borderRadius: 8 }}
                />
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Refreshing automatically...</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {checking ? (
                  <p style={{ color: '#6b7280', fontSize: 14 }}>Connecting to WhatsApp bridge...</p>
                ) : (
                  <div>
                    <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>
                      WhatsApp bridge is not running. Make sure you started the app with <code>./start.sh</code>
                    </p>
                    <button onClick={checkBridge} style={btnSecondary}>Retry</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={onDismiss} style={btnGhost}>Skip setup</button>
              <button
                onClick={() => setStep(1)}
                disabled={!bridgeStatus?.ready}
                style={{ ...btnPrimary, opacity: bridgeStatus?.ready ? 1 : 0.5 }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Add first contact */}
        {step === 1 && (
          <div>
            <div style={stepContent}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
              <p style={{ fontSize: 14, color: '#374151', margin: '0 0 8px' }}>
                Go to the Contacts page and add your first contact — their name, phone number, and relationship.
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                You can link their WhatsApp chat so messages send with one click.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setStep(0)} style={btnGhost}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { onDismiss(); nav('/contacts/new'); }}
                  style={btnPrimary}
                >
                  Add Contact →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <p style={{ fontSize: 14, color: '#374151', margin: '0 0 8px' }}>
                Each morning at 8am, the scheduler generates AI drafts for today's occasions.
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                You review, edit, and send from the Dashboard.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={onDismiss} style={btnPrimary}>Go to Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 32, width: 460, maxWidth: '95%',
  boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
};
const successBox: React.CSSProperties = {
  textAlign: 'center', padding: '20px 24px', background: '#f0fdf4',
  border: '1px solid #bbf7d0', borderRadius: 8,
};
const stepContent: React.CSSProperties = { textAlign: 'center', padding: '10px 0' };
const btnPrimary: React.CSSProperties = { padding: '10px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const btnGhost: React.CSSProperties = { padding: '10px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 };
