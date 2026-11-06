// AgentPager's mark on its blue tile.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="ap-logo"
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M41.4 22 22.4 78M41.4 22 47.4 78M59.4 22v56" strokeWidth="9" />
        <path d="M29.5 60h14.9" strokeWidth="8" />
        <path
          d="M59.4 20a21 21 0 0 1 0 42M59.4 26a15 15 0 0 1 0 30"
          strokeWidth="3.5"
        />
      </svg>
    </span>
  );
}
