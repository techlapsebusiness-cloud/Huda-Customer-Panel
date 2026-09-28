import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiEnvelope,
  AppointmentDetailDto,
  AppointmentDto,
  ClinicDto,
  DirectoryClinic,
  DayAvailabilityDto,
  DocumentDto,
  DocumentType,
  PaginationMeta,
  PatientAccountDto,
  PatientProfileDto,
  PatientBillDto,
  ProviderDto,
  QueueStatusDto,
  SlotDto,
} from './models';

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Wrapper over the patient-scoped API (`/patient/...`). Unlike the staff
 * `ApiService`, there is no `/projects/{slug}` prefix — a patient token carries
 * no clinic claim, so the clinic travels in the payload where it is needed.
 */
@Injectable({ providedIn: 'root' })
export class PatientApiService {
  constructor(private http: HttpClient) {}

  private url(path: string): string {
    return `${environment.apiBaseUrl}/patient${path}`;
  }

  private toParams(params?: Params): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  private get<T>(path: string, params?: Params): Promise<ApiEnvelope<T>> {
    return firstValueFrom(
      this.http.get<ApiEnvelope<T>>(this.url(path), {
        params: this.toParams(params),
      })
    );
  }

  private post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return firstValueFrom(
      this.http.post<ApiEnvelope<T>>(this.url(path), body ?? {})
    );
  }

  async me(): Promise<{
    account: PatientAccountDto;
    profiles: PatientProfileDto[];
  }> {
    const res = await this.get<{
      account: PatientAccountDto;
      profiles: PatientProfileDto[];
    }>('/me');
    return res.data;
  }

  async clinics(): Promise<ClinicDto[]> {
    return (await this.get<ClinicDto[]>('/clinics')).data;
  }

  async searchClinics(q: string): Promise<DirectoryClinic[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<DirectoryClinic[]>>(
        `${environment.apiBaseUrl}/public/booking/clinics`,
        { params: this.toParams({ q: term }) }
      )
    );
    return res.data;
  }

  async updateProfile(
    patientId: string,
    patch: Record<string, unknown>
  ): Promise<PatientProfileDto> {
    const res = await firstValueFrom(
      this.http.patch<ApiEnvelope<PatientProfileDto>>(
        this.url(`/profile/${patientId}`),
        patch
      )
    );
    return res.data;
  }

  async providers(clinicSlug: string): Promise<ProviderDto[]> {
    return (await this.get<ProviderDto[]>('/providers', { clinicSlug })).data;
  }

  async slots(
    clinicSlug: string,
    date: string,
    providerId?: string
  ): Promise<{ workDate: string; remaining: number; total: number; slots: SlotDto[] }> {
    const res = await this.get<{
      workDate: string;
      remaining: number;
      total: number;
      slots: SlotDto[];
    }>('/slots', { clinicSlug, date, providerId });
    return res.data;
  }

  async availability(
    clinicSlug: string,
    from: string,
    to: string,
    providerId?: string
  ): Promise<DayAvailabilityDto[]> {
    const res = await this.get<{
      from: string;
      to: string;
      days: DayAvailabilityDto[];
    }>('/availability', { clinicSlug, from, to, providerId });
    return res.data.days;
  }

  async appointments(
    scope: 'upcoming' | 'past' | 'all' = 'all',
    patientId?: string
  ): Promise<{ items: AppointmentDto[]; meta?: PaginationMeta }> {
    const res = await this.get<AppointmentDto[]>('/appointments', {
      scope,
      patientId,
    });
    return { items: res.data, meta: res.meta };
  }

  async appointment(id: string): Promise<AppointmentDetailDto> {
    return (await this.get<AppointmentDetailDto>(`/appointments/${id}`)).data;
  }

  async book(payload: {
    clinicSlug: string;
    patientId?: string;
    patientName?: string;
    workDate: string;
    startTime: string;
    providerMembershipId?: string;
    reason?: string;
  }): Promise<AppointmentDto> {
    return (await this.post<AppointmentDto>('/appointments', payload)).data;
  }

  async cancel(id: string, reason?: string): Promise<AppointmentDto> {
    return (
      await this.post<AppointmentDto>(`/appointments/${id}/cancel`, { reason })
    ).data;
  }

  async reschedule(
    id: string,
    payload: {
      workDate: string;
      startTime: string;
      providerMembershipId?: string;
    }
  ): Promise<AppointmentDto> {
    return (
      await this.post<AppointmentDto>(`/appointments/${id}/reschedule`, payload)
    ).data;
  }

  async queueStatus(appointmentId: string): Promise<QueueStatusDto> {
    return (await this.get<QueueStatusDto>('/queue-status', { appointmentId }))
      .data;
  }

  async documents(
    patientId?: string,
    type?: DocumentType
  ): Promise<DocumentDto[]> {
    return (await this.get<DocumentDto[]>('/documents', { patientId, type }))
      .data;
  }

  async uploadDocument(payload: {
    patientId: string;
    type: DocumentType;
    category?: string;
    file: File | Blob;
    fileName: string;
  }): Promise<DocumentDto> {
    const form = new FormData();
    // Text fields first: the server resolves the upload target from them while
    // the file part is still streaming.
    form.append('patientId', payload.patientId);
    form.append('type', payload.type);
    if (payload.category) form.append('category', payload.category);
    form.append('file', payload.file, payload.fileName);

    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<DocumentDto>>(this.url('/documents'), form)
    );
    return res.data;
  }

  async deleteDocument(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(this.url(`/documents/${id}`)));
  }

  async bills(patientId?: string): Promise<PatientBillDto[]> {
    return (await this.get<PatientBillDto[]>('/bills', { patientId })).data;
  }

  async bill(id: string): Promise<PatientBillDto> {
    return (await this.get<PatientBillDto>(`/bills/${id}`)).data;
  }
}
