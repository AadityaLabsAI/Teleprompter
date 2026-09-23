import { useEffect, useRef, useState } from 'react';
import { Camera, FlipHorizontal, Maximize2, Minimize2, X } from 'lucide-react';

export function VideoOverlay({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [compact, setCompact] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((next) => {
        if (!active) { next.getTracks().forEach((track) => track.stop()); return; }
        setStream(next);
        if (videoRef.current) videoRef.current.srcObject = next;
      })
      .catch(() => setError('Camera access was blocked or is unavailable on this device.'));
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);
  const close = () => { stream?.getTracks().forEach((track) => track.stop()); onClose(); };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => { const box = event.currentTarget; const rect = box.getBoundingClientRect(); dragRef.current = { active: true, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }; box.setPointerCapture(event.pointerId); };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const box = event.currentTarget;
    const nextLeft = Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, dragRef.current.left + event.clientX - dragRef.current.x));
    const nextTop = Math.max(8, Math.min(window.innerHeight - box.offsetHeight - 8, dragRef.current.top + event.clientY - dragRef.current.y));
    box.style.left = `${nextLeft}px`; box.style.top = `${nextTop}px`; box.style.right = 'auto'; box.style.bottom = 'auto';
  };
  return (
    <div className={`teleqen-camera ${compact ? 'teleqen-camera-compact' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current.active = false; }} role="dialog" aria-label="Camera preview">
      <div className="teleqen-camera-header"><span><Camera size={13} /> Camera</span><div><button onClick={() => setMirrored((v) => !v)} aria-label="Mirror camera"><FlipHorizontal size={14} /></button><button onClick={() => setCompact((v) => !v)} aria-label="Resize camera">{compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}</button><button onClick={close} aria-label="Close camera"><X size={14} /></button></div></div>
      <div className="teleqen-camera-body">{error ? <div className="teleqen-camera-error"><Camera size={20} /><span>{error}</span></div> : <video ref={videoRef} autoPlay muted playsInline style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />}</div>
      <div className="teleqen-camera-hint">Drag to move</div>
    </div>
  );
}