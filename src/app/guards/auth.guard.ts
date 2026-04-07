import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';

/**
 * Wait until Firebase has finished restoring the session from persistence, then allow the route
 * only if signed in; otherwise send the user to `/login`.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.authStateReady();
  return auth.currentUser ? true : router.createUrlTree(['/login']);
};

/**
 * Same readiness as above: `/login` is only for signed-out users; signed-in users go to `/week`.
 */
export const loginGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.authStateReady();
  return auth.currentUser ? router.createUrlTree(['/week']) : true;
};
