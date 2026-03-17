interface Props {
  value: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

export default function MessageEditor({ value, onChange, onRegenerate, regenerating }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px',
          border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14,
          lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{value.length} chars</span>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 4,
            border: '1px solid #d1d5db', background: '#fff', cursor: regenerating ? 'not-allowed' : 'pointer',
            color: '#6b7280',
          }}
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}
