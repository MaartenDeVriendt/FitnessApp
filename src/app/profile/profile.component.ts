import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  nickname = '';
  displayName = '';
  bio = '';
  heightCm: number | null = null;
  weightKg: number | null = null;

  busy = false;
  message: string | null = null;
  error: string | null = null;

  emailPreview = '';

  ngOnInit(): void {
    this.profileService.profile$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        if (!p) return;
        this.emailPreview = p.email ?? '';
        this.nickname = p.nickname?.trim() ?? '';
        this.displayName = p.displayName?.trim() ?? '';
        this.bio = p.bio?.trim() ?? '';
        this.heightCm = p.heightCm ?? null;
        this.weightKg = p.weightKg ?? null;
      });
  }

  async save(): Promise<void> {
    this.error = null;
    this.message = null;
    this.busy = true;
    try {
      await this.profileService.saveProfile({
        nickname: this.nickname,
        displayName: this.displayName,
        bio: this.bio,
        heightCm: this.heightCm,
        weightKg: this.weightKg,
      });
      this.message = 'Profile saved.';
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Could not save profile.';
    } finally {
      this.busy = false;
    }
  }
}
