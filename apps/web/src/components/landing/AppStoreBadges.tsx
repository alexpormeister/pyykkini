import React from "react";

interface Props {
  className?: string;
  size?: "default" | "sm";
  onBadgeClick?: (type: 'appstore' | 'googleplay') => void;
}

const APP_STORE_URL = "https://apps.apple.com/fi/app/pesuni";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=fi.pesuni.app";

/** App Store & Google Play -latauskuvat vierekkäin TÄSMÄLLEEN saman korkuisina ja korkealaatuisina */
export const AppStoreBadges = ({ className = "", size = "default", onBadgeClick }: Props) => {
  const isSm = size === "sm";

  return (
    <div className={`flex flex-wrap items-center gap-3.5 ${className}`}>
      {/* App Store Badge */}
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (onBadgeClick) {
            e.preventDefault();
            onBadgeClick('appstore');
          }
        }}
        className={`group inline-flex items-center gap-2.5 bg-black text-white rounded-xl border border-white/10 shadow-md hover:bg-neutral-900 transition-all hover:-translate-y-0.5 shrink-0 ${
          isSm ? "px-3.5 py-1.5 h-10" : "px-4 py-2.5 h-12 sm:h-13"
        }`}
        style={{ height: isSm ? "40px" : "48px" }}
      >
        <svg className={isSm ? "h-5 w-5 fill-current" : "h-6 w-6 fill-current"} viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-5.04.24-9.97-1.79-14.8-6.09-3.53-3.04-7.58-7.96-12.14-14.76-6.14-9.14-11.03-19.38-14.67-30.72-3.64-11.34-5.46-22.06-5.46-32.16 0-14.07 3.56-25.79 10.67-35.15 7.11-9.36 16.03-14.16 26.77-14.4 5.04 0 10.37 1.25 15.99 3.75 5.62 2.5 9.56 3.75 11.83 3.75 1.9 0 5.86-1.25 11.88-3.75 6.02-2.5 11.13-3.64 15.34-3.41 10.74.47 19.35 4.31 25.83 11.51-9.46 5.76-14.1 13.91-13.92 24.45.24 10.42 4.31 18.77 12.21 25.04 3.78 3.04 8.1 5.22 12.96 6.55-2.61 7.74-6.12 15.35-10.53 22.84zM119.22 31.06c0-6.72 2.41-13.14 7.23-18.25 4.82-5.11 10.9-8.14 18.25-9.08.36 1.44.54 2.76.54 3.96 0 6.6-2.46 13.08-7.38 18.44-4.92 5.36-10.95 8.44-18.09 9.24-.18-1.44-.55-2.88-.55-4.31z"/>
        </svg>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-medium">Lataa kohdasta</span>
          <span className="text-xs sm:text-sm font-bold tracking-tight text-white">App Store</span>
        </div>
      </a>

      {/* Google Play Badge */}
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (onBadgeClick) {
            e.preventDefault();
            onBadgeClick('googleplay');
          }
        }}
        className={`group inline-flex items-center gap-2.5 bg-black text-white rounded-xl border border-white/10 shadow-md hover:bg-neutral-900 transition-all hover:-translate-y-0.5 shrink-0 ${
          isSm ? "px-3.5 py-1.5 h-10" : "px-4 py-2.5 h-12 sm:h-13"
        }`}
        style={{ height: isSm ? "40px" : "48px" }}
      >
        <svg className={isSm ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"} viewBox="0 0 512 512">
          <path fill="#410593" d="M96 48l240 208L96 464V48z" />
          <path fill="#00B0FF" d="M96 48l176 152-48 56L96 48z" />
          <path fill="#FF3D00" d="M96 464l128-208 48 56L96 464z" />
          <path fill="#FFC107" d="M336 256l-64 56-48-56 48-56 64 56z" />
          <path fill="#4CAF50" d="M336 256l80-48c24-14 24-38 0-52l-80-48v148z" />
        </svg>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-medium">Lataa kohdasta</span>
          <span className="text-xs sm:text-sm font-bold tracking-tight text-white">Google Play</span>
        </div>
      </a>
    </div>
  );
};

