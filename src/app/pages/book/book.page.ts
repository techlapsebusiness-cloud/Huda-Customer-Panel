import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../../environments/environment';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { apiErrorMessage, ToastService } from '../../core/toast.service';
import {
  AppointmentDto,
  ClinicDto,
  ProviderDto,
  SlotDto,
} from '../../core/models';

interface DayOption {
  date: string;
  weekday: string;
  day: string;
}

/** How far ahead the date strip runs; the API still enforces maxAdvanceDays. */
const DAYS_AHEAD = 14;

@Component({
  selector: 'app-book',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, QRCodeComponent],
  templateUrl: './book.page.html',
  styleUrls: ['./book.page.scss'],
})
export class BookPage implements OnInit {
  clinics: ClinicDto[] = [];
  providers: ProviderDto[] = [];
  slots: SlotDto[] = [];
  days: DayOption[] = [];

  clinicSlug = '';
  providerId = '';
  date = '';
  startTime = '';
  reason = '';

  loadingProviders = true;
  loadingSlots = false;
  submitting = false;
  error = '';

  /** Set once booking succeeds; the page then renders the confirmation. */
  booked: AppointmentDto | null = null;

  /** Reschedule mode: same picker, different commit action. */
  rescheduleId: string | null = null;

  constructor(
    private api: PatientApiService,
    private auth: PatientAuthService,
    private profiles: ProfileStore,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.rescheduleId = this.route.snapshot.queryParamMap.get('reschedule');
    this.days = buildDays();

    await this.profiles.load().catch(() => undefined);
    const linked = this.profiles
      .clinics()
      .filter((c) => c.bookingEnabled);
    this.clinics = linked;
    this.clinicSlug =
      this.route.snapshot.queryParamMap.get('clinic') ??
      linked[0]?.slug ??
      environment.defaultClinicSlug;

    await this.loadProviders();
  }

  get clinicName(): string {
    return (
      this.clinics.find((c) => c.slug === this.clinicSlug)?.name ??
      this.clinicSlug
    );
  }

  get canSubmit(): boolean {
    return Boolean(this.date && this.startTime && !this.submitting);
  }

  get title(): string {
    return this.rescheduleId ? 'Reschedule visit' : 'Book appointment';
  }

  async loadProviders(): Promise<void> {
    this.loadingProviders = true;
    this.error = '';
    try {
      this.providers = await this.api.providers(this.clinicSlug);
      if (this.providers.length === 1) this.providerId = this.providers[0].id;
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load doctors.');
    } finally {
      this.loadingProviders = false;
    }
  }

  async onClinicChange(): Promise<void> {
    this.providerId = '';
    this.date = '';
    this.startTime = '';
    this.slots = [];
    await this.loadProviders();
  }

  async selectProvider(id: string): Promise<void> {
    this.providerId = id;
    this.startTime = '';
    if (this.date) await this.loadSlots();
  }

  async selectDate(date: string): Promise<void> {
    this.date = date;
    this.startTime = '';
    await this.loadSlots();
  }

  async loadSlots(): Promise<void> {
    if (!this.date) return;
    if (this.providers.length > 1 && !this.providerId) return;
    this.loadingSlots = true;
    this.error = '';
    this.slots = [];
    try {
      this.slots = await this.api.slots(
        this.clinicSlug,
        this.date,
        this.providerId || undefined
      );
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load available times.');
    } finally {
      this.loadingSlots = false;
    }
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = '';
    try {
      if (this.rescheduleId) {
        await this.api.reschedule(this.rescheduleId, {
          workDate: this.date,
          startTime: this.startTime,
          providerMembershipId: this.providerId || undefined,
        });
        await this.toast.show('Appointment moved', 'success');
        await this.router.navigate(['/appointment', this.rescheduleId], {
          replaceUrl: true,
        });
        return;
      }

      this.booked = await this.api.book({
        clinicSlug: this.clinicSlug,
        patientId: this.profileIdForClinic(),
        workDate: this.date,
        startTime: this.startTime,
        providerMembershipId: this.providerId || undefined,
        reason: this.reason.trim() || undefined,
      });
      // A first booking at a new clinic creates a chart + link.
      await this.profiles.load(true).catch(() => undefined);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not confirm the booking.');
      if (this.error.includes('no longer available')) await this.loadSlots();
    } finally {
      this.submitting = false;
    }
  }

  /** Book against the active profile only when it belongs to this clinic. */
  private profileIdForClinic(): string | undefined {
    const active = this.auth.activeProfile();
    return active && active.clinicSlug === this.clinicSlug
      ? active.id
      : undefined;
  }

  viewAppointment(): void {
    if (!this.booked) return;
    void this.router.navigate(['/appointment', this.booked.id], {
      replaceUrl: true,
    });
  }

  done(): void {
    void this.router.navigateByUrl('/tabs/appointments', { replaceUrl: true });
  }
}

function buildDays(): DayOption[] {
  const out: DayOption[] = [];
  const base = new Date();
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      date: toIsoDate(d),
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: String(d.getDate()),
    });
  }
  return out;
}

/** Local calendar date — `toISOString()` would shift back a day in IST. */
function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
