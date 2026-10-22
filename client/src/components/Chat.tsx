import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS, type ChatMessage } from '@shared/types';
import { identity } from '../lib/identity';
import { useStore } from '../lib/store';
import { useRoom, useTransport } from '../room/RoomContext';

/** Messages close together from one person share a header. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function startsGroup(message: ChatMessage, previous: ChatMessage | undefined): boolean {
  if (!previous) return true;
  if (previous.userId !== message.userId) return true;
  return message.at - previous.at > GROUP_WINDOW_MS;
}

export function Chat() {
  const { chat, status } = useRoom();
  const transport = useTransport();
  const me = useStore(identity);
  const [draft, setDraft] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);
  // Only follow new messages if the reader is already at the bottom; yanking
  // someone out of the history they are scrolled back through is worse than
  // missing an autoscroll.
  const atBottom = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (list && atBottom.current) list.scrollTop = list.scrollHeight;
  }, [chat.length]);

  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    transport.sendChat(text);
    setDraft('');
    atBottom.current = true;
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
        {chat.length === 0 ? (
          <p className="placeholder chat-empty">
            No messages yet. Everyone here can chat, including people who are only
            watching.
          </p>
        ) : (
          chat.map((message, index) => {
            const grouped = !startsGroup(message, chat[index - 1]);
            return (
              <div
                key={message.id}
                className={`chat-message${grouped ? ' chat-message-grouped' : ''}`}
              >
                {!grouped && (
                  <div className="chat-meta">
                    <span className="chat-author" style={{ color: message.color }}>
                      {message.name}
                      {message.userId === me.userId && ' (you)'}
                    </span>
                    <span className="chat-time">{time(message.at)}</span>
                  </div>
                )}
                <div className="chat-text">{message.text}</div>
              </div>
            );
          })
        )}
      </div>

      <form className="chat-compose" onSubmit={send}>
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={LIMITS.maxChatLength}
          placeholder={status === 'open' ? 'Message' : 'Not connected'}
          disabled={status !== 'open'}
          aria-label="Message"
        />
        <button className="btn" type="submit" disabled={!draft.trim() || status !== 'open'}>
          Send
        </button>
      </form>
    </div>
  );
}
