import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'huda-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="huda-page-header">
      <div>
        @if (eyebrow) {
          <div class="huda-eyebrow">{{ eyebrow }}</div>
        }
        <h1>{{ title }}</h1>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>
      <div class="actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }
      .huda-eyebrow {
        margin-bottom: 4px;
      }
    `,
  ],
})
export class HudaPageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() eyebrow = '';
}
