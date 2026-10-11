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
  checkmarkCircle,
  documentTextOutline,
  chatbubblesOutline
} from 'ionicons/icons';
import { AuthService, User } from './core/services/auth.service';

interface MenuItem {
  title: string;
  url: string;
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

  /** Flujo reactivo del usuario en sesión */
  currentUser$ = this.authService.currentUser$;

  /** Menú para el rol Administrador (Noelia Cantador) */
  adminPages: MenuItem[] = [
    { title: 'Dashboard General', url: '/admin-dashboard', icon: 'grid-outline' },
    { title: 'Calendario Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Apuntes & Recursos', url: '/mis-apuntes', icon: 'document-text-outline', badge: '6' },
    { title: 'Mensajes Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: '3' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' },
    { title: 'Ajustes del Sistema', url: '/ajustes', icon: 'settings-outline' }
  ];

  /** Menú específico para Alumno (Paula García) */
  studentPages: MenuItem[] = [
    { title: 'Mis Tutorías', url: '/mis-clases', icon: 'calendar-outline' },
    { title: 'Mis Apuntes', url: '/mis-apuntes', icon: 'document-text-outline', badge: '6' },
    { title: 'Mensajes con Profesores', url: '/mensajes-profesores', icon: 'chatbubbles-outline', badge: '2' },
    { title: 'Facturación & Pagos', url: '/mis-pagos', icon: 'wallet-outline' },
    { title: 'Ajustes de Cuenta', url: '/ajustes', icon: 'settings-outline' }
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
      chatbubblesOutline
    });
  }

  /** Devuelve los enlaces del menú según el rol del usuario conectado */
  getMenuPages(user?: User | null): MenuItem[] {
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
    const namePart = email.split('@')[0];
    return namePart.substring(0, 2).toUpperCase();
  }

  /** Nombre formateado para el perfil */
  getUserDisplayName(email?: string | null): string {
    if (!email) return 'Noelia Cantador';
    if (email.toLowerCase().includes('noelia')) return 'Noelia Cantador';
    if (email.toLowerCase().includes('paula')) return 'Paula García';
    return email.split('@')[0];
  }

  /** Cierre de sesión y redirección */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
