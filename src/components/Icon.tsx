type IconName = 'plus' | 'edit' | 'trash' | 'close' | 'minus' | 'leaf' | 'wallet'

type IconProps = {
  name: IconName
  size?: number
}

const paths: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  edit: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />,
  trash: <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  leaf: <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 19 2 19 2c.6 9.2-3.4 14.3-8 14.8M2 21c3-6 7-9 13-12" />,
  wallet: <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6m14 8h.01" />,
}

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
