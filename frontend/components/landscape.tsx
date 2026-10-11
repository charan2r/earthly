export default function Landscape({
  variant = "forest",
}: {
  variant?: "forest" | "meadow" | "water";
}) {
  const meadow = variant === "meadow",
    water = variant === "water";
  return (
    <svg
      className="landscape"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={
        water
          ? "A quiet river beneath green hills"
          : meadow
            ? "Sunlit meadow with wildflowers"
            : "Illustration of a winding trail in a green forest"
      }
    >
      <defs>
        <linearGradient id={`sky-${variant}`} x2="0" y2="1">
          <stop stopColor="#d6ddac" />
          <stop offset="1" stopColor="#eff0c8" />
        </linearGradient>
        <linearGradient id={`hill-${variant}`} x2="0" y2="1">
          <stop stopColor="#698966" />
          <stop offset="1" stopColor="#315344" />
        </linearGradient>
        <filter id={`grain-${variant}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".7"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".07" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <g filter={`url(#grain-${variant})`}>
        <rect width="1000" height="600" fill={`url(#sky-${variant})`} />
        <circle cx="695" cy="148" r="62" fill="#f6ebaf" />
        <path
          d="M0 345Q200 130 415 310Q670 140 1000 310V600H0"
          fill="#a5b78c"
        />
        <path
          d="M0 380Q275 220 460 350Q775 265 1000 340V600H0"
          fill="#789672"
        />
        <path
          d="M0 465Q250 300 485 410Q780 320 1000 400V600H0"
          fill={`url(#hill-${variant})`}
        />
        <path
          d={
            water
              ? "M585 350Q350 405 570 445Q840 495 390 600H850Q920 485 650 432Q485 403 660 350Z"
              : "M615 350Q420 400 510 460Q600 520 400 600H730Q755 510 595 460Q495 412 650 350Z"
          }
          fill={water ? "#98bdb4" : "#c9c298"}
        />
        {!meadow &&
          [
            [-15, 120, 1.3],
            [125, 190, 0.85],
            [270, 280, 0.57],
            [885, 165, 1.2],
            [760, 265, 0.66],
            [370, 295, 0.43],
            [950, 315, 0.56],
            [55, 325, 0.55],
          ].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <path d="M-8 100L-16 370H18L7 100Z" fill="#374a34" />
              <path
                d="M0 0L-105 205H-65L-125 285H125L65 205H100Z"
                fill={i % 2 ? "#365c42" : "#234d3b"}
              />
              <path
                d="M0 0L-20 260H100L65 205H100Z"
                fill="#1e4132"
                opacity=".4"
              />
            </g>
          ))}
        <path
          d="M0 550Q165 425 340 550L290 600H0ZM760 600Q850 440 1000 470V600"
          fill="#244b37"
        />
        {Array.from({ length: meadow ? 36 : 18 }, (_, i) => {
          const x = (i * 83 + 27) % 1000,
            y = 475 + ((i * 29) % 120);
          return (
            <g key={i}>
              <path
                d={`M${x} ${y + 28}q-7-25 0-32`}
                stroke="#688655"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx={x}
                cy={y}
                r={meadow ? 5 : 3}
                fill={i % 3 ? "#e2d58f" : "#efead2"}
              />
            </g>
          );
        })}
        <path
          d="M580 190q12-12 24 0q12-12 24 0M470 145q9-9 18 0q9-9 18 0"
          stroke="#556c50"
          strokeWidth="3"
          fill="none"
        />
      </g>
    </svg>
  );
}
