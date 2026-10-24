import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const ref = useRef<Html5Qrcode | null>(null);
  const [err, setErr] = useState('');
  const done = useRef(false);

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader');
    ref.current = qr;
    qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } },
      (text) => { if (done.current) return; done.current = true; qr.stop().catch(() => {}); onResult(text); },
      () => {},
    ).catch((e) => setErr('카메라를 열 수 없어요: ' + (e?.message || e) + ' (HTTPS 또는 localhost 필요)'));
    return () => { qr.stop().catch(() => {}); };
  }, []);

  return (
    <div style={{ marginBottom: 12 }}>
      <div id="qr-reader" style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />
      {err && <p className="muted small">{err}</p>}
    </div>
  );
}
