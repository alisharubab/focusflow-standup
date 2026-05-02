// Custom cursor: a small dot that follows the mouse exactly,
// plus a larger ring that lags slightly. Skips touch / coarse pointers.
export function mountCustomCursor() {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (document.querySelector(".ff-cursor-dot")) return;

  const dot = document.createElement("div");
  dot.className = "ff-cursor-dot";
  const ring = document.createElement("div");
  ring.className = "ff-cursor-ring";
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -100, my = -100;
  let rx = -100, ry = -100;

  const onMove = (e: MouseEvent) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  };
  window.addEventListener("mousemove", onMove, { passive: true });

  const tick = () => {
    rx += (mx - rx) * 0.22;
    ry += (my - ry) * 0.22;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const hoverSelector = 'a, button, [role="button"], input, textarea, select, label, .clickable, [data-cursor-hover]';
  const onOver = (e: MouseEvent) => {
    const t = e.target as Element | null;
    if (t && t.closest && t.closest(hoverSelector)) ring.classList.add("is-hover");
  };
  const onOut = (e: MouseEvent) => {
    const t = e.target as Element | null;
    if (t && t.closest && t.closest(hoverSelector)) ring.classList.remove("is-hover");
  };
  document.addEventListener("mouseover", onOver);
  document.addEventListener("mouseout", onOut);

  window.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  window.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  });
}
