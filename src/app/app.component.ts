import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { 
  IonApp, 
  IonSplitPane, 
  IonMenu, 
  IonContent, 
  IonList, 
  IonItem, 
  IonIcon, 
  IonLabel, 
  IonRouterOutlet, 
  IonMenuToggle, 
  IonBadge, 
  IonHeader, 
  IonToolbar, 
  IonFooter 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  gridOutline, 
  calendarOutline, 
  peopleOutline, 
  schoolOutline, 
  walletOutline, 
  settingsOutline, 
  logOutOutline, 
  sparklesOutline, 
  calculatorOutline, 
  flaskOutline, 
  chevronForwardOutline, 
  bookOutline, 
  personCircleOutline,
  checkmarkCircle
} from 'ionicons/icons';
import { AuthService } from './core/services/auth.service';

interface MenuItem {
  title: string;
  url: string;
  icon: string;
  badge?: string;
  role?: 'Admin' | 'Standard';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonSplitPane,
    IonMenu,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonMenuToggle,
    IonBadge,
    IonHeader,
    IonToolbar,
    IonFooter
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  /** Flujo reactivo del usuario en sesión */
  currentUser$ = this.authService.currentUser$;

  /** Enlaces de navegación con Lazy Loading */
  appPages: MenuItem[] = [
    { title: 'Dashboard General', url: '/admin-dashboard', icon: 'grid-outline', role: 'Admin' },
    { title: 'Mis Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Estudiantes', url: '/alumnos', icon: 'people-outline', badge: '68', role: 'Admin' },
    { title: 'Profesores Tutores', url: '/profesores', icon: 'school-outline', badge: '14', role: 'Admin' },
    { title: 'Facturación & Pagos', url: '/facturacion', icon: 'wallet-outline', role: 'Admin' },
    { title: 'Ajustes del Sistema', url: '/ajustes', icon: 'settings-outline' }
  ];

  constructor() {
    addIcons({
      gridOutline,
      calendarOutline,
      peopleOutline,
      schoolOutline,
      walletOutline,
      settingsOutline,
      logOutOutline,
      sparklesOutline,
      calculatorOutline,
      flaskOutline,
      chevronForwardOutline,
      bookOutline,
      personCircleOutline,
      checkmarkCircle
    });
  }

  /** Determina si nos encontramos en la pantalla de login para colapsar el menú */
  isLoginPage(): boolean {
    const currentUrl = this.router.url;
    return currentUrl === '/login' || currentUrl === '/' || currentUrl === '';
  }

  /** Obtiene las iniciales del usuario para el avatar */
  getUserInitials(email?: string | null): string {
    if (!email) return 'TF';
    const namePart = email.split('@')[0];
    return namePart.substring(0, 2).toUpperCase();
  }

  /** Nombre formateado para el perfil */
  getUserDisplayName(email?: string | null): string {
    if (!email) return 'Dra. Elena Ramos';
    if (email.includes('admin')) return 'Dra. Elena Ramos (Dirección)';
    if (email.includes('profesor')) return 'Prof. Carlos Méndez';
    return email.split('@')[0];
  }

  /** Cierre de sesión y redirección */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
