import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'huda-empty-state',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="huda-empty">
      <div class="tile">
        <ion-icon [name]="icon"></ion-icon>
      </div>
      <h3>{{ title }}</h3>
      @if (body) {
        <p>{{ body }}</p>
      }
      <div class="cta">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .cta {
        margin-top: 16px;
      }
      .tile ion-icon {
        font-size: 28px;
      }
    `,
  ],
})
export class HudaEmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() body = '';
  @Input() icon = 'folder-open-outline';
}
