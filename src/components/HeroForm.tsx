import { useEffect, useRef, useState, type FormEvent } from 'react';
import { analyzeUrl, fetchSuggestions, parsePlace, type HotelSuggestion } from '../lib/hg';

// Live property search. Suggestions come from the production hotelgrader API;
// selecting one hands off to the live audit runner (/analyze) with the same
// query-param contract the production SPA uses.

interface Props {
  inputId?: string;
  ctaLabel?: string;
  placeholder?: string;
  align?: 'center' | 'left';
  /** 'dark' renders labels for the indigo band */
  tone?: 'light' | 'dark';
}

export default function HeroForm({
  inputId = 'hero-domain',
  ctaLabel = 'Get my free report',
  placeholder = 'Search by hotel name…',
  align = 'center',
  tone = 'light',
}: Props) {
  const [value, setValue] = useState('');
  const [items, setItems] = useState<HotelSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number>();
  const pickedRef = useRef(false);
  const rootRef = useRef<HTMLFormElement>(null);

  const go = (s: HotelSuggestion) => {
    const { city, state } = parsePlace(s);
    window.location.href = analyzeUrl(s.name, city, state);
  };

  /** Tell listening surfaces (the hero scan demo) which hotel is on deck. */
  const announce = (s: HotelSuggestion | null) => {
    const detail = s ? { name: s.name, ...parsePlace(s) } : null;
    window.dispatchEvent(new CustomEvent('hg:prospect', { detail }));
  };

  const pick = (s: HotelSuggestion) => {
    pickedRef.current = true;
    setValue(s.name);
    setOpen(false);
    go(s);
  };

  // Debounced live search
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      setBusy(false);
      return;
    }
    setBusy(true);
    debounceRef.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const found = await fetchSuggestions(q, ctrl.signal);
        setItems(found);
        setOpen(found.length > 0);
        setHi(found.length ? 0 : -1);
      } catch {
        /* aborted or offline; keep quiet */
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Keep the scan demo in sync with whichever hotel is on deck
  useEffect(() => {
    if (items.length > 0 && hi >= 0 && items[hi]) {
      announce(items[hi]);
    } else if (items.length === 0) {
      announce(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hi, items]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (open && hi >= 0 && items[hi]) {
      pick(items[hi]);
      return;
    }
    if (items.length > 0) {
      pick(items[0]);
      return;
    }
    // Button pressed before suggestions arrived: resolve the query ourselves
    // so the handoff always carries a real hotel with city and state.
    const q = value.trim();
    if (q.length < 2) return;
    setBusy(true);
    try {
      const found = await fetchSuggestions(q);
      if (found.length > 0) {
        pick(found[0]);
        return;
      }
    } catch {
      /* fall through */
    } finally {
      setBusy(false);
    }
    window.location.href = analyzeUrl(q, '', '');
  };

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      className={`relative mt-9 max-w-[600px] ${align === 'center' ? 'mx-auto' : ''}`}
      id="get-the-report"
      autoComplete="off"
    >
      <label
        htmlFor={inputId}
        className={`label block text-left mb-2 ${tone === 'dark' ? '' : 'label--muted'}`}
        style={tone === 'dark' ? { color: 'rgba(255,255,255,0.85)' } : undefined}
      >
        Property
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(38,34,27,0.4)"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input
            id={inputId}
            name="hotel"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${inputId}-listbox`}
            aria-autocomplete="list"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => items.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === 'Escape')    { setOpen(false); }
            }}
            className="input w-full pl-10 bg-paper border-edge-strong"
          />
          {busy && (
            <span className="meta tabular absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              SEARCHING
            </span>
          )}

          {open && (
            <ul
              id={`${inputId}-listbox`}
              role="listbox"
              className="absolute z-20 left-0 right-0 top-full mt-1 border border-edge rounded bg-bone overflow-hidden list-none m-0 p-0 text-left"
            >
              {items.map((s, i) => (
                <li
                  key={s.place_id}
                  role="option"
                  aria-selected={i === hi}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  className={`px-4 py-3 cursor-pointer ${i > 0 ? 'border-t border-edge' : ''}`}
                  style={{ background: i === hi ? '#EFECE7' : 'transparent' }}
                >
                  <div className="text-[14px] font-medium text-ink leading-snug">{s.name}</div>
                  <div className="meta mt-0.5">{s.secondary_text}</div>
                </li>
              ))}
              <li className="px-4 py-2 border-t border-edge bg-paper meta tabular" aria-hidden="true">
                LIVE SEARCH · ANY HOTEL · ANYWHERE
              </li>
            </ul>
          )}
        </div>

        <button type="submit" className={`justify-center ${tone === 'dark' ? 'btn' : 'btn btn--primary'}`}>
          <span>{ctaLabel}</span>
          <span data-arrow aria-hidden="true">{'→'}</span>
        </button>
      </div>
    </form>
  );
}
