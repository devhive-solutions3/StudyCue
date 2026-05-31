'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

const SPRITE_URL = '/assets/sprite-aligned.png';
const SPRITE_COLUMNS = 4;
const SPRITE_ROWS = 2;
const SPRITE_FRAME_WIDTH = 384;
const SPRITE_FRAME_HEIGHT = 512;
const SPRITE_ASPECT_RATIO = SPRITE_FRAME_WIDTH / SPRITE_FRAME_HEIGHT;
const GLOW_FRAME_INDEX = 3;
const ANIMATION_DURATION_MS = 4200;

type AnimatedStudyCueLogoProps = {
  size?: number;
  className?: string;
  ariaLabel?: string;
  decorative?: boolean;
};

export default function AnimatedStudyCueLogo({
  size = 44,
  className,
  ariaLabel = 'StudyCue mascot',
  decorative = false,
}: AnimatedStudyCueLogoProps) {
  const [spriteReady, setSpriteReady] = useState(true);
  const frameDisplayHeight = size;
  const frameDisplayWidth = Math.round(size * SPRITE_ASPECT_RATIO);
  const sheetDisplayWidth = frameDisplayWidth * SPRITE_COLUMNS;
  const sheetDisplayHeight = frameDisplayHeight * SPRITE_ROWS;
  const glowFramePosition = -GLOW_FRAME_INDEX * frameDisplayWidth;

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setSpriteReady(true);
    image.onerror = () => setSpriteReady(false);
    image.src = SPRITE_URL;
  }, []);

  const fallbackClassName = className ? `${className} object-contain` : 'object-contain';

  if (!spriteReady) {
    return (
      <>
        <Image
          src="/cue-icon-light.png"
          alt={decorative ? '' : ariaLabel}
          aria-hidden={decorative}
          width={size}
          height={size}
          className={`${fallbackClassName} dark:hidden`}
          priority
        />
        <Image
          src="/cue-icon-dark-cropped.png"
          alt={decorative ? '' : ariaLabel}
          aria-hidden={decorative}
          width={size}
          height={size}
          className={`${fallbackClassName} hidden dark:block`}
          priority
        />
      </>
    );
  }

  return (
    <span
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative}
      role={decorative ? undefined : 'img'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        backgroundColor: 'transparent',
      }}
    >
      <span
        className="studycue-logo-motion"
        style={{
          display: 'inline-block',
          width: frameDisplayWidth,
          height: frameDisplayHeight,
          flexShrink: 0,
          '--studycue-animation-duration': `${ANIMATION_DURATION_MS}ms`,
        } as CSSProperties}
      >
        <span
          className="studycue-logo-frame"
          style={{
            display: 'inline-block',
            width: frameDisplayWidth,
            height: frameDisplayHeight,
            overflow: 'hidden',
            backgroundColor: 'transparent',
            backgroundImage: `url("${SPRITE_URL}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${sheetDisplayWidth}px ${sheetDisplayHeight}px`,
            backgroundPosition: '0px 0px',
            imageRendering: 'pixelated',
            flexShrink: 0,
            '--studycue-glow-frame-x': `${glowFramePosition}px`,
          } as CSSProperties}
        />
      </span>
      <style>{`
        @keyframes studycue-logo-frame-sequence {
          0%,
          21%,
          65%,
          100% {
            background-position: 0px 0px;
            filter: none;
          }
          22%,
          64% {
            background-position: var(--studycue-glow-frame-x) 0px;
            filter: drop-shadow(0 0 4px rgba(141, 255, 79, 0.85)) drop-shadow(0 0 9px rgba(54, 241, 151, 0.4));
          }
        }

        @keyframes studycue-logo-spin-sequence {
          0%,
          32% {
            transform: rotate(0deg) scale(1);
          }
          51% {
            transform: rotate(360deg) scale(1);
          }
          52%,
          100% {
            transform: rotate(360deg) scale(1);
          }
        }

        .studycue-logo-motion {
          transform-origin: center 55%;
          animation: studycue-logo-spin-sequence var(--studycue-animation-duration) cubic-bezier(0.2, 0.85, 0.2, 1) infinite;
          will-change: transform;
        }

        .studycue-logo-frame {
          animation: studycue-logo-frame-sequence var(--studycue-animation-duration) steps(1, end) infinite;
          will-change: background-position, filter;
        }

        @media (prefers-reduced-motion: reduce) {
          .studycue-logo-motion,
          .studycue-logo-frame {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
}
