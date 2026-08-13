import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PatientApiService } from '../../core/patient-api.service';
import { apiErrorMessage, ToastService } from '../../core/toast.service';
import {
  AppointmentDetailDto,
  AppointmentStatus,
  DocumentDto,
  DOCUMENT_TYPE_LABELS,
  QueueStatusDto,
  statusLabel,
} from '../../core/models';
import { HudaBadgeComponent, hudaStatusBadge } from '../../shared/ui';

const QUEUE_POLL_MS = 10_000;

/** Steps a normal OPD visit walks through, in order. */
const TIMELINE: { status: AppointmentStatus; label: string }[] = [
  { status: 'scheduled', label: 'Booked' },
  { status: 'confirmed', label: 'Confirmed by clinic' },
  { status: 'checked-in', label: 'Checked in at desk' },
  { status: 'in-progress', label: 'With the doctor' },
  { status: 'completed', label: 'Visit complete' },
];

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'checked-in',
  'in-progress',
];

@Component({
  selector: 'app-appointment-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, QRCodeComponent, HudaBadgeComponent],
  templateUrl: './appointment-detail.page.html',
  styleUrls: ['./appointment-detail.page.scss'],
})
export class AppointmentDetailPage {
  appt: AppointmentDetailDto | null = null;
  queue: QueueStatusDto | null = null;
  documents: DocumentDto[] = [];
  loading = true;
  error = '';
  acting = false;

  readonly timeline = TIMELINE;
  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly statusLabel = statusLabel;

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private api: PatientApiService,
    private route: ActivatedRoute,
    private router: Router,
    private alerts: AlertController,
    private toast: ToastService
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  ionViewWillLeave(): void {
    this.stopPolling();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  get isToday(): boolean {
    return this.appt?.date === new Date().toISOString().slice(0, 10);
  }

  get isActive(): boolean {
    return Boolean(this.appt && ACTIVE_STATUSES.includes(this.appt.status));
  }

  get showQueue(): boolean {
    return this.isToday && this.isActive;
  }

  get canCancel(): boolean {
    const p = this.appt?.selfService;
    return Boolean(
      p?.allowCancel &&
        this.appt &&
        ['scheduled', 'confirmed'].includes(this.appt.status)
    );
  }

  get canReschedule(): boolean {
    const p = this.appt?.selfService;
    if (!p?.allowReschedule || !this.appt) return false;
    if (!['scheduled', 'confirmed'].includes(this.appt.status)) return false;
    return this.appt.rescheduleCount < p.maxReschedules;
  }

  /** How full the wait is, for the flat progress meter. */
  get queueProgress(): number {
    const q = this.queue;
    if (!q || q.myToken === null || q.nowServing === null) return 0;
    const total = q.myToken;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (q.nowServing / total) * 100));
  }

  badge(status: string) {
    return hudaStatusBadge(status);
  }

  stepClass(index: number): string {
    if (!this.appt) return '';
    if (this.appt.status === 'cancelled' || this.appt.status === 'no-show') {
      return index === 0 ? 'done' : '';
    }
    const current = TIMELINE.findIndex((s) => s.status === this.appt!.status);
    if (index < current) return 'done';
    if (index === current) return 'current';
    return '';
  }

  async load(event?: CustomEvent): Promise<void> {
    this.error = '';
    try {
      this.appt = await this.api.appointment(this.id);
      this.documents = await this.api
        .documents(this.appt.patientId)
        .catch(() => [] as DocumentDto[]);
      if (this.showQueue) {
        await this.pollQueue();
        this.startPolling();
      } else {
        this.queue = null;
        this.stopPolling();
      }
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load this appointment.');
    } finally {
      this.loading = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => void this.pollQueue(), QUEUE_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollQueue(): Promise<void> {
    if (!this.appt) return;
    try {
      const next = await this.api.queueStatus(this.appt.id);
      this.queue = next;
      // Staff moved the visit on; refresh the header without a full reload.
      if (this.appt.status !== next.status) {
        this.appt = { ...this.appt, status: next.status };
      }
      if (!next.isActive) this.stopPolling();
    } catch {
      // A dropped poll is not worth interrupting the page for.
    }
  }

  async cancel(): Promise<void> {
    if (!this.appt || this.acting) return;
    const alert = await this.alerts.create({
      header: 'Cancel this appointment?',
      message: 'Your token will be released to other patients.',
      inputs: [
        {
          name: 'reason',
          type: 'text',
          placeholder: 'Reason (optional)',
        },
      ],
      buttons: [
        { text: 'Keep it', role: 'cancel' },
        { text: 'Cancel visit', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    this.acting = true;
    try {
      await this.api.cancel(this.appt.id, data?.values?.reason || undefined);
      await this.toast.show('Appointment cancelled', 'success');
      this.stopPolling();
      await this.load();
    } catch (e) {
      await this.toast.error(e, 'Could not cancel the appointment.');
    } finally {
      this.acting = false;
    }
  }

  reschedule(): void {
    if (!this.appt) return;
    void this.router.navigate(['/book'], {
      queryParams: {
        reschedule: this.appt.id,
        clinic: this.appt.clinicSlug,
      },
    });
  }

  callClinic(): void {
    const phone = this.appt?.clinicPhone;
    if (phone) window.open(`tel:${phone}`, '_system');
  }
}
