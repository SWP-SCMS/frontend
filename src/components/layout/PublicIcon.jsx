// Icon SVG vẽ trực tiếp dùng cho các trang công khai giao diện tối (trang
// chủ, bảng gói tập...), để không phải cài thư viện icon.

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const PATHS = {
  dumbbell: (
    <>
      <path d="M6.5 6.5l11 11" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
      <path d="m2 6 4-4" />
      <path d="m18 22 4-4" />
    </>
  ),
  coach: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  unlock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.5-2" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  arrowDown: <path d="M12 5v14m-6-6 6 6 6-6" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  star: <path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z" />,
  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
};

export default function PublicIcon({ name, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...iconProps}
    >
      {PATHS[name]}
    </svg>
  );
}
