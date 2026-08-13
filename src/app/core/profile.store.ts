import { Injectable, signal } from '@angular/core';
import { PatientApiService } from './patient-api.service';
import { PatientAuthService } from './patient-auth.service';
import { ClinicDto } from './models';

/**
 * Loads the account's linked charts once per session and keeps them in the
 * auth service so every tab reads the same active profile.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  readonly clinics = signal<ClinicDto[]>([]);
  readonly loaded = signal(false);

  private inFlight: Promise<void> | null = null;

  constructor(
    private api: PatientApiService,
    private auth: PatientAuthService
  ) {}

  /** @param force refetch even when already loaded (after booking at a new clinic) */
  load(force = false): Promise<void> {
    if (this.loaded() && !force) return Promise.resolve();
    if (!this.inFlight) {
      this.inFlight = this.doLoad().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async doLoad(): Promise<void> {
    const [me, clinics] = await Promise.all([
      this.api.me(),
      this.api.clinics().catch(() => [] as ClinicDto[]),
    ]);
    this.auth.setAccount(me.account);
    this.auth.setProfiles(me.profiles);
    this.clinics.set(clinics);
    this.loaded.set(true);
  }

  reset(): void {
    this.clinics.set([]);
    this.loaded.set(false);
  }
}
