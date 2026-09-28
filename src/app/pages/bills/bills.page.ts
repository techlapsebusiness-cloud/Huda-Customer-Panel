import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { PatientBillDto } from '../../core/models';
import { apiErrorMessage } from '../../core/toast.service';
import { HudaEmptyStateComponent, HudaPageHeaderComponent } from '../../shared/ui';

function rupees(paise: number): string {
  return `₹${(Math.max(0, paise) / 100).toFixed(2)}`;
}

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    HudaPageHeaderComponent,
    HudaEmptyStateComponent,
  ],
  template: `
    <ion-content class="huda-page">
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <div class="huda-page-pad">
        <huda-page-header
          title="Bills"
          subtitle="Issued bills for your linked profiles"
        ></huda-page-header>
        @if (loading) {
          <div class="huda-card">
            <div class="huda-card-pad">
              <ion-skeleton-text animated style="width: 60%; height: 16px"></ion-skeleton-text>
            </div>
          </div>
        } @else if (error) {
          <div class="huda-card">
            <div class="huda-card-pad">
              <p>{{ error }}</p>
              <ion-button size="small" (click)="load()">Retry</ion-button>
            </div>
          </div>
        } @else if (!bills.length) {
          <huda-empty-state
            title="No bills yet"
            body="Issued clinic and pharmacy bills will show up here."
          ></huda-empty-state>
        } @else {
          <div class="huda-stack">
            @for (bill of bills; track bill.id) {
              <button type="button" class="huda-card bill-row" (click)="open(bill.id)">
                <div class="huda-card-pad">
                  <div class="huda-row">
                    <strong>{{ bill.billNumber || 'Bill' }}</strong>
                    <span>{{ label(bill) }}</span>
                  </div>
                  <p class="huda-meta">{{ bill.clinicName || bill.type }} · {{ when(bill) }}</p>
                  <p>Total {{ money(bill.grandTotalPaise) }} · Balance {{ money(balance(bill)) }}</p>
                </div>
              </button>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .bill-row {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
      }
    `,
  ],
})
export class BillsPage implements OnInit {
  bills: PatientBillDto[] = [];
  loading = true;
  error = '';

  constructor(
    private api: PatientApiService,
    private auth: PatientAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(event?: CustomEvent): Promise<void> {
    this.loading = this.bills.length === 0;
    this.error = '';
    try {
      const patientId = this.auth.activeProfileId() ?? undefined;
      this.bills = await this.api.bills(patientId);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load bills');
    } finally {
      this.loading = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete?.();
    }
  }

  open(id: string): void {
    void this.router.navigate(['/bill', id]);
  }

  money(paise: number): string {
    return rupees(paise);
  }

  balance(bill: PatientBillDto): number {
    return Math.max(0, (bill.grandTotalPaise ?? 0) - (bill.amountPaidPaise ?? 0));
  }

  label(bill: PatientBillDto): string {
    if (bill.paymentStatus === 'paid') return 'Paid';
    if (bill.paymentStatus === 'partial') return 'Partial';
    return 'Unpaid';
  }

  when(bill: PatientBillDto): string {
    const raw = bill.issuedAt;
    if (!raw) return '';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : d.toLocaleDateString();
  }
}
