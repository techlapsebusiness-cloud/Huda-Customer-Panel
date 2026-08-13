import type { HudaBadgeVariant } from './huda-badge.component';

/** Map appointment / bill / message status strings to `.huda-badge` variants. */
export function hudaStatusBadge(status: string): HudaBadgeVariant {
  const s = (status || '').toLowerCase().replace(/_/g, '-');
  if (['completed', 'paid', 'sent', 'active', 'confirmed', 'success'].includes(s)) return 'success';
  if (['pending', 'pending-review', 'partial', 'scheduled', 'warning'].includes(s)) return 'warning';
  if (['cancelled', 'canceled', 'no-show', 'void', 'failed', 'danger'].includes(s)) return 'danger';
  if (['checked-in', 'in-progress', 'issued', 'unpaid', 'info'].includes(s)) return 'info';
  return 'neutral';
}

export function hudaInitials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
