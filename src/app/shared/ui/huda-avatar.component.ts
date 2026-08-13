import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { hudaInitials } from './huda-ui.utils';

@Component({
  selector: 'huda-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="huda-avatar" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.36">{{
    text
  }}</span>`,
})
export class HudaAvatarComponent {
  @Input() name = '';
  @Input() size = 36;

  get text(): string {
    return hudaInitials(this.name);
  }
}
