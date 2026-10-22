import { useEffect, useState } from 'react';
import { editUrl, hostUrl, readHostToken, viewUrl } from '../lib/roomLink';
import { useRoom, useTransport } from '../room/RoomContext';

interface Props {
  roomId: string;
}

export function ShareMenu({ roomId }: Props) {
  const { role, links } = useRoom();
  const transport = useTransport();
  const [open, setOpen] = useState(false);

  // Only the host can re-display the links (R19). Everyone else already has
  // their own URL in the address bar.
  if (role !== 'host') return null;

  function toggle() {
    if (!open && !links) transport.requestLinks();
    setOpen(!open);
  }

  return (
    <>
      <button className="btn" onClick={toggle}>
        Share
      </button>
      {open && (
        <ShareDialog roomId={roomId} links={links} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

interface DialogProps {
  roomId: string;
  links: { edit: string; view: string } | null;
  onClose: () => void;
}

function ShareDialog({ roomId, links, onClose }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Read once, not during every render: reading it also clears it from the
  // address bar.
  const [hostToken] = useState(() => readHostToken(roomId));

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="card share-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="share-heading">Invite people</h1>
        <p>Each link grants a different level of access. Anyone holding a link can use it.</p>

        {links ? (
          <>
            <ShareRow
              label="Can edit"
              hint="Write code and change the language"
              url={editUrl(roomId, links.edit)}
            />
            <ShareRow
              label="Can watch"
              hint="See the code and chat, but not edit"
              url={viewUrl(roomId, links.view)}
            />
            {hostToken && (
              <ShareRow
                label="Your host link"
                hint="Keep this. It controls the room — do not send it to anyone"
                url={hostUrl(roomId, hostToken)}
              />
            )}
          </>
        ) : (
          <p className="muted">Fetching links…</p>
        )}

        <div className="card-actions" style={{ marginTop: 18 }}>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the field is selectable as a fallback.
      setCopied(false);
    }
  }

  return (
    <div className="share-row">
      <div className="share-row-head">
        <strong>{label}</strong>
        <span className="muted share-hint">{hint}</span>
      </div>
      <div className="share-row-link">
        <input className="input mono share-url" value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button className="btn" onClick={copy} aria-label={`Copy the ${label.toLowerCase()} link`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
