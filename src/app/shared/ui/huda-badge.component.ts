import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type HudaBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'huda-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="huda-badge" [ngClass]="variant">{{ label }}</span>`,
})
export class HudaBadgeComponent {
  @Input({ required: true }) label!: string;
  @Input() variant: HudaBadgeVariant = 'neutral';
}
