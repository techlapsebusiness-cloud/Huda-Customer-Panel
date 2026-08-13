import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { PatientApiService } from '../../core/patient-api.service';
import { apiErrorMessage } from '../../core/toast.service';
import { AppointmentDto, statusLabel } from '../../core/models';
import {
  HudaBadgeComponent,
  HudaEmptyStateComponent,
  HudaPageHeaderComponent,
  hudaStatusBadge,
} from '../../shared/ui';

type Scope = 'upcoming' | 'past';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HudaPageHeaderComponent,
    HudaEmptyStateComponent,
    HudaBadgeComponent,
  ],
  templateUrl: './appointments.page.html',
  styleUrls: ['./appointments.page.scss'],
})
export class AppointmentsPage {
  scope: Scope = 'upcoming';
  items: AppointmentDto[] = [];
  loading = true;
  error = '';

  readonly statusLabel = statusLabel;

  constructor(
    private api: PatientApiService,
    private router: Router
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  badge(status: string) {
    return hudaStatusBadge(status);
  }

  async onScopeChange(value: string | number | undefined): Promise<void> {
    this.scope = (value as Scope) ?? 'upcoming';
    await this.load();
  }

  async load(event?: CustomEvent): Promise<void> {
    this.loading = !event;
    this.error = '';
    try {
      const res = await this.api.appointments(this.scope);
      this.items = res.items;
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load your visits.');
    } finally {
      this.loading = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  }

  open(id: string): void {
    void this.router.navigate(['/appointment', id]);
  }

  book(): void {
    void this.router.navigateByUrl('/book');
  }
}
