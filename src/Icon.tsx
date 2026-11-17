import type { IconName } from "./experience";

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  let artwork;

  switch (name) {
    case "estate":
      artwork = <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v9h13v-9M10 19v-5h4v5" /></>;
      break;
    case "winery":
    case "building":
      artwork = <><path d="M3 9h18M5 9v10h14V9M3 19h18M12 3 3 8h18L12 3Z" /><path d="M9 19v-6h6v6" /></>;
      break;
    case "cellar":
    case "barrel":
      artwork = <><path d="M7 4c-2 2-3 5-3 8s1 6 3 8h10c2-2 3-5 3-8s-1-6-3-8H7Z" /><path d="M8 4c-1 4-1 12 0 16M16 4c1 4 1 12 0 16M4.5 9h15M4.5 15h15" /></>;
      break;
    case "company":
      artwork = <><path d="M4 20h16M6 20V9l6-4 6 4v11M9 11v2M15 11v2M9 16v2M15 16v2" /></>;
      break;
    case "management":
    case "equipment":
      artwork = <><path d="M4 7h16M4 17h16M8 4v6M16 14v6" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>;
      break;
    case "calendar":
      artwork = <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6M16 3v6M4 10h16M8 14h2M14 14h2" /></>;
      break;
    case "activity":
      artwork = <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 4.5h6M8 10h1M11 10h5M8 14h1M11 14h5" /></>;
      break;
    case "arrow":
      artwork = <><path d="M4 12h15M14 7l5 5-5 5" /></>;
      break;
    case "close":
      artwork = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case "vine":
      artwork = <><path d="M12 8c0-3 2-4 4-4M12 8c-2-2-4-2-6-1 0 2 2 4 5 4" /><circle cx="9" cy="13" r="2" /><circle cx="14" cy="13" r="2" /><circle cx="11.5" cy="17" r="2" /></>;
      break;
    case "grounds":
      artwork = <><path d="M12 21v-9M7 18h10M12 3c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9Z" /></>;
      break;
    case "vessel":
      artwork = <><path d="M7 5c0-1 2-2 5-2s5 1 5 2v12c0 1-2 2-5 2s-5-1-5-2V5Z" /><path d="M7 5c0 1 2 2 5 2s5-1 5-2M9 19v2M15 19v2" /></>;
      break;
    case "work":
      artwork = <><path d="M4 10h16v3H4zM6 13v7M18 13v7M8 10V7h8v3" /></>;
      break;
    case "bottle":
      artwork = <><path d="M10 3h4v5l2 3v8c0 1-1 2-2 2h-4c-1 0-2-1-2-2v-8l2-3V3ZM8 14h8" /></>;
      break;
    case "shelves":
      artwork = <><path d="M4 5h16v15H4zM4 12h16M8 8h1M12 8h1M16 8h1M8 16h1M12 16h1M16 16h1" /></>;
      break;
    case "landmark":
      artwork = <><path d="M5 20h14M7 17h10v3H7zM10 17v-6l-2-1 4-5 4 5-2 1v6M12 5V3" /></>;
      break;
    case "spark":
      artwork = <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM18 16l.6 1.4L20 18l-1.4.6L18 20l-.6-1.4L16 18l1.4-.6L18 16Z" /></>;
      break;
    case "finance":
      artwork = <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v5c0 1.7 3 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3 3 7 3s7-1.3 7-3v-5" /></>;
      break;
    case "market":
      artwork = <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></>;
      break;
    case "people":
      artwork = <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-2a5.5 5.5 0 0 1 11 0v2h-11ZM16 5a3 3 0 0 1 0 6M16 14a4 4 0 0 1 4 4v1" /></>;
      break;
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {artwork}
    </svg>
  );
}
