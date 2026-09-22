export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#059669" />
      <rect x="26" y="13" width="12" height="24" fill="#ffffff" />
      <polygon points="16,35 48,35 32,53" fill="#ffffff" />
    </svg>
  );
}
