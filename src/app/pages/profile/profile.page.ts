import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { ToastService } from '../../core/toast.service';
import { PatientProfileDto } from '../../core/models';
import { HudaPageHeaderComponent, hudaInitials } from '../../shared/ui';

interface EditModel {
  name: string;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  bloodGroup: string;
  allergySuggestion: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HudaPageHeaderComponent],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {
  editing = false;
  saving = false;
  edit: EditModel = blankEdit();

  readonly bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  readonly initials = hudaInitials;

  constructor(
    public auth: PatientAuthService,
    private api: PatientApiService,
    private profiles: ProfileStore,
    private alerts: AlertController,
    private router: Router,
    private toast: ToastService
  ) {}

  ionViewWillEnter(): void {
    void this.profiles.load().catch(() => undefined);
  }

  formatVisit(value: string | null | undefined): string {
    const raw = String(value ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString();
  }

  get active(): PatientProfileDto | null {
    return this.auth.activeProfile();
  }

  get all(): PatientProfileDto[] {
    return this.auth.profiles();
  }

  get accountName(): string {
    return this.auth.account()?.name || 'Your account';
  }

  get accountPhone(): string {
    return this.auth.account()?.phone ?? '';
  }

  /** Nudge target: how much of the active chart is filled in. */
  get completion(): number {
    const p = this.active;
    if (!p) return 0;
    const checks = [
      Boolean(p.name),
      p.age > 0,
      Boolean(p.gender),
      Boolean(p.address),
      Boolean(p.bloodGroup),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  switchProfile(id: string): void {
    this.auth.setActiveProfile(id);
    this.editing = false;
  }

  startEdit(): void {
    const p = this.active;
    if (!p) return;
    this.edit = {
      name: p.name,
      age: p.age || null,
      gender: p.gender,
      address: p.address,
      bloodGroup: p.bloodGroup,
      allergySuggestion: '',
    };
    this.editing = true;
  }

  cancelEdit(): void {
    this.editing = false;
    this.edit = blankEdit();
  }

  async save(): Promise<void> {
    const p = this.active;
    if (!p || this.saving) return;
    this.saving = true;
    try {
      const patch: Record<string, unknown> = {
        name: this.edit.name.trim(),
        gender: this.edit.gender,
        address: this.edit.address.trim(),
        bloodGroup: this.edit.bloodGroup,
      };
      if (this.edit.age !== null) patch['age'] = this.edit.age;
      if (this.edit.allergySuggestion.trim()) {
        patch['allergySuggestion'] = this.edit.allergySuggestion.trim();
      }

      await this.api.updateProfile(p.id, patch);
      await this.profiles.load(true);
      this.editing = false;
      await this.toast.show(
        this.edit.allergySuggestion.trim()
          ? 'Saved. Allergy note sent to the clinic for review.'
          : 'Profile updated',
        'success'
      );
    } catch (e) {
      await this.toast.error(e, 'Could not save your details.');
    } finally {
      this.saving = false;
    }
  }

  async logout(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Sign out?',
      message: "You'll need your mobile number to sign back in.",
      buttons: [
        { text: 'Stay', role: 'cancel' },
        { text: 'Sign out', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    await this.auth.logout();
    this.profiles.reset();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

function blankEdit(): EditModel {
  return {
    name: '',
    age: null,
    gender: 'Other',
    address: '',
    bloodGroup: '',
    allergySuggestion: '',
  };
}
