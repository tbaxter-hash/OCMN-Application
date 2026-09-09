export default function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      stroke="var(--ember-500)"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="10.5" y1="1" x2="10.5" y2="20" />
      <line x1="1" y1="10.5" x2="20" y2="10.5" />
      <line x1="4.2" y1="4.2" x2="16.8" y2="16.8" />
      <line x1="16.8" y1="4.2" x2="4.2" y2="16.8" />
    </svg>
  );
}
