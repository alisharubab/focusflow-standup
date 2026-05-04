export function Logo({ size = 18 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>📋</span>
      <span className="font-display text-foreground" style={{ fontSize: size }}>
        FocusFlow
      </span>
    </div>
  );
}
