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
import { ApuntesService } from './core/services/apuntes.service';
import { ChatService } from './core/services/chat.service';
import { DataService } from './core/services/data.service';
import { ScheduleService } from './core/services/schedule.service';

export interface MenuItem {
  title: string;
  url: string;
  queryParams?: Record<string, string>;
  icon: string;
  /** Contador dinámico que se muestra junto al enlace (nada si es 0). */
  badge?: 'messages' | 'teachers' | 'students';
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
  /** Se instancia al arrancar: así los PDFs pendientes de enviar se reintentan desde cualquier pantalla. */
  private readonly apuntes = inject(ApuntesService);
  private readonly chat = inject(ChatService);
  private readonly data = inject(DataService);
  private readonly schedule = inject(ScheduleService);

  /** Flujo reactivo del usuario en sesión */
  currentUser$ = this.authService.currentUser$;

  /** 
   * Menú para el rol Administrador (Noelia Cantador - Jefa Coordinadora).
   * Portal del Profesor eliminado del dashboard de Noelia según especificación.
   */
  adminPages: MenuItem[] = [
    { title: 'Dashboard General', url: '/admin-dashboard', queryParams: { vista: 'metricas' }, icon: 'grid-outline' },
    { title: 'Listado de Profesores', url: '/admin-dashboard', queryParams: { vista: 'profesores' }, icon: 'school-outline', badge: 'teachers' },
    { title: 'Listado de Alumnos', url: '/admin-dashboard', queryParams: { vista: 'alumnos' }, icon: 'people-outline', badge: 'students' },
    { title: 'Calendario Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mensajes Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: 'messages' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' },
    { title: 'Ajustes de Cuenta', url: '/ajustes', icon: 'settings-outline' }
  ];

  /** Menú específico para Rol Profesor (Teacher) */
  teacherPages: MenuItem[] = [
    { title: 'Mi Portal Docente', url: '/portal-profesor', icon: 'school-outline' },
    { title: 'Mis Alumnos & Honorarios', url: '/portal-profesor', icon: 'wallet-outline' },
    { title: 'Calendario de Clases', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Subir Apuntes & PDFs', url: '/mis-apuntes', icon: 'document-text-outline' },
    { title: 'Mensajes con Alumnos', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: 'messages' },
    { title: 'Ajustes de Cuenta', url: '/ajustes', icon: 'settings-outline' }
  ];

  /** Menú específico para Alumno */
  studentPages: MenuItem[] = [
    { title: 'Mis Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mis Apuntes', url: '/mis-apuntes', icon: 'document-text-outline' },
    { title: 'Mensajes con Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: 'messages' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' },
    { title: 'Ajustes de Cuenta', url: '/ajustes', icon: 'settings-outline' }
  ];

  constructor() {
    // Al iniciar sesión (en cualquier dispositivo) se descargan de AWS los datos de ese usuario:
    // directorio de alumnos/profesores y sus clases. Así cada cuenta ve lo suyo.
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        void this.data.refreshDirectory();
        void this.schedule.refresh();
      }
    });
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
    // Sin sesión no se muestra ningún enlace (antes se caía por defecto en
    // el menú de administración de Noelia).
    if (!user) {
      return [];
    }
    if (user.role === 'Teacher') {
      return this.teacherPages;
    }
    if (user.role === 'Standard') {
      return this.studentPages;
    }
    return this.adminPages;
  }

  /**
   * Indica si el menú lateral debe ocultarse: en la pantalla de login (con
   * cualquier query string o fragmento, p. ej. `/login?returnUrl=...`), en la
   * raíz, o SIEMPRE que no haya una sesión activa, sea cual sea la ruta
   * escrita en la barra de direcciones.
   */
  isLoginPage(): boolean {
    if (!this.authService.isAuthenticated) {
      return true;
    }
    const cleanPath = (this.router.url || '').split(/[?#;]/)[0].replace(/\/+$/, '');
    return cleanPath === '' || cleanPath === '/login' || cleanPath.startsWith('/login/');
  }

  /** Contador del menú: mensajes sin leer o número de alumnos/profesores. Vacío si es 0. */
  badgeFor(page: MenuItem, user: User): number | null {
    let count = 0;
    if (page.badge === 'messages') {
      count = this.chat.totalUnread(user.email);
    } else if (page.badge === 'teachers') {
      count = this.data.allTeachers.length;
    } else if (page.badge === 'students') {
      count = this.data.allStudents.length;
    }
    return count > 0 ? count : null;
  }

  /** Obtiene las iniciales del usuario para el avatar (a partir de su nombre real) */
  getUserInitials(email?: string | null): string {
    if (!email) return '';
    const name = this.getUserDisplayName(email)
      .replace(/\b(Dra?\.|Prof\.)/g, '')
      .trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0] ?? email).substring(0, 2).toUpperCase();
  }

  /** Nombre formateado para el perfil: el que la persona dio al registrarse */
  getUserDisplayName(email?: string | null): string {
    if (!email) return '';
    const current = this.authService.currentUserValue;
    if (current && current.email.toLowerCase() === email.toLowerCase() && current.name) {
      return current.name;
    }
    return this.authService.getPublicAccount(email)?.name || email.split('@')[0];
  }
  /** Foto de perfil subida por el usuario (null si no ha subido ninguna) */
  getUserAvatar(email?: string | null): string | null {
    return this.authService.getUserAvatar(email);
  }

  /** Cierre de sesión y redirección */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
