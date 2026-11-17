import { AlertTriangle, ArchiveX, Info, RefreshCw } from 'lucide-react';
import type { ResourceDisclosure } from '../utils/resourceAvailability';

interface ResourceDisclosureBannerProps {
  disclosure: ResourceDisclosure;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

export function ResourceDisclosureBanner({
  disclosure,
  onRetry,
  retryLabel = 'Retry Load',
  compact = false,
}: ResourceDisclosureBannerProps) {
  const isErrorTone =
    disclosure.category === 'network_or_server_error' ||
    disclosure.category === 'invalid_or_unreadable' ||
    disclosure.category === 'missing_required_input';

  const containerClass = isErrorTone
    ? 'border border-[#8a1253] bg-[#8a1253]/10 text-[#8a1253]'
    : disclosure.category === 'excluded_from_distribution'
    ? 'border border-[#6b4c1b]/50 bg-[#6b4c1b]/10 text-[var(--color-ink)]'
    : 'border border-[var(--color-rule)] bg-[var(--color-well)] text-[var(--color-ink)]';

  const Icon = isErrorTone
    ? AlertTriangle
    : disclosure.category === 'excluded_from_distribution'
    ? ArchiveX
    : Info;

  return (
    <div
      role={isErrorTone ? 'alert' : 'status'}
      data-availability-category={disclosure.category}
      className={`${containerClass} ${compact ? 'px-3 py-2' : 'p-3.5'} text-xs flex flex-wrap items-start justify-between gap-2`}
    >
      <div className="flex items-start gap-2 max-w-4xl">
        <Icon
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            isErrorTone ? 'text-[#8a1253]' : disclosure.category === 'excluded_from_distribution' ? 'text-[#6b4c1b]' : 'text-[#163d4a]'
          }`}
        />
        <div className="space-y-0.5">
          <div className="font-semibold">
            {disclosure.headline}
          </div>
          <p className={isErrorTone ? 'text-[#8a1253]' : 'text-[var(--color-ink-2)]'}>
            {disclosure.detail}
          </p>
          {disclosure.availableSummary && (
            <p className="text-[11px] text-[var(--color-muted)]">
              <b>Available in this view:</b> {disclosure.availableSummary}
            </p>
          )}
        </div>
      </div>
      {disclosure.isRetryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="almanac-btn text-[11px] flex items-center gap-1 shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
