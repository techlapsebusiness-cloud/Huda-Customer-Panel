import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiEnvelope,
  OtpRequestResult,
  PatientAccountDto,
  PatientProfileDto,
  PatientSession,
} from './models';

const ACCESS_KEY = 'customer_app_access';
const REFRESH_KEY = 'customer_app_refresh';
const ACCOUNT_KEY = 'customer_app_account';
const ACTIVE_PROFILE_KEY = 'customer_app_active_profile';

@Injectable({ providedIn: 'root' })
export class PatientAuthService {
  readonly account = signal<PatientAccountDto | null>(readAccount());
  /** Linked clinic charts; refreshed by ProfileStore after login. */
  readonly profiles = signal<PatientProfileDto[]>([]);
  readonly activeProfileId = signal<string | null>(
    localStorage.getItem(ACTIVE_PROFILE_KEY)
  );

  readonly activeProfile = computed(() => {
    const list = this.profiles();
    if (!list.length) return null;
    const id = this.activeProfileId();
    return list.find((p) => p.id === id) ?? list[0];
  });

  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private http: HttpClient) {}

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  get isLoggedIn(): boolean {
    return Boolean(this.accessToken && this.account());
  }

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<OtpRequestResult>>(
        `${environment.apiBaseUrl}/patient-auth/otp/request`,
        { phone }
      )
    );
    return res.data;
  }

  async verifyOtp(
    phone: string,
    code: string,
    name?: string
  ): Promise<PatientSession> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<PatientSession>>(
        `${environment.apiBaseUrl}/patient-auth/otp/verify`,
        { phone, code, ...(name ? { name } : {}) }
      )
    );
    const session = res.data;
    localStorage.setItem(ACCESS_KEY, session.accessToken);
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(session.account));
    this.account.set(session.account);
    return session;
  }

  setProfiles(profiles: PatientProfileDto[]): void {
    this.profiles.set(profiles);
    const current = this.activeProfileId();
    if (!current || !profiles.some((p) => p.id === current)) {
      this.setActiveProfile(profiles[0]?.id ?? null);
    }
  }

  setActiveProfile(id: string | null): void {
    this.activeProfileId.set(id);
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }

  setAccount(account: PatientAccountDto): void {
    this.account.set(account);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  }

  /** Single-flight so a burst of 401s triggers exactly one rotation. */
  refresh(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await firstValueFrom(
        this.http.post<
          ApiEnvelope<{ accessToken: string; refreshToken: string }>
        >(`${environment.apiBaseUrl}/patient-auth/refresh`, { refreshToken })
      );
      localStorage.setItem(ACCESS_KEY, res.data.accessToken);
      localStorage.setItem(REFRESH_KEY, res.data.refreshToken);
      return true;
    } catch {
      this.clearLocal();
      return false;
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.refreshToken;
    if (refreshToken) {
      await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/patient-auth/logout`, {
          refreshToken,
        })
      ).catch(() => undefined);
    }
    this.clearLocal();
  }

  clearLocal(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    this.account.set(null);
    this.profiles.set([]);
    this.activeProfileId.set(null);
  }
}

function readAccount(): PatientAccountDto | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientAccountDto;
  } catch {
    return null;
  }
}
