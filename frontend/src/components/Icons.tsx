/** Clean inline SVG icons — consistent 1.5px stroke, no emoji */

export function LogoMark() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden>
      <rect x="0" y="12" width="4" height="6" rx="1" fill="#86BC25" />
      <rect x="8" y="6" width="4" height="12" rx="1" fill="#86BC25" opacity="0.55" />
      <rect x="16" y="0" width="4" height="18" rx="1" fill="#00A3AD" />
    </svg>
  )
}

export function FilterIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
      <path d="M1 1h13M3.5 5.5h8M6 10h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SendIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 12V2M2.5 6.5L7 2l4.5 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M1 1l8 8M9 1l-8 8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon({ color = '#86BC25' }: { color?: string }) {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
      <path d="M1 5l3.5 3.5L11 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
