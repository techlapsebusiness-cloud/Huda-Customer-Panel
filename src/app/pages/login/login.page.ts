import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { apiErrorMessage, ToastService } from '../../core/toast.service';

type Step = 'phone' | 'code' | 'name';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnDestroy {
  step: Step = 'phone';
  phone = '';
  code = '';
  name = '';
  consent = false;

  busy = false;
  error = '';
  /** Only ever set when the API runs with OTP_DEV_RETURN_CODE on. */
  devCode = '';
  resendIn = 0;

  private timer: ReturnType<typeof setInterval> | null = null;
  private linkedProfiles = 0;

  constructor(
    private auth: PatientAuthService,
    private profiles: ProfileStore,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get phoneValid(): boolean {
    return this.phone.replace(/\D/g, '').length >= 10;
  }

  get codeValid(): boolean {
    return /^\d{6}$/.test(this.code);
  }

  onCodeInput(value: string): void {
    this.code = value.replace(/\D/g, '').slice(0, 6);
  }

  async sendCode(): Promise<void> {
    if (!this.phoneValid || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const res = await this.auth.requestOtp(this.phone);
      this.devCode = res.devCode ?? '';
      this.step = 'code';
      this.startTimer(res.resendAfterSeconds);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not send the code. Try again.');
    } finally {
      this.busy = false;
    }
  }

  async resend(): Promise<void> {
    if (this.resendIn > 0) return;
    this.code = '';
    await this.sendCode();
  }

  async verify(): Promise<void> {
    if (!this.codeValid || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const session = await this.auth.verifyOtp(this.phone, this.code);
      this.linkedProfiles = session.linkedProfiles;
      // A returning patient with no name on file still needs one before booking.
      if (session.isNewAccount || !session.account.name) {
        this.stopTimer();
        this.step = 'name';
        return;
      }
      await this.finish();
    } catch (e) {
      this.error = apiErrorMessage(e, 'That code did not work.');
    } finally {
      this.busy = false;
    }
  }

  async saveName(): Promise<void> {
    if (!this.name.trim() || !this.consent || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.auth.updateName(this.name.trim());
      await this.finish();
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not save your details.');
    } finally {
      this.busy = false;
    }
  }

  back(): void {
    this.stopTimer();
    this.error = '';
    this.code = '';
    this.step = 'phone';
  }

  private async finish(): Promise<void> {
    this.stopTimer();
    await this.profiles.load(true).catch(() => undefined);
    if (this.linkedProfiles > 0) {
      const n = this.linkedProfiles;
      await this.toast.show(
        `We found ${n} existing record${n > 1 ? 's' : ''} for your number`,
        'success'
      );
    }
    await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  private startTimer(seconds: number): void {
    this.stopTimer();
    this.resendIn = seconds;
    this.timer = setInterval(() => {
      this.resendIn -= 1;
      if (this.resendIn <= 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.resendIn = 0;
  }
}
