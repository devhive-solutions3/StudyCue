import type { ReactNode } from 'react';

/**
 * Soft ambient backdrop for the app shell. The actual radial accents live on
 * `body::before` in globals.css so they cover every page. This wrapper now
 * just owns a positioning context and a couple of low-opacity local glows that
 * sit *behind* the dashboard content without washing it out.
 */
export default function GlowBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full">
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: -260,
          right: -300,
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(107,99,212,0.16), transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(20px)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 220,
          left: -320,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(47,128,216,0.10), transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(20px)',
        }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
