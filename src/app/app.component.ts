import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonApp } from '@ionic/angular/ion-app';
import { IonSplitPane } from '@ionic/angular/ion-split-pane';
import { IonMenu } from '@ionic/angular/ion-menu';
import { IonContent } from '@ionic/angular/ion-content';
import { IonList } from '@ionic/angular/ion-list';
import { IonItem } from '@ionic/angular/ion-item';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonFooter } from '@ionic/angular/ion-footer';
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
  checkmarkCircle,
  documentTextOutline,
  chatbubblesOutline,
  cardOutline
} from 'ionicons/icons';
import { AuthService, User } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';

export interface MenuItem {
  title: string;
  url: string;
  queryParams?: Record<string, string>;
  icon: string;
  badge?: string;
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
  public sidebarService = inject(SidebarService);

  /** Flujo reactivo del usuario en sesión */
  currentUser$ = this.authService.currentUser$;

  /** 
   * Menú para el rol Administrador (Noelia Cantador - Jefa Coordinadora).
   * Portal del Profesor eliminado del dashboard de Noelia según especificación.
   */
  adminPages: MenuItem[] = [
    { title: 'Dashboard General', url: '/admin-dashboard', queryParams: { vista: 'metricas' }, icon: 'grid-outline' },
    { title: 'Listado de Profesores', url: '/admin-dashboard', queryParams: { vista: 'profesores' }, icon: 'school-outline', badge: '10' },
    { title: 'Listado de Alumnos', url: '/admin-dashboard', queryParams: { vista: 'alumnos' }, icon: 'people-outline', badge: '10' },
    { title: 'Calendario Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mensajes Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: '3' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' }
  ];

  /** Menú específico para Rol Profesor (Teacher) */
  teacherPages: MenuItem[] = [
    { title: 'Mi Portal Docente', url: '/portal-profesor', icon: 'school-outline' },
    { title: 'Mis Alumnos & Honorarios', url: '/portal-profesor', icon: 'wallet-outline' },
    { title: 'Calendario de Clases', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mensajes con Alumnos', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: '2' }
  ];

  /** Menú específico para Alumno (Paula García) */
  studentPages: MenuItem[] = [
    { title: 'Mis Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mis Apuntes', url: '/mis-apuntes', icon: 'document-text-outline', badge: '6' },
    { title: 'Mensajes con Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: '2' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' }
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
      checkmarkCircle,
      documentTextOutline,
      chatbubblesOutline,
      cardOutline
    });
  }

  /** Devuelve los enlaces del menú según el rol del usuario conectado */
  getMenuPages(user?: User | null): MenuItem[] {
    if (user?.role === 'Teacher') {
      return this.teacherPages;
    }
    if (user?.role === 'Standard') {
      return this.studentPages;
    }
    return this.adminPages;
  }

  /** Determina si nos encontramos en la pantalla de login para colapsar el menú */
  isLoginPage(): boolean {
    const currentUrl = this.router.url;
    return currentUrl === '/login' || currentUrl === '/' || currentUrl === '';
  }

  /** Obtiene las iniciales del usuario para el avatar */
  getUserInitials(email?: string | null): string {
    if (!email) return 'NC';
    if (email.toLowerCase().includes('noelia')) return 'NC';
    if (email.toLowerCase().includes('paula')) return 'PG';
    if (email.toLowerCase().includes('elena') || email.toLowerCase().includes('profesor')) return 'ER';
    if (email.toLowerCase().includes('carlos')) return 'CM';
    const namePart = email.split('@')[0];
    return namePart.substring(0, 2).toUpperCase();
  }

  /** Nombre formateado para el perfil */
  getUserDisplayName(email?: string | null): string {
    if (!email) return 'Noelia Cantador';
    if (email.toLowerCase().includes('noelia')) return 'Noelia Cantador';
    if (email.toLowerCase().includes('paula')) return 'Paula García';
    if (email.toLowerCase().includes('elena') || email.toLowerCase().includes('profesor')) return 'Dra. Elena Ramos';
    if (email.toLowerCase().includes('carlos')) return 'Prof. Carlos Méndez';
    return email.split('@')[0];
  }

  /** Cierre de sesión y redirección */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
