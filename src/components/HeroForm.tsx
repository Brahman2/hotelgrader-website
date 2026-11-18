import { useEffect, useRef, useState, type FormEvent } from 'react';
import { gradeUrl, fetchSuggestions, parsePlace, type HotelSuggestion } from '../lib/hg';

// Live hotel search. Suggestions come from the hotelgrader API; picking one
// opens the free report card (/grade) for that hotel.

interface Props {
  inputId?: string;
  autoFocus?: boolean;
}

export default function HeroForm({ inputId = 'hotel-search', autoFocus = false }: Props) {
  const [value, setValue] = useState('');
  const [items, setItems] = useState<HotelSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number>();
  const pickedRef = useRef(false);
  const rootRef = useRef<HTMLFormElement>(null);

  const pick = (s: HotelSuggestion) => {
    pickedRef.current = true;
    setValue(s.name);
    setOpen(false);
    const { city, state } = parsePlace(s);
    window.location.href = gradeUrl(s.name, city, state);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (open && hi >= 0 && items[hi]) return pick(items[hi]);
    if (items.length > 0) return pick(items[0]);
    // Button pressed before suggestions arrived: resolve the query ourselves
    // so the report card always gets a real hotel with city and state.
    const q = value.trim();
    if (q.length < 2) return;
    setBusy(true);
    try {
      const found = await fetchSuggestions(q);
      if (found.length > 0) return pick(found[0]);
    } catch {
      /* fall through */
    } finally {
      setBusy(false);
    }
    window.location.href = gradeUrl(q, '', '');
  };

  return (
    <form ref={rootRef} onSubmit={handleSubmit} className="relative text-left" autoComplete="off">
      <label htmlFor={inputId} className="sr-only">Hotel name</label>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span aria-hidden="true" className="dark-only absolute left-4 top-1/2 -translate-y-1/2 text-accent pointer-events-none">
            &gt;
          </span>
          <input
            id={inputId}
            name="hotel"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${inputId}-listbox`}
            aria-autocomplete="list"
            placeholder="Search for a hotel"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => items.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === 'Escape')    { setOpen(false); }
            }}
            className="input w-full dark-pad"
          />
          {busy && (
            <span className="meta absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">searching</span>
          )}

          {open && (
            <ul
              id={`${inputId}-listbox`}
              role="listbox"
              className="absolute z-20 left-0 right-0 top-full mt-1 panel overflow-hidden list-none m-0 p-0"
            >
              {items.map((s, i) => (
                <li
                  key={s.place_id}
                  role="option"
                  aria-selected={i === hi}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  className={`px-4 py-2.5 cursor-pointer ${i > 0 ? 'border-t border-edge' : ''} ${i === hi ? 'bg-[var(--accent-soft)]' : ''}`}
                >
                  <div className={`font-medium leading-snug ${i === hi ? 'text-accent' : 'text-ink'}`}>{s.name}</div>
                  <div className="meta">{s.secondary_text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="btn btn--primary justify-center">grade</button>
      </div>
    </form>
  );
}
