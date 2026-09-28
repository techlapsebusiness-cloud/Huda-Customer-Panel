import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientBillDto } from '../../core/models';
import { apiErrorMessage } from '../../core/toast.service';
import { HudaPageHeaderComponent } from '../../shared/ui';

function rupees(paise: number): string {
  return `₹${(Math.max(0, paise) / 100).toFixed(2)}`;
}

@Component({
  selector: 'app-bill-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, HudaPageHeaderComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>Bill</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="huda-page">
      <div class="huda-page-pad">
        @if (loading) {
          <p>Loading bill…</p>
        } @else if (error) {
          <p>{{ error }}</p>
        } @else if (bill) {
          <huda-page-header
            [title]="bill.billNumber || 'Bill'"
            [subtitle]="bill.clinicName"
          ></huda-page-header>
          <div class="huda-card">
            <div class="huda-card-pad">
              @for (line of bill.lineItems; track line.id) {
                <div class="huda-row">
                  <span>{{ line.description }} × {{ line.quantity }}</span>
                  <span>{{ money(line.amountPaise) }}</span>
                </div>
              }
              <p>Subtotal {{ money(bill.subtotalPaise) }}</p>
              @if (bill.cgstPaise) {
                <p>CGST {{ money(bill.cgstPaise) }}</p>
              }
              @if (bill.sgstPaise) {
                <p>SGST {{ money(bill.sgstPaise) }}</p>
              }
              @if (bill.igstPaise) {
                <p>IGST {{ money(bill.igstPaise) }}</p>
              }
              @if (bill.roundOffPaise) {
                <p>Round off {{ money(bill.roundOffPaise) }}</p>
              }
              <p><strong>Total {{ money(bill.grandTotalPaise) }}</strong></p>
              <p>Paid {{ money(bill.amountPaidPaise) }}</p>
              <p>Balance {{ money(balance) }}</p>
              <p class="huda-meta">{{ statusLabel }}</p>
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class BillDetailPage implements OnInit {
  bill: PatientBillDto | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private api: PatientApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
  }

  get balance(): number {
    if (!this.bill) return 0;
    return Math.max(0, this.bill.grandTotalPaise - this.bill.amountPaidPaise);
  }

  get statusLabel(): string {
    if (this.bill?.paymentStatus === 'paid') return 'Paid';
    if (this.bill?.paymentStatus === 'partial') return 'Partially paid';
    return 'Unpaid';
  }

  money(paise: number): string {
    return rupees(paise);
  }

  async load(id: string): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.bill = await this.api.bill(id);
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not open this bill');
    } finally {
      this.loading = false;
    }
  }
}
