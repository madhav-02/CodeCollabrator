import type { ConnectionStatus as Status } from '../room/transport';

// Nothing is shown while connected: a permanent "online" badge is noise.
const LABEL: Record<Status, string | null> = {
  open: null,
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  closed: 'Disconnected',
};

const HINT: Record<Status, string> = {
  open: '',
  connecting: 'Joining the room',
  reconnecting: 'Keep typing — your changes are kept and will sync when the connection returns',
  closed: 'Not connected to the room',
};

export function ConnectionStatus({ status }: { status: Status }) {
  const label = LABEL[status];
  if (!label) return null;

  return (
    <span className={`conn conn-${status}`} role="status" aria-live="polite" title={HINT[status]}>
      <span className="conn-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
