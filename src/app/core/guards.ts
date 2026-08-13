import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PatientAuthService } from './patient-auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(PatientAuthService);
  const router = inject(Router);
  return auth.isLoggedIn ? true : router.parseUrl('/login');
};

/** Keeps a signed-in patient out of the login flow. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(PatientAuthService);
  const router = inject(Router);
  return auth.isLoggedIn ? router.parseUrl('/tabs/home') : true;
};
