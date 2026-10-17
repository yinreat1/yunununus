import { LicenseStatus } from '@/lib/types';
import { STATUS_CONFIG, getEffectiveStatus } from '@/lib/utils';

interface StatusBadgeProps {
  status: LicenseStatus;
  expiresAt?: string | null;
}

export function StatusBadge({ status, expiresAt }: StatusBadgeProps) {
  const effective = getEffectiveStatus(status, expiresAt || null);
  const config = STATUS_CONFIG[effective];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bgColor} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}
