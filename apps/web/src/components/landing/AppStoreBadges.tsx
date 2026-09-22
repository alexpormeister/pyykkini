import React from "react";

interface Props {
  className?: string;
  size?: "default" | "sm";
  onBadgeClick?: (type: 'appstore' | 'googleplay') => void;
}

const APP_STORE_URL = "https://apps.apple.com/fi/app/pesuni";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=fi.pesuni.app";

/** App Store & Google Play -latauskuvat vierekkäin TÄSMÄLLEEN saman korkuisina ja virallisina SVG-kuvina */
export const AppStoreBadges = ({ className = "", size = "default", onBadgeClick }: Props) => {
  const heightClass = size === "sm" ? "h-9 sm:h-10" : "h-11 sm:h-12";

  return (
    <div className={`flex flex-wrap items-center gap-3.5 ${className}`}>
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
        className="group relative flex items-center justify-center transition-transform hover:-translate-y-0.5 cursor-pointer shrink-0"
      >
        <img
          src="/badges/app-store-badge.svg"
          alt="Lataa App Storesta"
          className={`${heightClass} w-auto object-contain rounded-lg drop-shadow-xs`}
        />
      </a>
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
        className="group relative flex items-center justify-center transition-transform hover:-translate-y-0.5 cursor-pointer shrink-0"
      >
        <img
          src="/badges/google-play-badge.svg"
          alt="Saatavilla Google Play"
          className={`${heightClass} w-auto object-contain rounded-lg drop-shadow-xs`}
        />
      </a>
    </div>
  );
};

