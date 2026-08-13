import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PatientAuthService } from './patient-auth.service';

const AUTH_PATHS = [
  '/patient-auth/otp/request',
  '/patient-auth/otp/verify',
  '/patient-auth/refresh',
  '/patient-auth/logout',
];

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const auth = inject(PatientAuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith(environment.apiBaseUrl);
  const isAuthCall = AUTH_PATHS.some((p) => req.url.includes(p));

  const withHeaders = (r: HttpRequest<unknown>) => {
    let headers = r.headers.set('X-App-Id', 'customer_app');
    const token = auth.accessToken;
    if (isApi && !isAuthCall && token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return r.clone({ headers });
  };

  return next(withHeaders(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !isApi || isAuthCall) {
        return throwError(() => err);
      }
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.clearLocal();
            router.navigateByUrl('/login');
            return throwError(() => err);
          }
          return next(withHeaders(req));
        })
      );
    })
  );
}
