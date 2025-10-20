import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import heroBgImage from '@/assets/hero-bg.jpg';

const DEFAULT_MINIMAP_SIZE = 140; // a little larger for better visibility
const WORLD_SIZE = 3000;
const WORLD_CENTER_X = WORLD_SIZE / 2;
const WORLD_CENTER_Y = WORLD_SIZE / 2;
const WORLD_RADIUS = WORLD_SIZE / 2;
const SCALE_FACTOR = DEFAULT_MINIMAP_SIZE / WORLD_SIZE;

interface MinimapProps {
  playerCenter: { x: number; y: number };
  playerRadius: number; // Recebe o raio médio real do jogador
  visibleBots: Array<{ x: number; y: number; mass: number; color: string; radius: number }>;
  className?: string;
  size?: number;
}

const Minimap: React.FC<MinimapProps> = ({ playerCenter, playerRadius, visibleBots, className, size = DEFAULT_MINIMAP_SIZE }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const MINIMAP_SIZE = size;
  const SCALE = MINIMAP_SIZE / WORLD_SIZE;

  useEffect(() => {
    const img = new Image();
    img.src = heroBgImage;
    img.onload = () => {
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      setIsImageLoaded(false);
    };
  }, []);

  const mapToMinimap = (coord: number) => Math.round(coord * SCALE);

  const isWithinWorldBounds = (x: number, y: number, radius: number) => {
    const distanceFromCenter = Math.sqrt(Math.pow(x - WORLD_CENTER_X, 2) + Math.pow(y - WORLD_CENTER_Y, 2));
    return distanceFromCenter + radius <= WORLD_RADIUS;
  };

  // Clip path ensures we only draw inside the circular minimap
  const clipId = `minimap-clip-${MINIMAP_SIZE}`;

  return (
    <div
      className={cn(
        "fixed",
        "top-16 left-4",
        "p-2 shadow-lg",
        "border-2",
        "border-primary/40",
        "overflow-hidden",
        className
      )}
      style={{
        width: MINIMAP_SIZE,
        height: MINIMAP_SIZE,
        borderRadius: '50%',
        // show the image if loaded, otherwise show a pleasant fallback gradient
        background: isImageLoaded ? `url(${heroBgImage}) center/cover no-repeat` : 'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(240,255,245,0.8))',
        // ensure on top and non-interactive (won't block game inputs)
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <svg
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        viewBox={`0 0 ${MINIMAP_SIZE} ${MINIMAP_SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={MINIMAP_SIZE / 2} cy={MINIMAP_SIZE / 2} r={MINIMAP_SIZE / 2} />
          </clipPath>
        </defs>

        {/* subtle border inside SVG for visibility */}
        <circle
          cx={MINIMAP_SIZE / 2}
          cy={MINIMAP_SIZE / 2}
          r={MINIMAP_SIZE / 2 - 1}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={2}
        />

        <g clipPath={`url(#${clipId})`}>
          {/* Draw bots (only those within world bounds) */}
          {visibleBots.map((bot, index) => {
            if (!isWithinWorldBounds(bot.x, bot.y, bot.radius)) return null;
            const x = mapToMinimap(bot.x);
            const y = mapToMinimap(bot.y);
            const r = Math.max(1, Math.round(mapToMinimap(bot.radius)));
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={r}
                fill={bot.color || '#999'}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={0.5}
                opacity={0.95}
              />
            );
          })}

          {/* Draw player at center (always visible) */}
          <circle
            cx={mapToMinimap(playerCenter.x)}
            cy={mapToMinimap(playerCenter.y)}
            r={Math.max(3, Math.round(mapToMinimap(Math.max(6, playerRadius))))}
            fill="#2196F3"
            stroke="#0b3d91"
            strokeWidth={1.5}
          />

          {/* optional center marker ring */}
          <circle
            cx={MINIMAP_SIZE / 2}
            cy={MINIMAP_SIZE / 2}
            r={Math.max(0, Math.round(mapToMinimap(20)))}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />
        </g>
      </svg>
    </div>
  );
};

export default Minimap;