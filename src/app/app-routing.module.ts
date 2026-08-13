import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

const routes: Routes = [
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./pages/appointments/appointments.page').then(
            (m) => m.AppointmentsPage
          ),
      },
      {
        path: 'records',
        loadComponent: () =>
          import('./pages/records/records.page').then((m) => m.RecordsPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  // Full-screen flows: pushed over the tab bar so the task owns the viewport.
  {
    path: 'book',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/book/book.page').then((m) => m.BookPage),
  },
  {
    path: 'appointment/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/appointment-detail/appointment-detail.page').then(
        (m) => m.AppointmentDetailPage
      ),
  },
  { path: '**', redirectTo: 'tabs/home' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
