import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private toasts: ToastController) {}

  async show(
    message: string,
    color: 'success' | 'danger' | 'medium' = 'medium'
  ): Promise<void> {
    const t = await this.toasts.create({
      message,
      duration: color === 'danger' ? 3500 : 2200,
      color,
      position: 'top',
    });
    await t.present();
  }

  /** Surfaces the server's own message so policy errors read as guidance. */
  async error(err: unknown, fallback = 'Something went wrong'): Promise<void> {
    await this.show(apiErrorMessage(err, fallback), 'danger');
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: { message?: string } } | null;
    if (body?.error?.message) return body.error.message;
    if (err.status === 0) return 'Cannot reach the clinic server';
  }
  return fallback;
}
