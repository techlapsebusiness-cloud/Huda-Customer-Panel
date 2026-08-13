import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { apiErrorMessage } from '../../core/toast.service';
import {
  AppointmentDto,
  DocumentDto,
  DOCUMENT_TYPE_LABELS,
  QueueStatusDto,
  statusLabel,
} from '../../core/models';
import {
  HudaBadgeComponent,
  HudaEmptyStateComponent,
  HudaPageHeaderComponent,
  hudaStatusBadge,
} from '../../shared/ui';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    HudaPageHeaderComponent,
    HudaEmptyStateComponent,
    HudaBadgeComponent,
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  upcoming: AppointmentDto[] = [];
  recentDocs: DocumentDto[] = [];
  queue: QueueStatusDto | null = null;
  loading = true;
  error = '';

  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly statusLabel = statusLabel;

  constructor(
    private api: PatientApiService,
    public auth: PatientAuthService,
    private profiles: ProfileStore,
    private router: Router
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  get greetingName(): string {
    const full = this.auth.account()?.name?.trim();
    return full ? full.split(/\s+/)[0] : 'there';
  }

  get nextAppointment(): AppointmentDto | null {
    return this.upcoming[0] ?? null;
  }

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  badge(status: string) {
    return hudaStatusBadge(status);
  }

  async load(event?: CustomEvent): Promise<void> {
    this.error = '';
    try {
      await this.profiles.load(Boolean(event));
      const [appts, docs] = await Promise.all([
        this.api.appointments('upcoming'),
        this.api.documents().catch(() => [] as DocumentDto[]),
      ]);
      this.upcoming = appts.items;
      this.recentDocs = docs.slice(0, 3);

      const next = this.nextAppointment;
      this.queue =
        next && next.date === this.today
          ? await this.api.queueStatus(next.id).catch(() => null)
          : null;
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load your dashboard.');
    } finally {
      this.loading = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  }

  openAppointment(id: string): void {
    void this.router.navigate(['/appointment', id]);
  }

  book(): void {
    void this.router.navigateByUrl('/book');
  }
}
