import { useRef, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, setName, suggestName } from '../lib/identity';

/**
 * Asked for once, on arrival (R25). Deliberately not dismissable: the name is what
 * identifies you on your cursor, in the participant list and on your chat messages,
 * so there is no sensible anonymous path.
 */
export function NamePrompt() {
  const [value, setValue] = useState(suggestName);
  const input = useRef<HTMLInputElement | null>(null);

  const trimmed = value.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) {
      input.current?.focus();
      return;
    }
    setName(trimmed);
  }

  return (
    <div className="modal-backdrop">
      <form className="card" onSubmit={submit} aria-labelledby="name-heading">
        <h1 id="name-heading">What should we call you?</h1>
        <p>Shown on your cursor, in the participant list, and on your messages.</p>
        <input
          ref={input}
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          aria-label="Your name"
          autoFocus
          // Select the suggestion so typing replaces it rather than appending.
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="card-actions" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" type="submit" disabled={!trimmed}>
            Continue
          </button>
          <button className="btn" type="button" onClick={() => setValue(suggestName())}>
            Suggest another
          </button>
        </div>
      </form>
    </div>
  );
}
