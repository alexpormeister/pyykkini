import { Apple, Play } from "lucide-react";

interface Props {
  className?: string;
  size?: "default" | "sm";
}

const APP_STORE_URL = "https://apps.apple.com/fi/app/pesuni";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=fi.pesuni.app";

/** App Store & Google Play -latauspainikkeet */
export const AppStoreBadges = ({ className = "", size = "default" }: Props) => {
  const pad = size === "sm" ? "px-4 py-2.5" : "px-5 py-3";
  const icon = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center gap-3 rounded-2xl bg-foreground ${pad} text-background shadow-elegant transition-transform hover:-translate-y-0.5`}
      >
        <Apple className={`${icon} shrink-0`} />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-70">Lataa</span>
          <span className="block text-sm font-semibold">App Store</span>
        </span>
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center gap-3 rounded-2xl bg-foreground ${pad} text-background shadow-elegant transition-transform hover:-translate-y-0.5`}
      >
        <Play className={`${icon} shrink-0`} />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-70">Saatavilla</span>
          <span className="block text-sm font-semibold">Google Play</span>
        </span>
      </a>
    </div>
  );
};
