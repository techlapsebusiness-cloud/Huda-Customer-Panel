import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionSheetController, AlertController, IonicModule } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PatientApiService } from '../../core/patient-api.service';
import { PatientAuthService } from '../../core/patient-auth.service';
import { ProfileStore } from '../../core/profile.store';
import { apiErrorMessage, ToastService } from '../../core/toast.service';
import {
  DocumentDto,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  UPLOAD_TYPES,
} from '../../core/models';
import { HudaEmptyStateComponent, HudaPageHeaderComponent } from '../../shared/ui';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HudaPageHeaderComponent,
    HudaEmptyStateComponent,
  ],
  templateUrl: './records.page.html',
  styleUrls: ['./records.page.scss'],
})
export class RecordsPage {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  documents: DocumentDto[] = [];
  filter: DocumentType | 'all' = 'all';
  loading = true;
  uploading = false;
  error = '';

  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly uploadTypes = UPLOAD_TYPES;

  /** Chosen in the sheet, applied to the next picked file. */
  private pendingType: DocumentType = 'lab_report';

  constructor(
    private api: PatientApiService,
    private auth: PatientAuthService,
    private profiles: ProfileStore,
    private sheets: ActionSheetController,
    private alerts: AlertController,
    private toast: ToastService
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  get filtered(): DocumentDto[] {
    return this.filter === 'all'
      ? this.documents
      : this.documents.filter((d) => d.type === this.filter);
  }

  get activeProfileName(): string {
    return this.auth.activeProfile()?.name ?? '';
  }

  async load(event?: CustomEvent): Promise<void> {
    this.error = '';
    try {
      await this.profiles.load();
      this.documents = await this.api.documents();
    } catch (e) {
      this.error = apiErrorMessage(e, 'Could not load your records.');
    } finally {
      this.loading = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  }

  async startUpload(): Promise<void> {
    if (!this.auth.activeProfile()) {
      await this.toast.show(
        'Book a visit first so the clinic has a record to attach to.',
        'danger'
      );
      return;
    }

    const typeSheet = await this.sheets.create({
      header: 'What are you uploading?',
      buttons: [
        ...this.uploadTypes.map((t) => ({
          text: t.label,
          handler: () => {
            this.pendingType = t.value;
            void this.pickSource();
            return true;
          },
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await typeSheet.present();
  }

  private async pickSource(): Promise<void> {
    const sheet = await this.sheets.create({
      header: 'Add from',
      buttons: [
        {
          text: 'Take a photo',
          icon: 'camera-outline',
          handler: () => {
            void this.captureFromCamera(CameraSource.Camera);
            return true;
          },
        },
        {
          text: 'Choose from gallery',
          icon: 'images-outline',
          handler: () => {
            void this.captureFromCamera(CameraSource.Photos);
            return true;
          },
        },
        {
          text: 'Pick a file (PDF)',
          icon: 'document-outline',
          handler: () => {
            this.fileInput?.nativeElement.click();
            return true;
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async captureFromCamera(source: CameraSource): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
      });
      if (!photo.webPath) return;
      const blob = await fetch(photo.webPath).then((r) => r.blob());
      const ext = photo.format === 'png' ? 'png' : 'jpg';
      await this.upload(blob, `${this.pendingType}-${Date.now()}.${ext}`);
    } catch (e) {
      // The plugin also throws when the user simply backs out of the picker.
      if (!isCancellation(e)) {
        await this.toast.error(e, 'Could not open the camera.');
      }
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.upload(file, file.name);
  }

  private async upload(file: File | Blob, fileName: string): Promise<void> {
    const profile = this.auth.activeProfile();
    if (!profile) return;
    this.uploading = true;
    try {
      const doc = await this.api.uploadDocument({
        patientId: profile.id,
        type: this.pendingType,
        file,
        fileName,
      });
      this.documents = [doc, ...this.documents];
      await this.toast.show('Uploaded', 'success');
    } catch (e) {
      await this.toast.error(e, 'Upload failed.');
    } finally {
      this.uploading = false;
    }
  }

  async remove(doc: DocumentDto): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Remove this file?',
      message: doc.originalName || this.typeLabels[doc.type],
      buttons: [
        { text: 'Keep', role: 'cancel' },
        { text: 'Remove', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    try {
      await this.api.deleteDocument(doc.id);
      this.documents = this.documents.filter((d) => d.id !== doc.id);
      await this.toast.show('Removed', 'success');
    } catch (e) {
      await this.toast.error(e, 'Could not remove the file.');
    }
  }

  sizeLabel(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function isCancellation(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? '').toLowerCase();
  return msg.includes('cancel') || msg.includes('denied');
}
