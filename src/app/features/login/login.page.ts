import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
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
  alertCircleOutline,
  personOutline,
  personAddOutline,
  bookOutline
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
  private dataService = inject(DataService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  mode: 'login' | 'register' = 'login';
  loginForm: FormGroup;
  registerForm: FormGroup;
  authError: string | null = null;
  registerError: string | null = null;
  subjectLimitMsg: string | null = null;

  /** Catálogo oficial de asignaturas de iTUTOR y profesor titular que la imparte */
  readonly availableSubjects = [
    { name: 'Ecuaciones Diferenciales', teacherName: 'Elena Ramos', teacherEmail: 'elenaramos@itutor.es' },
    { name: 'Física Clásica & Mecánica', teacherName: 'Elena Ramos', teacherEmail: 'elenaramos@itutor.es' },
    { name: 'Astrofísica & Cinemática', teacherName: 'Elena Ramos', teacherEmail: 'elenaramos@itutor.es' },
    { name: 'Cálculo Multivariable', teacherName: 'Prof. Carlos Méndez', teacherEmail: 'carlosmendez@itutor.es' },
    { name: 'Álgebra Lineal', teacherName: 'Prof. Carlos Méndez', teacherEmail: 'carlosmendez@itutor.es' },
    { name: 'Termodinámica & Fluidos', teacherName: 'Miguel Ángel Santos', teacherEmail: 'miguelsantos@itutor.es' },
    { name: 'Electromagnetismo Avanzado', teacherName: 'Fernando Alonso', teacherEmail: 'fernandoalonso@itutor.es' },
    { name: 'Química Orgánica', teacherName: 'Carmen Delgado', teacherEmail: 'carmendelgado@itutor.es' }
  ];

  constructor() {
    addIcons({
      mailOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      arrowForwardOutline,
      schoolOutline,
      alertCircleOutline,
      personOutline,
      personAddOutline,
      bookOutline
    });

    this.loginForm = this.fb.group({
      email: [
        '', 
        [Validators.required, Validators.email],
        [this.emailExistsValidator(this.authService)] // Validación asíncrona
      ],
      password: ['', [Validators.required, Validators.minLength(5)]]
    });

    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      birthDate: ['2003-05-14', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(5)]],
      role: ['Standard' as 'Standard' | 'Teacher', [Validators.required]],
      subjects: [['Ecuaciones Diferenciales'] as string[], [Validators.required]]
    });

    // Limpiar el mensaje de error de contraseña al modificar los campos
    this.loginForm.valueChanges.subscribe(() => {
      if (this.authError) {
        this.authError = null;
        this.cdr.markForCheck();
      }
    });

    this.registerForm.valueChanges.subscribe(() => {
      if (this.registerError) {
        this.registerError = null;
        this.cdr.markForCheck();
      }
    });
  }

  switchMode(newMode: 'login' | 'register'): void {
    this.mode = newMode;
    this.authError = null;
    this.registerError = null;
    this.subjectLimitMsg = null;
    this.cdr.markForCheck();
  }

  selectRegisterRole(role: 'Standard' | 'Teacher'): void {
    this.subjectLimitMsg = null;
    const current: string[] = this.selectedSubjects;
    const trimmed = role === 'Teacher' && current.length > 3 ? current.slice(0, 3) : current;
    this.registerForm.patchValue({ role, subjects: trimmed });
    this.cdr.markForCheck();
  }

  get selectedSubjects(): string[] {
    return (this.registerForm.get('subjects')?.value as string[]) || [];
  }

  isSubjectSelected(subjectName: string): boolean {
    return this.selectedSubjects.includes(subjectName);
  }

  toggleSubjectSelection(subjectName: string): void {
    this.subjectLimitMsg = null;
    const role = this.registerForm.get('role')?.value as 'Standard' | 'Teacher';
    const current = [...this.selectedSubjects];
    const idx = current.indexOf(subjectName);

    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      if (role === 'Teacher' && current.length >= 3) {
        this.subjectLimitMsg = 'Como profesor/a puedes elegir un máximo de 3 asignaturas a impartir.';
        this.cdr.markForCheck();
        return;
      }
      current.push(subjectName);
    }

    this.registerForm.patchValue({ subjects: current });
    this.cdr.markForCheck();
  }

  /** Profesores que se le asignan al alumno según las asignaturas seleccionadas */
  get assignedTeachersForStudent(): { teacherName: string; teacherEmail: string; subjects: string[] }[] {
    const map = new Map<string, { teacherName: string; teacherEmail: string; subjects: string[] }>();
    for (const subName of this.selectedSubjects) {
      const found = this.availableSubjects.find(s => s.name === subName);
      if (found) {
        const existing = map.get(found.teacherEmail);
        if (existing) {
          existing.subjects.push(found.name);
        } else {
          map.set(found.teacherEmail, {
            teacherName: found.teacherName,
            teacherEmail: found.teacherEmail,
            subjects: [found.name]
          });
        }
      }
    }
    return [...map.values()];
  }

  onRegister(): void {
    if (this.registerForm.invalid || this.selectedSubjects.length === 0) {
      this.registerForm.markAllAsTouched();
      if (this.selectedSubjects.length === 0) {
        this.registerError = 'Selecciona al menos una asignatura.';
      }
      this.cdr.markForCheck();
      return;
    }

    const { name, birthDate, email, password, role } = this.registerForm.value;
    const subjects = this.selectedSubjects;
    try {
      const user = this.authService.register(name, email, password, role, { birthDate, subjects });
      if (role === 'Teacher') {
        this.dataService.registerTeacher({
          nombre: name,
          email,
          departamento: 'Matemáticas',
          especialidad: subjects.slice(0, 3).join(' • '),
          tarifaHora: 35
        });
        this.router.navigate(['/portal-profesor']);
      } else {
        const assigned = this.assignedTeachersForStudent;
        const primaryTeacherEmail = assigned[0]?.teacherEmail || 'elenaramos@itutor.es';
        this.dataService.registerStudent({
          nombre: name,
          email,
          profesorEmail: primaryTeacherEmail,
          asignatura: subjects.join(' • ')
        });
        this.router.navigate(['/mis-clases']);
      }
      void user;
    } catch {
      this.registerError = 'Este correo electrónico ya está registrado en iTUTOR.';
      this.cdr.markForCheck();
    }
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

  getDemoAvatar(email: string): string | null {
    return this.authService.getUserAvatar(email);
  }
}