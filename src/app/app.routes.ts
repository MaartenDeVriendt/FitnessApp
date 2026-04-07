import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard';
import { LoginComponent } from './login/login.component';
import { PrSummaryComponent } from './pr-summary/pr-summary.component';
import { ProgramEditorComponent } from './program-editor/program-editor.component';
import { WeekViewComponent } from './week-view/week-view.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'week' },
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: 'week', component: WeekViewComponent, canActivate: [authGuard] },
  { path: 'program', component: ProgramEditorComponent, canActivate: [authGuard] },
  { path: 'prs', component: PrSummaryComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'week' },
];
