import { useState, type FormEvent } from 'react';
import type { Participant, Role } from '@shared/types';
import { MAX_NAME_LENGTH, identity, setName } from '../lib/identity';
import { useStore } from '../lib/store';
import { useRoom, useTransport } from '../room/RoomContext';

/** Host first, then editors, then viewers (R31). */
const ROLE_ORDER: Record<Role, number> = { host: 0, editor: 1, viewer: 2 };

export function Roster() {
  const { participants, status, role: myRole } = useRoom();
  const me = useStore(identity);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const sorted = [...participants].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name),
  );

  function save(e: FormEvent) {
    e.preventDefault();
    // Flows through the identity store, which the room provider turns into a
    // rename message.
    setName(draft);
    setEditing(false);
  }

  if (sorted.length === 0) {
    return (
      <div className="placeholder">
        {status === 'open' ? 'Nobody here yet.' : 'Not connected.'}
      </div>
    );
  }

  return (
    <div className="roster">
      <ul className="roster-list">
        {sorted.map((person, index) => (
          // The same person in two tabs is two entries (D5), so the id alone is
          // not a unique key.
          <li className="roster-row" key={`${person.userId}-${index}`}>
            <span
              className="roster-dot"
              style={{ background: person.color }}
              aria-hidden="true"
            />
            <span className="roster-name" title={person.name}>
              {person.name}
              {person.userId === me.userId && <span className="muted"> (you)</span>}
            </span>
            <span className={`roster-role roster-role-${person.role}`}>{person.role}</span>
            {myRole === 'host' && person.userId !== me.userId && person.role !== 'host' && (
              <HostActions person={person} />
            )}
          </li>
        ))}
      </ul>

      {editing ? (
        <form className="roster-rename" onSubmit={save}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Your name"
            autoFocus
          />
          <div className="roster-rename-actions">
            <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
              Save
            </button>
            <button className="btn" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn roster-rename-open"
          onClick={() => {
            setDraft(me.name ?? '');
            setEditing(true);
          }}
        >
          Change your name
        </button>
      )}
    </div>
  );
}

function HostActions({ person }: { person: Participant }) {
  const transport = useTransport();

  function remove() {
    // Removal bars them for the rest of the room's life, so it is worth a pause.
    if (window.confirm(`Remove ${person.name} from the room? They cannot rejoin.`)) {
      transport.remove(person.userId);
    }
  }

  return (
    <span className="roster-actions">
      {person.role === 'viewer' ? (
        <button
          className="roster-action"
          onClick={() => transport.promote(person.userId)}
          title={`Let ${person.name} edit`}
          aria-label={`Let ${person.name} edit`}
        >
          ↑
        </button>
      ) : (
        <button
          className="roster-action"
          onClick={() => transport.demote(person.userId)}
          title={`Make ${person.name} view-only`}
          aria-label={`Make ${person.name} view-only`}
        >
          ↓
        </button>
      )}
      <button
        className="roster-action roster-action-danger"
        onClick={remove}
        title={`Remove ${person.name}`}
        aria-label={`Remove ${person.name}`}
      >
        ✕
      </button>
    </span>
  );
}
