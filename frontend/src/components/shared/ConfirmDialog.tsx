interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  return (
    <div style={overlay}>
      <div style={box}>
        <p style={{ margin: '0 0 20px', fontSize: 15 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
          <button onClick={onConfirm} style={confirmBtn}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const box: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: 24, maxWidth: 380, width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
};
const confirmBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer',
};
