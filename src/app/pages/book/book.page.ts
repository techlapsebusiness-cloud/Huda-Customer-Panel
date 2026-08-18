import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { apiErrorMessage, ToastService } from '../../core/toast.service';
import {
  AppointmentDto,
  ClinicDto,
  DirectoryClinic,
  ProviderDto,
  SlotDto,
} from '../../core/models';

interface DayOption {
  date: string;
  weekday: string;
  day: string;
  remaining: number | null;
  total: number | null;
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
export class BookPage implements OnInit, OnDestroy {
  linkedClinics: ClinicDto[] = [];
  searchHits: DirectoryClinic[] = [];
  providers: ProviderDto[] = [];
  slots: SlotDto[] = [];
  days: DayOption[] = [];
  dayRemaining: number | null = null;
  dayTotal: number | null = null;

  clinicQuery = '';
  selectedClinic: DirectoryClinic | null = null;
  providerId = '';
  date = '';
  startTime = '';
  reason = '';

  searchingClinics = false;
  loadingProviders = false;
  loadingSlots = false;
  loadingAvailability = false;
  submitting = false;
  error = '';

  /** Set once booking succeeds; the page then renders the confirmation. */
  booked: AppointmentDto | null = null;

  /** Reschedule mode: same picker, different commit action. */
  rescheduleId: string | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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

    await this.profiles.load().catch(() => undefined);
    this.linkedClinics = this.profiles
      .clinics()
      .filter((c) => c.bookingEnabled);

    const deepLink = this.route.snapshot.queryParamMap.get('clinic');
    if (deepLink) await this.selectClinicBySlug(deepLink);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  get clinicSlug(): string {
    return this.selectedClinic?.slug ?? '';
  }

  get clinicName(): string {
    return this.selectedClinic?.name ?? this.clinicSlug;
  }

  get canSubmit(): boolean {
    return Boolean(
      this.clinicSlug && this.providerId && this.date && this.startTime && !this.submitting
    );
  }

  get title(): string {
    return this.rescheduleId ? 'Reschedule visit' : 'Book appointment';
  }

  get freeSlotCount(): number {
    return this.slots.filter((s) => (s.remaining ?? 1) > 0).length;
  }

  get filteredLinkedClinics(): ClinicDto[] {
    const term = this.clinicQuery.trim().toLowerCase();
    if (!term) return this.linkedClinics;
    return this.linkedClinics.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || c.slug.toLowerCase().includes(term)
    );
  }

  onClinicSearch(ev: CustomEvent): void {
    const value = String((ev.detail as { value?: string }).value ?? '');
    this.clinicQuery = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const term = value.trim();
    if (term.length < 2) {
      this.searchHits = [];
      this.searchingClinics = false;
      return;
    }
    this.searchingClinics = true;
    this.searchTimer = setTimeout(() => void this.runClinicSearch(term), 300);
  }

  async pickClinic(clinic: DirectoryClinic): Promise<void> {
    this.selectedClinic = clinic;
    this.clinicQuery = '';
    this.searchHits = [];
    this.providerId = '';
    this.date = '';
    this.startTime = '';
    this.slots = [];
    this.dayRemaining = null;
    this.dayTotal = null;
    this.error = '';
    this.days = this.buildDays();
    await this.loadProviders();
  }

  changeClinic(): void {
    this.selectedClinic = null;
    this.providerId = '';
    this.date = '';
    this.startTime = '';
    this.slots = [];
    this.providers = [];
    this.days = [];
    this.dayRemaining = null;
    this.dayTotal = null;
    this.error = '';
  }

  async loadProviders(): Promise<void> {
    if (!this.clinicSlug) return;
    this.loadingProviders = true;
    this.error = '';
    this.providers = [];
    try {
      this.providers = await this.api.providers(this.clinicSlug);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load doctors.');
    } finally {
      this.loadingProviders = false;
    }
  }

  async selectProvider(id: string): Promise<void> {
    this.providerId = id;
    this.startTime = '';
    this.date = '';
    this.slots = [];
    await this.loadAvailability();
  }

  async selectDate(day: DayOption): Promise<void> {
    if (day.remaining === 0) return;
    this.date = day.date;
    this.startTime = '';
    this.dayRemaining = day.remaining;
    this.dayTotal = day.total;
    await this.loadSlots();
  }

