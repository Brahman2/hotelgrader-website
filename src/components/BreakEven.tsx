import { useState } from 'react';

// Break-even instrument: Pro priced against recovered direct bookings at the
// operator's own ADR. Three presets keep it honest and fast.

const PRO_ANNUAL = 1188; // $99/mo billed annually

const PRESETS = [150, 284, 450];

export default function BreakEven() {
  const [adr, setAdr] = useState(284);
  const bookings = Math.ceil(PRO_ANNUAL / adr);

  return (
    <div className="border border-edge rounded px-6 sm:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="label">Break-even · at your ADR</span>
        <div className="flex items-center border border-edge rounded-sm overflow-hidden">
          {PRESETS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setAdr(p)}
              className={`meta tabular px-3 py-1.5 ${i > 0 ? 'border-l border-edge' : ''}`}
              style={{
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                cursor: 'pointer',
                background: adr === p ? '#0B1220' : 'transparent',
                color: adr === p ? '#F7F4F0' : undefined,
                transition: 'background 120ms cubic-bezier(0.2,0,0,1)',
              }}
            >
              ${p} ADR
            </button>
          ))}
        </div>
      </div>

      <p className="headline text-[22px] sm:text-[26px] mt-5 tabular">
        At a ${adr} ADR, Pro pays for itself with{' '}
        <span className="text-indigo">{bookings} recovered direct bookings</span> a year.
      </p>
      <p className="text-[13px] text-ink-60 mt-2 leading-relaxed max-w-[560px]">
        One OTA booking at 18% commission costs you about ${Math.round(adr * 0.18)}.
        The sample report found +22% of direct revenue on the table.
      </p>
    </div>
  );
}
