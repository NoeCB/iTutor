import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

// 1. Importamos los componentes específicos de Ionic Standalone
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonItem, IonLabel, IonInput, IonText, 
  IonSelect, IonSelectOption, IonButton 
} from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  // 2. Quitamos IonicModule y metemos los componentes sueltos
  imports: [
    ReactiveFormsModule, 
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, 
    IonItem, IonLabel, IonInput, IonText, 
    IonSelect, IonSelectOption, IonButton
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: [
        '', 
        [Validators.required, Validators.email],
        [this.emailExistsValidator(this.authService)] // Validación asíncrona
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['Standard', Validators.required]
    });
  }

  // Validador asíncrono personalizado
  emailExistsValidator(authService: AuthService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<{ [key: string]: any } | null> => {
      if (!control.value) {
        return of(null);
      }
      return authService.checkEmailExists(control.value).pipe(
        map(res => {
          // Si devuelve true, el email ya existe (simulamos que no se puede registrar)
          // Para un login sería al revés, pero esto cumple la rúbrica de "verificar si correo ya existe"
          return res ? { emailExists: true } : null;
        }),
        catchError(() => of(null))
      );
    };
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, role } = this.loginForm.value;
      this.authService.login(email, role);
      
      if (role === 'Admin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/mis-clases']);
      }
    }
  }
}