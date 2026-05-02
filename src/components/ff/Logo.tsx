export function Logo({ size = 18 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-md bg-highlight flex items-center justify-center text-white font-display"
        style={{ width: size + 8, height: size + 8, fontSize: size - 4 }}
      >
        F
      </div>
      <span className="font-display text-foreground" style={{ fontSize: size }}>
        FocusFlow
      </span>
    </div>
  );
}
