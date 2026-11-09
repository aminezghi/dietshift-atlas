interface DietShiftLogoProps {
  className?: string;
  size?: number;
}

export function DietShiftLogo({ className = 'w-11 h-11 shrink-0', size = 44 }: DietShiftLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-labelledby="dietshiftLogoTitle"
    >
      <title id="dietshiftLogoTitle">DietShift Atlas — Meridian Plate Logo</title>
      <g id="symbol">
        <path
          fill="#111827"
          fillRule="evenodd"
          d="
            M 122 24
            A 102 102 0 0 0 122 228
            Z
            M 44 82 H 104 V 98 H 44 Z
            M 32 118 H 104 V 134 H 32 Z
            M 44 154 H 104 V 170 H 44 Z
          "
        />
        <path
          fill="#111827"
          d="
            M 138 136
            L 226 159.58
            A 102 102 0 0 1 138 224
            Z
          "
        />
        <path
          fill="#8A1253"
          d="
            M 138 20
            A 102 102 0 0 1 226 94.42
            L 138 118
            Z
          "
        />
        <circle fill="#8A1253" cx="216" cy="127" r="16" />
      </g>
    </svg>
  );
}
