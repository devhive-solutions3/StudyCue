'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const SPRITE_URL = '/assets/sprite.png';
const SPRITE_COLUMNS = 4;
const SPRITE_ROWS = 2;
const SPRITE_TOTAL_FRAMES = SPRITE_COLUMNS * SPRITE_ROWS;
const SPRITE_FRAME_WIDTH = 384;
const SPRITE_FRAME_HEIGHT = 512;
const SPRITE_ASPECT_RATIO = SPRITE_FRAME_WIDTH / SPRITE_FRAME_HEIGHT;
const FRAME_DURATION_MS = 180;

type AnimatedStudyCueLogoProps = {
  size?: number;
  className?: string;
  ariaLabel?: string;
  decorative?: boolean;
};

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

export default function AnimatedStudyCueLogo({
  size = 44,
  className,
  ariaLabel = 'StudyCue mascot',
  decorative = false,
}: AnimatedStudyCueLogoProps) {
  const reducedMotion = useReducedMotion();
  const [frameIndex, setFrameIndex] = useState(0);
  const [spriteReady, setSpriteReady] = useState(true);
  const frameDisplayHeight = size;
  const frameDisplayWidth = Math.round(size * SPRITE_ASPECT_RATIO);
  const sheetDisplayWidth = frameDisplayWidth * SPRITE_COLUMNS;
  const sheetDisplayHeight = frameDisplayHeight * SPRITE_ROWS;

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setSpriteReady(true);
    image.onerror = () => setSpriteReady(false);
    image.src = SPRITE_URL;
  }, []);

  useEffect(() => {
    if (reducedMotion || !spriteReady) return;
    const intervalId = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % SPRITE_TOTAL_FRAMES);
    }, FRAME_DURATION_MS);
    return () => window.clearInterval(intervalId);
  }, [reducedMotion, spriteReady]);

  const framePosition = useMemo(() => {
    const column = frameIndex % SPRITE_COLUMNS;
    const row = Math.floor(frameIndex / SPRITE_COLUMNS);
    return {
      x: -column * frameDisplayWidth,
      y: -row * frameDisplayHeight,
    };
  }, [frameDisplayHeight, frameDisplayWidth, frameIndex]);

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
        style={{
          display: 'inline-block',
          width: frameDisplayWidth,
          height: frameDisplayHeight,
          overflow: 'hidden',
          backgroundColor: 'transparent',
          backgroundImage: `url("${SPRITE_URL}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${sheetDisplayWidth}px ${sheetDisplayHeight}px`,
          backgroundPosition: `${framePosition.x}px ${framePosition.y}px`,
          imageRendering: 'pixelated',
          flexShrink: 0,
        }}
      />
    </span>
  );
}
