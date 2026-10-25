import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

// 1. Importamos los componentes específicos de Ionic Standalone (sin IonSelect ya que el rol se detecta automáticamente)
import { IonContent } from '@ionic/angular/ion-content';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonInput } from '@ionic/angular/ion-input';
import { IonText } from '@ionic/angular/ion-text';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { addIcons } from 'ionicons';
import { 
  mailOutline, 
  lockClosedOutline, 
  shieldCheckmarkOutline, 
  arrowForwardOutline,
  schoolOutline,
  alertCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    CommonModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonItem, 
    IonInput, 
    IonText, 
    IonButton,
    IonIcon,
    IonSpinner
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  // Inyección mediante la función inject() (patrón recomendado en Angular
  // moderno). Se declara ANTES de loginForm para que las dependencias estén
  // resueltas cuando el constructor construya el formulario reactivo.
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loginForm: FormGroup;
  authError: string | null = null;

  constructor() {
    addIcons({
      mailOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      arrowForwardOutline,
      schoolOutline,
      alertCircleOutline
    });

    this.loginForm = this.fb.group({
      email: [
        '', 
        [Validators.required, Validators.email],
        [this.emailExistsValidator(this.authService)] // Validación asíncrona
      ],
      password: ['', [Validators.required, Validators.minLength(5)]]
    });

    // Limpiar el mensaje de error de contraseña al modificar los campos
    this.loginForm.valueChanges.subscribe(() => {
      if (this.authError) {
        this.authError = null;
        this.cdr.markForCheck();
      }
    });
  }

  // Validador asíncrono personalizado: verifica si el correo pertenece a una cuenta registrada en iTUTOR
  emailExistsValidator(authService: AuthService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<{ [key: string]: any } | null> => {
      if (!control.value) {
        return of(null);
      }
      return authService.checkEmailExists(control.value).pipe(
        map(exists => {
          // Si existe en la base de datos (noeliacantador@itutor.es o paulagarcia@itutor.es), es válido (null)
          return exists ? null : { emailNotRegistered: true };
        }),
        catchError(() => of(null))
      );
    };
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      const loggedUser = this.authService.authenticate(email, password);

      if (!loggedUser) {
        this.authError = 'Contraseña incorrecta. Verifica tus credenciales.';
        this.cdr.markForCheck();
        return;
      }

      if (loggedUser.role === 'Admin') {
        this.router.navigate(['/admin-dashboard']);
      } else if (loggedUser.role === 'Teacher') {
        this.router.navigate(['/portal-profesor']);
      } else {
        this.router.navigate(['/mis-clases']);
      }
    }
  }

  /** Rellena credenciales demo para pruebas rápidas de evaluación */
  fillDemoAccount(type: 'admin' | 'alumna' | 'profesora'): void {
    if (type === 'admin') {
      this.loginForm.patchValue({
        email: 'noeliacantador@itutor.es',
        password: 'noelia'
      });
    } else if (type === 'profesora') {
      this.loginForm.patchValue({
        email: 'elenaramos@itutor.es',
        password: 'elena'
      });
    } else {
      this.loginForm.patchValue({
        email: 'paulagarcia@itutor.es',
        password: 'paula'
      });
    }
    this.loginForm.get('email')?.markAsTouched();
    this.loginForm.get('password')?.markAsTouched();
    this.authError = null;
    this.cdr.markForCheck();
  }
}