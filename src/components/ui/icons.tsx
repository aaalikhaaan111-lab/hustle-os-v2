import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 8v.01" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
    </svg>
  );
}

export function DecisionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 6.5 3 3 3-3" />
      <path d="M12 3.5v6" />
      <circle cx="12" cy="14" r="2.5" />
      <path d="M8 20.5h8" />
    </svg>
  );
}

export function MissionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SystemIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="5" rx="1.5" />
      <rect x="4" y="11" width="16" height="5" rx="1.5" />
      <rect x="4" y="18" width="10" height="2.5" rx="1.25" />
    </svg>
  );
}

export function LaunchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 19 19 5" />
      <path d="M9 5h10v10" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 21 19H3Z" />
      <path d="M12 10v4" />
      <path d="M12 16.5v.01" />
    </svg>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" />
      <path d="M12 16.5v.01" />
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ChallengesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 21V4" />
      <path d="M6 4.5h11.5l-2.8 3.5 2.8 3.5H6" />
    </svg>
  );
}

export function CoursesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5c2-1 5-1 8 .5v13c-3-1.5-6-1.5-8-.5Z" />
      <path d="M20 5.5c-2-1-5-1-8 .5v13c3-1.5 6-1.5 8-.5Z" />
    </svg>
  );
}

export function WorkshopsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" />
      <path d="M8 19.5h8M12 15.5v4" />
      <path d="M7 8.5h6M7 11.5h4" />
    </svg>
  );
}
