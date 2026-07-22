const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icons = {
  home: (
    <svg {...base} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  orders: (
    <svg {...base} aria-hidden>
      <path d="M8 3h8l3 5v13H5V8z" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  ),
  plus: (
    <svg {...base} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  masters: (
    <svg {...base} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  pricing: (
    <svg {...base} aria-hidden>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.7-2-2.5-4.5-2.5S7.5 5.9 7.5 7.7 9.6 10.3 12 11s4.5 1.4 4.5 3.4S14.4 19 12 19s-4.5-.9-4.5-2.6" />
    </svg>
  ),
  stock: (
    <svg {...base} aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  ),
  invoice: (
    <svg {...base} aria-hidden>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
  truck: (
    <svg {...base} aria-hidden>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </svg>
  ),
  users: (
    <svg {...base} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 11.2A3.2 3.2 0 0 0 16 5" />
      <path d="M17.5 20a5.5 5.5 0 0 0-2.4-4.5" />
    </svg>
  ),
  settings: (
    <svg {...base} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  ),
  clock: (
    <svg {...base} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: (
    <svg {...base} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
};
