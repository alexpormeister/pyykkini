const BUBBLES = [
  { left: "6%", size: 54, delay: "0s", duration: "17s", opacity: 0.35 },
  { left: "18%", size: 22, delay: "2.5s", duration: "13s", opacity: 0.5 },
  { left: "31%", size: 88, delay: "5s", duration: "22s", opacity: 0.22 },
  { left: "45%", size: 32, delay: "1.2s", duration: "15s", opacity: 0.4 },
  { left: "58%", size: 64, delay: "7s", duration: "19s", opacity: 0.28 },
  { left: "72%", size: 26, delay: "3.5s", duration: "12s", opacity: 0.45 },
  { left: "84%", size: 72, delay: "6.2s", duration: "21s", opacity: 0.25 },
  { left: "94%", size: 18, delay: "9s", duration: "14s", opacity: 0.5 },
];

/** Kelluvat saippuakuplat – puhtaasti dekoratiivinen taustaelementti */
export const Bubbles = ({ className = "" }: { className?: string }) => (
  <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    {BUBBLES.map((b, i) => (
      <span
        key={i}
        className="animate-bubble absolute bottom-[-120px] rounded-full border border-primary/30 bg-gradient-to-br from-primary/20 to-primary-glow/10 backdrop-blur-[1px]"
        style={{
          left: b.left,
          width: b.size,
          height: b.size,
          opacity: b.opacity,
          animationDelay: b.delay,
          animationDuration: b.duration,
        }}
      />
    ))}
  </div>
);
