import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Example auth UI: email/password sign-up and sign-in (Firebase Auth).
 * Replace styling with your design system as needed.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  displayName = '';
  mode = signal<'login' | 'signup'>('login');
  error = signal<string | null>(null);
  busy = signal(false);

  async submit(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      if (this.mode() === 'signup') {
        await this.authService.signUp(this.email, this.password, this.displayName || undefined);
      } else {
        await this.authService.login(this.email, this.password);
      }
      await this.router.navigateByUrl('/week');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Authentication failed.';
      this.error.set(msg);
    } finally {
      this.busy.set(false);
    }
  }

  toggleMode(): void {
    this.mode.update((m) => (m === 'login' ? 'signup' : 'login'));
    this.error.set(null);
  }
}
