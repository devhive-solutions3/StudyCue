'use client';

type Props = {
  open: boolean;
  onClose: () => void;
  featureLabel: string;
  planLabel?: string;
};

export default function PremiumStudyToolLockedModal({
  open,
  onClose,
  featureLabel,
  planLabel = 'Free',
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-tool-locked-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[16px] border border-border bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="study-tool-locked-title" className="text-lg font-semibold text-text-primary">
          {featureLabel}
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          Available for Beta and StudyCue Plus users. Your current plan:{' '}
          <span className="font-semibold text-text-primary">{planLabel}</span>.
        </p>
        <p className="mt-2 text-xs text-text-muted">Coming Soon for Free</p>
        <button type="button" onClick={onClose} className="sc-btn-secondary mt-5 w-full">
          Close
        </button>
      </div>
    </div>
  );
}
