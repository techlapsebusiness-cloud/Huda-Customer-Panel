import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ProfileStore } from '../../core/profile.store';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="huda-tabbar">
        <ion-tab-button tab="home">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="appointments">
          <ion-icon name="calendar-outline"></ion-icon>
          <ion-label>Visits</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="records">
          <ion-icon name="document-text-outline"></ion-icon>
          <ion-label>Records</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile">
          <ion-icon name="person-outline"></ion-icon>
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage implements OnInit {
  constructor(private profiles: ProfileStore) {}

  ngOnInit(): void {
    // Warm the shared profile list once for every tab.
    void this.profiles.load().catch(() => undefined);
  }
}
