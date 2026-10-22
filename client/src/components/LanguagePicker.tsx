import { languageOptions } from '../editor/languages';

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Viewers cannot change the language (B2, R13). */
  disabled?: boolean;
}

// A native select on purpose: it is the best option on a phone (R40), it is
// keyboard and screen-reader accessible for free, and a custom dropdown over 40+
// entries would be work for no gain.
export function LanguagePicker({ value, onChange, disabled = false }: Props) {
  return (
    <select
      className="select"
      value={value}
      disabled={disabled}
      aria-label="Language"
      title={disabled ? 'Only the host and editors can change the language' : 'Language'}
      onChange={(e) => onChange(e.target.value)}
    >
      {languageOptions.map((lang) => (
        <option key={lang.name} value={lang.name}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}