  async loadAvailability(): Promise<void> {
    if (!this.days.length || !this.providerId) {
      this.days = this.days.map((d) => ({ ...d, remaining: null, total: null }));
      return;
    }
    this.loadingAvailability = true;
    try {
      const rows = await this.api.availability(
        this.clinicSlug,
        this.days[0].date,
        this.days[this.days.length - 1].date,
        this.providerId
      );
      const byDate = new Map(rows.map((r) => [r.date, r]));
      this.days = this.days.map((d) => {
        const hit = byDate.get(d.date);
        return {
          ...d,
          remaining: hit ? hit.remaining : 0,
          total: hit ? hit.total : 0,
        };
      });
      if (this.date) {
        const selected = this.days.find((d) => d.date === this.date);
        this.dayRemaining = selected?.remaining ?? null;
        this.dayTotal = selected?.total ?? null;
        if (selected?.remaining === 0) {
          this.date = '';
          this.startTime = '';
          this.slots = [];
        }
      }
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load available days.');
    } finally {
      this.loadingAvailability = false;
    }
  }

  async loadSlots(): Promise<void> {
    if (!this.date || !this.providerId) return;
    this.loadingSlots = true;
    this.error = '';
    this.slots = [];
    try {
      const grid = await this.api.slots(this.clinicSlug, this.date, this.providerId);
      this.slots = grid.slots;
      this.dayRemaining = grid.remaining;
      this.dayTotal = grid.total;
      this.days = this.days.map((d) =>
        d.date === this.date
          ? { ...d, remaining: grid.remaining, total: grid.total }
          : d
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
        patientName:
          this.auth.account()?.name?.trim() ||
          this.auth.activeProfile()?.name?.trim() ||
          undefined,
        workDate: this.date,
        startTime: this.startTime,
        providerMembershipId: this.providerId || undefined,
        reason: this.reason.trim() || undefined,
      });
      await this.profiles.load(true).catch(() => undefined);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not confirm the booking.');
      if (this.error.includes('no longer available')) {
        await this.loadAvailability();
        await this.loadSlots();
      }
    } finally {
      this.submitting = false;
    }
  }

  /** Book against the active profile only when it belongs to this clinic. */
  private profileIdForClinic(): string | undefined {
    const active = this.auth.activeProfile();
    return active && active.clinicSlug === this.clinicSlug ? active.id : undefined;
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

  remainingLabel(remaining: number | null): string {
    if (remaining === null) return '';
    if (remaining === 0) return 'Full';
    return remaining === 1 ? '1 left' : `${remaining} left`;
  }

  private async selectClinicBySlug(slug: string): Promise<void> {
    const linked = this.linkedClinics.find((c) => c.slug === slug);
    if (linked) {
      await this.pickClinic(this.toDirectory(linked));
      return;
    }
    const hits = await this.api.searchClinics(slug).catch(() => [] as DirectoryClinic[]);
    const hit = hits.find((c) => c.slug === slug) ?? hits[0];
    if (hit) {
      await this.pickClinic(hit);
      return;
    }
    await this.pickClinic({ slug, name: slug, address: '', phone: '' });
  }

  private async runClinicSearch(term: string): Promise<void> {
    try {
      const hits = await this.api.searchClinics(term);
      const linkedSlugs = new Set(this.linkedClinics.map((c) => c.slug));
      this.searchHits = hits.filter((c) => !linkedSlugs.has(c.slug));
    } catch {
      this.searchHits = [];
    } finally {
      this.searchingClinics = false;
    }
  }

  private toDirectory(c: ClinicDto): DirectoryClinic {
    return { slug: c.slug, name: c.name, address: c.address, phone: c.phone };
  }

  private buildDays(): DayOption[] {
    const linked = this.linkedClinics.find((c) => c.slug === this.clinicSlug);
    const ahead = Math.min(DAYS_AHEAD, linked?.maxAdvanceDays ?? DAYS_AHEAD);
    const out: DayOption[] = [];
    const base = new Date();
    for (let i = 0; i < ahead; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push({
        date: toIsoDate(d),
        weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        day: String(d.getDate()),
        remaining: null,
        total: null,
      });
    }
    return out;
  }
}

/** Local calendar date — `toISOString()` would shift back a day in IST. */
function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
