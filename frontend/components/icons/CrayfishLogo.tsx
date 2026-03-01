interface CrayfishLogoProps {
  variant?: 'gradient' | 'mono-light' | 'mono-dark'
  size?: number
  className?: string
}

export function CrayfishLogo({ variant = 'gradient', size = 40, className = '' }: CrayfishLogoProps) {
  const id = `crayfish-grad-${Math.random().toString(36).slice(2, 8)}`

  const getFill = () => {
    switch (variant) {
      case 'gradient':
        return `url(#${id})`
      case 'mono-light':
        return '#ffffff'
      case 'mono-dark':
        return '#4a1219'
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OPEN CLAW"
    >
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c53030" />
            <stop offset="60%" stopColor="#9b2c2c" />
            <stop offset="100%" stopColor="#d69e2e" />
          </linearGradient>
        </defs>
      )}

      {/* 左ハサミ */}
      <path
        d="M12 18 C8 12, 4 8, 2 4 C4 6, 8 7, 12 10 C10 6, 6 2, 4 0 C8 3, 12 8, 14 14 L18 22 Z"
        fill={getFill()}
        opacity={0.85}
      />

      {/* 右ハサミ */}
      <path
        d="M52 18 C56 12, 60 8, 62 4 C60 6, 56 7, 52 10 C54 6, 58 2, 60 0 C56 3, 52 8, 50 14 L46 22 Z"
        fill={getFill()}
        opacity={0.85}
      />

      {/* 頭甲 */}
      <ellipse
        cx="32"
        cy="26"
        rx="14"
        ry="10"
        fill={getFill()}
      />

      {/* 胴体 */}
      <path
        d="M22 32 Q20 40, 22 48 Q26 54, 32 56 Q38 54, 42 48 Q44 40, 42 32 Z"
        fill={getFill()}
        opacity={0.9}
      />

      {/* 尾扇 */}
      <path
        d="M26 54 Q24 58, 22 62 Q27 60, 32 62 Q37 60, 42 62 Q40 58, 38 54"
        fill={getFill()}
        opacity={0.7}
      />

      {/* 目（左） */}
      <circle
        cx="26"
        cy="23"
        r="2"
        fill={variant === 'mono-light' ? '#4a1219' : '#ffffff'}
      />

      {/* 目（右） */}
      <circle
        cx="38"
        cy="23"
        r="2"
        fill={variant === 'mono-light' ? '#4a1219' : '#ffffff'}
      />

      {/* 脚（左） */}
      <line x1="22" y1="34" x2="14" y2="38" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="38" x2="13" y2="43" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="42" x2="14" y2="48" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />

      {/* 脚（右） */}
      <line x1="42" y1="34" x2="50" y2="38" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="43" y1="38" x2="51" y2="43" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="43" y1="42" x2="50" y2="48" stroke={getFill()} strokeWidth="1.5" strokeLinecap="round" />

      {/* 触角（左） */}
      <path
        d="M26 20 Q20 14, 10 12"
        stroke={getFill()}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 触角（右） */}
      <path
        d="M38 20 Q44 14, 54 12"
        stroke={getFill()}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
