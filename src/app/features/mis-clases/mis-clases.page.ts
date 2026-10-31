import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  timeOutline, 
  personOutline, 
  videocamOutline, 
  documentTextOutline, 
  chatbubblesOutline, 
  walletOutline, 
  downloadOutline, 
  sendOutline, 
  checkmarkCircleOutline, 
  schoolOutline, 
  bookOutline, 
  cardOutline, 
  sparklesOutline,
  chevronBackOutline,
  chevronForwardOutline,
  settingsOutline,
  notificationsOutline,
  shieldCheckmarkOutline,
  folderOpenOutline,
  receiptOutline,
  menuOutline,
  addCircleOutline,
  closeOutline,
  swapHorizontalOutline,
  cloudUploadOutline,
  eyeOutline,
  cameraOutline,
  trashOutline,
  lockClosedOutline
} from 'ionicons/icons';
import jsPDF from 'jspdf';
import { SidebarService } from '../../core/services/sidebar.service';
import { AuthService, User } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ScheduleService, ScheduledClass } from '../../core/services/schedule.service';
import { DataService, SqlStudentRate } from '../../core/services/data.service';
import { ApuntesService, ApunteItem } from '../../core/services/apuntes.service';

export interface TutoriaSession {
  day: number;
  dateLabel: string;
  subject: string;
  topic: string;
  teacher: string;
  teacherRole: string;
  teacherInitials: string;
  teacherEmail: string;
  time: string;
  duration: string;
  room: string;
  status: 'Confirmada' | 'Completada' | 'Próxima';
  price: number;
  notes: string;
  color: string;
}

export type StudentNoteItem = ApunteItem;

export interface TeacherConversation {
  id: string;
  peerEmail?: string;
  teacherName: string;
  subject: string;
  initials: string;
  online: boolean;
  unread: number;
  messages: {
    /** 'peer' = escrito por la otra persona de la conversación */
    sender: 'teacher' | 'student' | 'coordinator' | 'peer';
    text: string;
    time: string;
  }[];
}

export interface StudentPaymentRecord {
  id: string;
  date: string;
  concept: string;
  subject: string;
  teacher: string;
  method: string;
  amount: number;
  /** 'Pendiente' = clase agendada aún sin abonar (no hay pasarela de pago real) */
  status: 'Pagado' | 'Pendiente';
}

export interface CalendarCell {
  day: number | null;
  isCurrentMonth: boolean;
  session?: TutoriaSession;
}

@Component({
  selector: 'app-mis-clases',
  standalone: true,
  templateUrl: './mis-clases.page.html',
  styleUrls: ['./mis-clases.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonButtons, 
    IonButton, 
    IonIcon, 
    IonBadge, 
    IonCard, 
    IonCardContent
  ]
})
export class MisClasesPage implements OnInit, OnDestroy {
  private apuntes = inject(ApuntesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public sidebarService = inject(SidebarService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private scheduleService = inject(ScheduleService);
  private dataService = inject(DataService);

  get currentUser(): User | null {
    return this.authService.currentUserValue;
  }

  get isCoordinator(): boolean {
    const user = this.currentUser;
    return user?.role === 'Admin' || (user?.email?.toLowerCase().includes('noelia') ?? false);
  }

  get isTeacher(): boolean {
    const user = this.currentUser;
    return user?.role === 'Teacher';
  }

  toggleMenu(): void {
    this.sidebarService.toggleMenu();
  }

  /** Sección activa: 'tutorias' | 'apuntes' | 'mensajes' | 'pagos' | 'ajustes' */
  activeSection: 'tutorias' | 'apuntes' | 'mensajes' | 'pagos' | 'ajustes' = 'tutorias';

  /**
   * Cuentas demo (alumna Paula, profesora Elena y coordinadora Noelia): conservan el
   * contenido de ejemplo. Cualquier otra cuenta solo ve sus propios datos reales.
   */
  private static readonly DEMO_VIEW = new Set([
    'paulagarcia@itutor.es',
    'elenaramos@itutor.es',
    'noeliacantador@itutor.es'
  ]);
  private static readonly COORDINATOR_EMAIL = 'noeliacantador@itutor.es';
  private static readonly PALETTE = ['#2563eb', '#10b981', '#6366f1', '#f59e0b', '#ec4899'];

  private get isDemoView(): boolean {
    return MisClasesPage.DEMO_VIEW.has(this.myEmail);
  }

  private get myEmail(): string {
    return (this.currentUser?.email || '').toLowerCase();
  }

  /** Sesiones del mes visible (se rehacen en ebuildCalendar()) */
  sessionsMap: Record<number, TutoriaSession> = {};
  private subs: Subscription[] = [];

  /** Mes que se está viendo en el calendario (month: 0 = enero) */
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  /** Día seleccionado del mes visible */
  selectedDay = 1;
  /** `true` cuando el usuario ya ha cambiado de mes a mano (no se vuelve a saltar solo) */
  private monthTouched = false;
  /** Días de la semana (Lunes a Domingo) */
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /** Sesiones de ejemplo de la alumna demo en Octubre 2026 (solo cuentas demo) */
  private readonly demoSessions: Record<number, TutoriaSession> = {
    3: {
      day: 3,
      dateLabel: 'Sábado, 3 de Octubre de 2026',
      subject: 'Ecuaciones Diferenciales',
      topic: 'EDOs de Primer Orden y Variables Separables',
      teacher: 'Elena Ramos',
      teacherRole: 'Catedrática de Matemáticas Aplicadas',
      teacherInitials: 'ER',
      teacherEmail: 'elenaramos@itutor.es',
      time: '11:00 - 12:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala HD #04',
      status: 'Completada',
      price: 35,
      notes: 'Se resolvieron 6 problemas de ecuaciones exactas y factor integrante. Paula domina el método.',
      color: '#2563eb'
    },
    6: {
      day: 6,
      dateLabel: 'Martes, 6 de Octubre de 2026',
      subject: 'Cálculo Multivariable',
      topic: 'Integrales Dobles en Coordenadas Polares',
      teacher: 'Prof. Carlos Méndez',
      teacherRole: 'Profesor Titular de Análisis Matemático',
      teacherInitials: 'CM',
      teacherEmail: 'carlosmendez@itutor.es',
      time: '17:30 - 19:00',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala HD #02',
      status: 'Completada',
      price: 35,
      notes: 'Cambio de variables y cálculo del Jacobiano en recintos circulares.',
      color: '#10b981'
    },
    10: {
      day: 10,
      dateLabel: 'Sábado, 10 de Octubre de 2026',
      subject: 'Ecuaciones Diferenciales',
      topic: 'Transformada de Laplace y Sistemas de EDOs de 2º Orden',
      teacher: 'Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elenaramos@itutor.es',
      time: '11:00 - 12:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala Interactiva #04',
      status: 'Confirmada',
      price: 35,
      notes: 'Resolución paso a paso de problemas de valor inicial (PVI) mediante Transformada de Laplace e inversa por fracciones simples.',
      color: '#2563eb'
    },
    15: {
      day: 15,
      dateLabel: 'Jueves, 15 de Octubre de 2026',
      subject: 'Álgebra Lineal',
      topic: 'Diagonalización Ortogonal y Formas Cuadráticas',
      teacher: 'Prof. Carlos Méndez',
      teacherRole: 'Profesor Titular de Análisis y Álgebra',
      teacherInitials: 'CM',
      teacherEmail: 'carlosmendez@itutor.es',
      time: '18:00 - 19:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala HD #02',
      status: 'Confirmada',
      price: 35,
      notes: 'Cálculo de autovalores, autovectores y matriz de paso ortogonal.',
      color: '#6366f1'
    },
    20: {
      day: 20,
      dateLabel: 'Martes, 20 de Octubre de 2026',
      subject: 'Ecuaciones Diferenciales',
      topic: 'Series de Potencias y Método de Frobenius',
      teacher: 'Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elenaramos@itutor.es',
      time: '17:00 - 18:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala Interactiva #04',
      status: 'Próxima',
      price: 35,
      notes: 'Preparación del primer control parcial. Revisaremos ecuaciones de Legendre y Bessel.',
      color: '#2563eb'
    },
    24: {
      day: 24,
      dateLabel: 'Sábado, 24 de Octubre de 2026',
      subject: 'Ecuaciones Diferenciales',
      topic: 'Simulacro de Examen Parcial Resuelto',
      teacher: 'Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elenaramos@itutor.es',
      time: '11:00 - 12:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala Interactiva #04',
      status: 'Próxima',
      price: 35,
      notes: 'Simulacro cronometrado con corrección en pizarra digital compartida.',
      color: '#2563eb'
    },
    29: {
      day: 29,
      dateLabel: 'Jueves, 29 de Octubre de 2026',
      subject: 'Cálculo Multivariable',
      topic: 'Teorema de Green y Campos Conservativos',
      teacher: 'Prof. Carlos Méndez',
      teacherRole: 'Profesor Titular de Análisis Matemático',
      teacherInitials: 'CM',
      teacherEmail: 'carlosmendez@itutor.es',
      time: '18:00 - 19:30',
      duration: '90 min',
      room: 'Aula Virtual iTUTOR • Sala HD #02',
      status: 'Próxima',
      price: 35,
      notes: 'Integrales de línea e independencia del camino.',
      color: '#10b981'
    }
  };

  /** Celdas del calendario de Octubre 2026 (Octubre 2026 empieza en Jueves -> 3 huecos L, M, X) */
  calendarCells: CalendarCell[] = [];

  /** Apuntes y Recursos del alumno / profesor en sesión */
  private uploadingNote = false;
  /** Lista que se pinta: apuntes del servidor + pendientes de este dispositivo + los de ejemplo. */
  notes: StudentNoteItem[] = [];
  /** `true` si el servidor no ha respondido y se muestra la última copia guardada. */
  notesOffline = false;
  /** Error al ver o descargar un archivo (se muestra en la página, no solo dentro del modal). */
  noteActionError = '';
  /** Cuántos apuntes siguen sin confirmar en el servidor (para avisar al usuario). */
  get pendingNotesCount(): number {
    return this.notes.filter(n => n.pending).length;
  }
  selectedNotesFilter = 'Todos';
  showUploadNoteModal = false;
  uploadNoteError = '';
  uploadNoteSuccess = '';
  /** `true` mientras se valida/sube el PDF (desactiva el botón y evita dobles envíos). */
  uploadBusy = false;
  /** Archivo elegido: se sube como binario, ya no se convierte a base64 en memoria. */
  private uploadNoteFile: File | null = null;
  readonly maxPdfMb = ApuntesService.MAX_PDF_BYTES / 1024 / 1024;
  uploadNoteForm = {
    title: '',
    subject: 'Ecuaciones Diferenciales',
    summary: '',
    fileName: '',
    fileSize: ''
  };
  baseNotesList: StudentNoteItem[] = [
    {
      id: 'AP-01',
      title: 'Tema 4: Transformada de Laplace y EDOs de 2º Orden',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Elena Ramos',
      date: '10 Oct 2026',
      size: '2.4 MB',
      pages: 18,
      summary: 'Apuntes completos de la clase del 10 de octubre: tabla de transformadas, teoremas de traslación y 8 problemas de valor inicial resueltos paso a paso.'
    },
    {
      id: 'AP-02',
      title: 'Boletín Resuelto: EDOs Exactas y Factor Integrante',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Elena Ramos',
      date: '03 Oct 2026',
      size: '1.9 MB',
      pages: 14,
      summary: 'Colección de ejercicios de examen resueltos en pizarra digital durante la sesión de tutoría.'
    },
    {
      id: 'AP-03',
      title: 'Formulario: Integrales Dobles, Triples y Coordenadas Polares',
      subject: 'Cálculo Multivariable',
      teacher: 'Prof. Carlos Méndez',
      date: '06 Oct 2026',
      size: '1.2 MB',
      pages: 9,
      summary: 'Guía visual de recintos de integración, matriz Jacobiana y cambios de variable.'
    },
    {
      id: 'AP-04',
      title: 'Guía Práctica: Diagonalización y Autovalores',
      subject: 'Álgebra Lineal',
      teacher: 'Prof. Carlos Méndez',
      date: '28 Sep 2026',
      size: '3.1 MB',
      pages: 22,
      summary: 'Polinomio característico, multiplicidad algebraica y geométrica, y aplicaciones a sistemas dinámicos.'
    },
    {
      id: 'AP-05',
      title: 'Recopilatorio de Exámenes Finales Resueltos (2023-2025)',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Elena Ramos',
      date: '20 Sep 2026',
      size: '4.6 MB',
      pages: 34,
      summary: 'Exámenes oficiales íntegramente comentados con trucos para identificar el método de resolución más rápido.'
    },
    {
      id: 'AP-06',
      title: 'Planificación Personalizada del Curso — Paula García',
      subject: 'Coordinación',
      teacher: 'Noelia Cantador',
      date: '12 Sep 2026',
      size: '0.8 MB',
      pages: 5,
      summary: 'Hoja de ruta de objetivos académicos y calendario de evaluaciones para el primer cuatrimestre.'
    }
  ];

  /** Conversación seleccionada (su id es el email del contacto) */
  selectedTeacherId = '';
  newMessageText = '';
  /** Conversaciones del usuario en sesión, construidas con sus contactos y mensajes reales. */
  conversations: TeacherConversation[] = [];
  private extraPeers = new Set<string>();

  /** Rol del usuario en el chat (para marcar sus mensajes) */
  private get mySender(): 'coordinator' | 'teacher' | 'student' {
    return this.isCoordinator ? 'coordinator' : this.isTeacher ? 'teacher' : 'student';
  }

  get roleLabel(): string {
    return this.isCoordinator ? 'Coordinación' : this.isTeacher ? 'Profesor/a' : 'Alumno/a';
  }
  /** Estado de la ventana emergente para agendar clase desde la vista del profesor */
  showScheduleModal = false;
  scheduleSuccessMsg = '';
  scheduleErrorMsg = '';
  scheduleForm = {
    studentEmail: '',
    subject: '',
    topic: '',
    date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    time: '17:00',
    durationMin: 90
  };
  availableHours = ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  get teacherAssignedStudents(): SqlStudentRate[] {
    return this.dataService.getStudentsForTeacher(this.myEmail);
  }

  /** Facturación de ejemplo de la alumna demo (solo cuentas demo) */
  private readonly demoPaymentKpis = {
    totalPagado: '385,00 €',
    clasesAbonadas: '11 sesiones',
    horasTotales: '16,5 horas',
    ultimoPago: '35,00 €',
    ultimoPagoDetalle: '10 Oct 2026 • Ecuaciones Diferenciales',
    saldoPendiente: '0,00 €',
    metodoPago: 'Visa •••• 4821'
  };

  private readonly demoSubjectSpending = [
    { subject: 'Ecuaciones Diferenciales (Elena Ramos)', amount: 210, sessions: 6, percentage: 55, color: '#2563eb' },
    { subject: 'Cálculo Multivariable (Prof. Carlos Méndez)', amount: 105, sessions: 3, percentage: 27, color: '#10b981' },
    { subject: 'Álgebra Lineal (Prof. Carlos Méndez)', amount: 70, sessions: 2, percentage: 18, color: '#6366f1' }
  ];

  private readonly demoPaymentsHistory: StudentPaymentRecord[] = [
    {
      id: 'FAC-2026-1010',
      date: '10 Oct 2026',
      concept: 'Tutoría Ecuaciones Diferenciales (90 min)',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Elena Ramos',
      method: 'Visa •••• 4821',
      amount: 35,
      status: 'Pagado'
    },
    {
      id: 'FAC-2026-1006',
      date: '06 Oct 2026',
      concept: 'Tutoría Cálculo Multivariable (90 min)',
      subject: 'Cálculo Multivariable',
      teacher: 'Prof. Carlos Méndez',
      method: 'Visa •••• 4821',
      amount: 35,
      status: 'Pagado'
    },
    {
      id: 'FAC-2026-1003',
      date: '03 Oct 2026',
      concept: 'Tutoría Ecuaciones Diferenciales (90 min)',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Elena Ramos',
      method: 'Visa •••• 4821',
      amount: 35,
      status: 'Pagado'
    },
    {
      id: 'FAC-2026-0926',
      date: '26 Sep 2026',
      concept: 'Bono Mensual Septiembre (8 Sesiones Intensivas)',
      subject: 'Ecuaciones Diferenciales & Cálculo',
      teacher: 'Elena Ramos / Prof. Carlos Méndez',
      method: 'Visa •••• 4821',
      amount: 280,
      status: 'Pagado'
    }
  ];

  /** Facturación mostrada: la de ejemplo (demo) o la calculada con las clases agendadas del usuario. */
  paymentKpis = { ...this.demoPaymentKpis };
  subjectSpending: { subject: string; amount: number; sessions: number; percentage: number; color: string }[] = [];
  paymentsHistory: StudentPaymentRecord[] = [];
  constructor() {
    addIcons({
      calendarOutline,
      timeOutline,
      personOutline,
      videocamOutline,
      documentTextOutline,
      chatbubblesOutline,
      walletOutline,
      downloadOutline,
      sendOutline,
      checkmarkCircleOutline,
      schoolOutline,
      bookOutline,
      cardOutline,
      sparklesOutline,
      chevronBackOutline,
      chevronForwardOutline,
      settingsOutline,
      notificationsOutline,
      shieldCheckmarkOutline,
      folderOpenOutline,
      receiptOutline,
      menuOutline,
      addCircleOutline,
      closeOutline,
      swapHorizontalOutline,
      cloudUploadOutline,
      eyeOutline,
      cameraOutline,
      trashOutline,
      lockClosedOutline
    });
    if (this.isDemoView) {
      this.viewYear = 2026;
      this.viewMonth = 9;
      this.selectedDay = 10;
    }
    this.syncChatThreads();
    this.rebuildCalendar();
    this.rebuildPayments();
  }

  ngOnInit(): void {
    this.subs.push(
      this.route.data.subscribe(data => {
        if (data && data['section']) {
          this.activeSection = data['section'];
          this.syncChatThreads();
          this.cdr.markForCheck();
        }
      }),
      this.chatService.messages$.subscribe(() => {
        this.syncChatThreads();
        this.cdr.markForCheck();
      }),
      this.scheduleService.classes$.subscribe(() => {
        this.rebuildCalendar();
        this.rebuildPayments();
        this.cdr.markForCheck();
      }),
      // Llega el directorio de AWS (mis profesores / mis alumnos): se rehacen contactos y calendario.
      this.dataService.directoryChanged$.subscribe(() => {
        this.syncChatThreads();
        this.rebuildCalendar();
        this.cdr.markForCheck();
      })
    );
    void this.dataService.refreshDirectory();
    void this.scheduleService.refresh();

    // Apuntes: se cargan del servidor y se refrescan cuando un envío pendiente termina.
    this.notes = this.isDemoView ? [...this.baseNotesList] : [];
    this.subs.push(this.apuntes.changed$.subscribe(() => void this.loadNotes()));
    void this.loadNotes();
    const me = this.currentUser;
    if (this.isTeacher && me?.email) {
      void this.apuntes.migrateLegacyLocalNotes({ email: me.email, name: me.name || '' });
    }
  }

  /** Clases agendadas que le corresponden al usuario: las suyas (alumno/profesor) o todas (administración). */
  private myScheduledClasses(): ScheduledClass[] {
    if (this.isCoordinator) {
      return this.scheduleService.classes;
    }
    return this.isTeacher
      ? this.scheduleService.getForTeacher(this.myEmail)
      : this.scheduleService.getForStudent(this.myEmail);
  }

  private initialsOf(name: string): string {
    const parts = name.replace(/\b(Dra?\.|Prof\.)/g, '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '??';
  }

  private nameForEmail(email: string): string {
    return (
      this.dataService.findTeacherByEmail(email)?.nombre ||
      this.dataService.findStudentByEmail(email)?.nombre ||
      this.authService.getPublicAccount(email)?.name ||
      email.split('@')[0]
    );
  }

  /** Construye la lista de conversaciones: contactos del usuario + cualquiera con quien ya haya hablado. */
  private syncChatThreads(): void {
    const me = this.myEmail;
    if (!me) {
      this.conversations = [];
      return;
    }
    const peers = new Map<string, string>(); // email -> asignatura / descripción

    if (this.isCoordinator) {
      for (const t of this.dataService.allTeachers) {
        peers.set(t.email.toLowerCase(), t.especialidad);
      }
    } else if (this.isTeacher) {
      for (const s of this.dataService.getStudentsForTeacher(me)) {
        peers.set(s.email.toLowerCase(), s.asignaturaPrincipal);
      }
      peers.set(MisClasesPage.COORDINATOR_EMAIL, 'Coordinadora Académica iTUTOR');
    } else {
      for (const t of this.dataService.getTeachersForStudent(me)) {
        peers.set(t.email.toLowerCase(), t.especialidad);
      }
      peers.set(MisClasesPage.COORDINATOR_EMAIL, 'Coordinadora Académica iTUTOR');
    }
    for (const e of [...this.chatService.getContactsOf(me), ...this.extraPeers]) {
      if (!peers.has(e)) {
        peers.set(e, this.dataService.findTeacherByEmail(e)?.especialidad || this.dataService.findStudentByEmail(e)?.asignaturaPrincipal || '');
      }
    }
    peers.delete(me);

    const convs: TeacherConversation[] = [...peers.entries()].map(([email, subject]) => {
      const name = this.nameForEmail(email);
      return {
        id: email,
        peerEmail: email,
        teacherName: name,
        subject: subject || (email === MisClasesPage.COORDINATOR_EMAIL ? 'Coordinadora Académica iTUTOR' : ''),
        initials: this.initialsOf(name),
        online: false,
        unread: this.chatService.unreadFrom(me, email),
        messages: this.chatService.getThread(me, email).map(m => ({
          sender: (m.from === me ? this.mySender : 'peer') as 'coordinator' | 'teacher' | 'student' | 'peer',
          text: m.text,
          time: this.chatService.formatTime(m.ts)
        }))
      };
    });
    // Primero los que tienen actividad reciente; después, por nombre.
    convs.sort(
      (a, b) =>
        this.chatService.lastActivity(me, b.peerEmail || '') - this.chatService.lastActivity(me, a.peerEmail || '') ||
        a.teacherName.localeCompare(b.teacherName)
    );
    this.conversations = convs;
    if (!convs.some(c => c.id === this.selectedTeacherId)) {
      this.selectedTeacherId = convs[0]?.id ?? '';
    }
    // La conversación que se está leyendo no acumula "no leídos".
    const open = convs.find(c => c.id === this.selectedTeacherId);
    if (open && open.unread > 0 && this.activeSection === 'mensajes' && open.peerEmail) {
      this.chatService.markRead(me, open.peerEmail);
    }
  }

  /** Reconstruye el calendario del mes visible con las clases reales (más las de ejemplo en cuentas demo). */
  private rebuildCalendar(): void {
    const map: Record<number, TutoriaSession> = {};
    if (this.isDemoView && this.viewYear === 2026 && this.viewMonth === 9) {
      Object.assign(map, structuredClone(this.demoSessions));
    }
    const shown = this.myScheduledClasses()
      .filter(c => {
        const [y, m] = c.start.split('T')[0].split('-').map(Number);
        return y === this.viewYear && m - 1 === this.viewMonth;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const c of shown) {
      const [datePart, timePart = '17:00'] = c.start.split('T');
      const day = Number(datePart.split('-')[2]);
      const other = this.isTeacher ? c.studentName : c.teacherName;
      const label = new Date(`${datePart}T12:00`).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      map[day] = {
        day,
        dateLabel: label.charAt(0).toUpperCase() + label.slice(1),
        subject: c.subject,
        topic: c.topic,
        teacher: other,
        teacherRole: this.isTeacher ? 'Alumno/a' : 'Profesor/a',
        teacherInitials: this.initialsOf(other),
        teacherEmail: this.isTeacher ? c.studentEmail : c.teacherEmail,
        time: `${timePart.slice(0, 5)} (${c.durationMin} min)`,
        duration: `${c.durationMin} min`,
        room: 'Aula Virtual iTUTOR',
        status: new Date(c.start).getTime() < Date.now() ? 'Completada' : 'Confirmada',
        price: c.price,
        notes: c.notes || c.topic,
        color: MisClasesPage.PALETTE[c.subject.length % MisClasesPage.PALETTE.length]
      };
    }
    this.sessionsMap = map;

    // Primera vez: si no hay nada este mes, se salta al mes de la próxima clase.
    if (!this.monthTouched && Object.keys(map).length === 0) {
      const next = this.myScheduledClasses()
        .filter(c => new Date(c.start).getTime() >= Date.now() - 86_400_000)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      if (next) {
        const [y, m] = next.start.split('T')[0].split('-').map(Number);
        if (y !== this.viewYear || m - 1 !== this.viewMonth) {
          this.viewYear = y;
          this.viewMonth = m - 1;
          this.rebuildCalendar();
          return;
        }
      }
    }
    if (!map[this.selectedDay]) {
      const first = Object.keys(map).map(Number).sort((a, b) => a - b)[0];
      this.selectedDay = first ?? 1;
    }
    this.buildCalendar();
  }

  /** Construye la cuadrícula del mes visible (semana de lunes a domingo). */
  private buildCalendar(): void {
    const firstWeekday = (new Date(this.viewYear, this.viewMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, isCurrentMonth: true, session: this.sessionsMap[day] });
    }
    this.calendarCells = cells;
  }

  get monthLabel(): string {
    const label = new Date(this.viewYear, this.viewMonth, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  changeMonth(delta: number): void {
    const d = new Date(this.viewYear, this.viewMonth + delta, 1);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
    this.monthTouched = true;
    this.selectedDay = 1;
    this.rebuildCalendar();
    this.cdr.markForCheck();
  }

  /** Facturación: ejemplo en cuentas demo; para el resto, las clases agendadas del usuario. */
  private rebuildPayments(): void {
    if (this.isDemoView) {
      this.paymentKpis = { ...this.demoPaymentKpis };
      this.subjectSpending = [...this.demoSubjectSpending];
      this.paymentsHistory = [...this.demoPaymentsHistory];
      return;
    }
    const classes = [...this.myScheduledClasses()].sort((a, b) => b.start.localeCompare(a.start));
    const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
    const total = classes.reduce((s, c) => s + c.price, 0);
    const minutes = classes.reduce((s, c) => s + c.durationMin, 0);
    this.paymentKpis = {
      totalPagado: eur(0),
      clasesAbonadas: '0 sesiones',
      horasTotales: `${(minutes / 60).toFixed(1).replace('.', ',')} horas`,
      ultimoPago: '—',
      ultimoPagoDetalle: 'Todavía no hay pagos registrados',
      saldoPendiente: eur(total),
      metodoPago: 'Sin método de pago'
    };
    const bySubject = new Map<string, { amount: number; sessions: number }>();
    for (const c of classes) {
      const acc = bySubject.get(c.subject) ?? { amount: 0, sessions: 0 };
      acc.amount += c.price;
      acc.sessions += 1;
      bySubject.set(c.subject, acc);
    }
    this.subjectSpending = [...bySubject.entries()].map(([subject, v], idx) => ({
      subject,
      amount: v.amount,
      sessions: v.sessions,
      percentage: total > 0 ? Math.round((v.amount / total) * 100) : 0,
      color: MisClasesPage.PALETTE[idx % MisClasesPage.PALETTE.length]
    }));
    this.paymentsHistory = classes.map(c => ({
      id: c.id.toUpperCase(),
      date: new Date(c.start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      concept: `Tutoría ${c.subject} (${c.durationMin} min)`,
      subject: c.subject,
      teacher: c.teacherName,
      method: '—',
      amount: c.price,
      status: 'Pendiente' as const
    }));
  }

  /** Selecciona un día del calendario cuando el alumno pincha en el número */
  selectCalendarDay(day: number | null): void {
    if (!day) return;
    this.selectedDay = day;
    this.cdr.markForCheck();
  }

  /** Obtiene la sesión del día seleccionado actualmente */
  get selectedSession(): TutoriaSession | undefined {
    return this.sessionsMap[this.selectedDay];
  }

  /** Lista ordenada de todas las sesiones del mes */
  get allMonthSessions(): TutoriaSession[] {
    return Object.values(this.sessionsMap).sort((a, b) => a.day - b.day);
  }
  /** Cambia de sección y sincroniza la ruta */
  switchSection(section: 'tutorias' | 'apuntes' | 'mensajes' | 'pagos' | 'ajustes'): void {
    this.activeSection = section;
    const routeMap: Record<string, string> = {
      tutorias: '/mis-clases',
      apuntes: '/mis-apuntes',
      mensajes: '/mensajes-profesores',
      pagos: '/mis-pagos',
      ajustes: '/ajustes'
    };
    this.router.navigate([routeMap[section]]);
  }

  /** Ir directamente a los apuntes de una asignatura desde el recuadro de la clase */
  openNotesForSubject(subject: string): void {
    this.selectedNotesFilter = subject;
    this.switchSection('apuntes');
  }

  /** Ir directamente al chat con la otra persona de la clase (por su email) */
  openChatWithTeacher(peerEmail: string): void {
    const e = (peerEmail || '').toLowerCase();
    if (e) {
      this.extraPeers.add(e);
      this.selectedTeacherId = e;
    }
    this.syncChatThreads();
    this.switchSection('mensajes');
  }

  /** Lista completa de apuntes (ya fusionada y sin repetidos por id). */
  get notesList(): StudentNoteItem[] {
    return this.notes;
  }

  /**
   * Carga los apuntes del servidor visibles para el usuario en sesión (alumno:
   * los de su profesor asignado) y los fusiona con los pendientes de este
   * dispositivo y los de ejemplo. Un mismo id nunca aparece dos veces.
   */
  async loadNotes(): Promise<void> {
    const { items, offline } = await this.apuntes.list(this.currentUser?.email ?? null);
    const baseIds = new Set(this.baseNotesList.map(n => n.id));
    // Los apuntes de ejemplo (AP-01..06) pertenecen a las cuentas demo; el resto solo ve los suyos.
    this.notes = [...items.filter(n => !baseIds.has(n.id)), ...(this.isDemoView ? this.baseNotesList : [])];
    this.notesOffline = offline;
    this.cdr.markForCheck();
  }

  /** Apuntes filtrados por asignatura */
  get filteredNotes(): StudentNoteItem[] {
    if (this.selectedNotesFilter === 'Todos') {
      return this.notesList;
    }
    return this.notesList.filter(n => n.subject === this.selectedNotesFilter);
  }

  /** Abre la ventana emergente para que la profesora suba cualquier PDF o archivo */
  openUploadNoteModal(): void {
    this.uploadNoteError = '';
    this.uploadNoteSuccess = '';
    this.uploadNoteFile = null;
    this.uploadNoteForm = {
      title: '',
      subject: 'Ecuaciones Diferenciales',
      summary: '',
      fileName: '',
      fileSize: ''
    };
    this.showUploadNoteModal = true;
    this.cdr.markForCheck();
  }

  closeUploadNoteModal(): void {
    this.showUploadNoteModal = false;
    this.uploadNoteError = '';
    this.cdr.markForCheck();
  }

  /** Valida el PDF en cuanto se elige (tamaño, tipo y firma) para avisar antes de pulsar «Subir». */
  async onNoteFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadNoteError = '';
    this.uploadNoteFile = null;
    this.uploadNoteForm.fileName = '';
    this.uploadNoteForm.fileSize = '';

    const problem = await this.apuntes.validateFile(file);
    if (problem) {
      input.value = ''; // permite volver a elegir el mismo archivo tras corregirlo
      this.uploadNoteError = problem;
      this.cdr.markForCheck();
      return;
    }

    this.uploadNoteFile = file;
    this.uploadNoteForm.fileName = file.name;
    const sizeKb = file.size / 1024;
    this.uploadNoteForm.fileSize = sizeKb >= 1024
      ? `${(sizeKb / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(sizeKb))} KB`;
    if (!this.uploadNoteForm.title) {
      this.uploadNoteForm.title = file.name.replace(/\.[^/.]+$/, '');
    }
    this.cdr.markForCheck();
  }

  async confirmUploadNote(): Promise<void> {
    if (this.uploadBusy) {
      return;
    }
    const file = this.uploadNoteFile;
    if (!file) {
      this.uploadNoteError = 'Por favor, selecciona un archivo PDF de tu equipo.';
      this.cdr.markForCheck();
      return;
    }

    this.uploadBusy = true;
    this.uploadNoteError = '';
    this.cdr.markForCheck();

    const teacherName = this.currentUser?.name || 'Profesor/a';
    // Un apunte de coordinación (Admin) no pertenece a ningún profesor: lo ven todos.
    const ownerEmail = this.isCoordinator ? '' : (this.currentUser?.email || '').toLowerCase();
    const outcome = await this.apuntes.upload(file, {
      title: this.uploadNoteForm.title.trim() || file.name,
      subject: this.uploadNoteForm.subject || 'Ecuaciones Diferenciales',
      teacher: teacherName,
      teacherEmail: ownerEmail,
      summary: this.uploadNoteForm.summary.trim() || `Archivo subido por ${teacherName}: ${file.name}`
    });
    this.uploadBusy = false;

    if (outcome.status === 'rejected') {
      // El modal sigue abierto con el motivo: nada falla en silencio.
      this.uploadNoteError = outcome.reason;
      this.cdr.markForCheck();
      return;
    }

    this.showUploadNoteModal = false;
    this.uploadNoteFile = null;
    if (outcome.status === 'queued') {
      this.uploadNoteSuccess = outcome.durable
        ? `"${file.name}" está guardado en este dispositivo pero aún no ha llegado al servidor. Se reintentará solo en cuanto haya conexión; mientras tanto aparece con el aviso "Pendiente de enviar".`
        : `"${file.name}" NO se ha podido enviar y este navegador no permite guardarlo. Mantén esta pestaña abierta: se reintentará solo, y si la cierras tendrás que subirlo de nuevo.`;
    } else {
      this.uploadNoteSuccess = `Archivo "${file.name}" subido y guardado en el servidor. Tus alumnos asignados ya pueden verlo y descargarlo.`;
    }
    await this.loadNotes();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /** Abre el PDF en una pestaña nueva (descargándolo del servidor si hace falta). */
  async viewUploadedNote(note: StudentNoteItem): Promise<void> {
    if (!note.hasFile) {
      this.downloadNotePdf(note);
      return;
    }
    // La pestaña se abre ANTES del await: los móviles bloquean window.open fuera del gesto del usuario.
    const win = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await this.apuntes.getBlob(note));
      if (win) {
        win.location.href = url;
      } else {
        this.saveBlobAs(url, note);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch {
      win?.close();
      this.noteActionError = 'No se ha podido abrir el archivo. Comprueba tu conexión e inténtalo de nuevo.';
      this.cdr.markForCheck();
    }
  }

  private saveBlobAs(url: string, note: StudentNoteItem): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = note.fileName || `${note.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  /** Conversación activa seleccionada */
  get activeConversation(): TeacherConversation | undefined {
    return this.conversations.find(c => c.id === this.selectedTeacherId) || this.conversations[0];
  }

  selectConversation(id: string): void {
    this.selectedTeacherId = id;
    const conv = this.conversations.find(c => c.id === id);
    if (conv) {
      conv.unread = 0;
      if (conv.peerEmail) {
        this.chatService.markRead(this.myEmail, conv.peerEmail);
      }
    }
    this.cdr.markForCheck();
  }

  /** Determina si el mensaje fue enviado por el usuario actual */
  isMyMessage(msg: { sender: string }): boolean {
    return msg.sender !== 'peer';
  }

  /**
   * Envía un mensaje con la identidad REAL del usuario en sesión, al contacto de la
   * conversación abierta. (Antes salía siempre como Paula o Elena.)
   */
  sendMessage(): void {
    const text = this.newMessageText.trim();
    const conv = this.activeConversation;
    if (!text || !conv?.peerEmail || !this.myEmail) return;

    this.chatService.send(this.myEmail, conv.peerEmail, text);
    this.newMessageText = '';
    this.syncChatThreads();
    this.cdr.markForCheck();
  }

  /** Abre la ventana emergente para agendar clase a un alumno asignado */
  openScheduleModal(): void {
    this.scheduleErrorMsg = '';
    this.scheduleSuccessMsg = '';
    const students = this.teacherAssignedStudents;
    const first = students[0];
    this.scheduleForm = {
      studentEmail: first ? first.email : '',
      subject: first ? first.asignaturaPrincipal : 'Ecuaciones Diferenciales',
      topic: 'Tutoría personalizada y resolución de problemas',
      date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      time: '17:00',
      durationMin: 90
    };
    this.showScheduleModal = true;
    this.cdr.markForCheck();
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
    this.scheduleErrorMsg = '';
    this.cdr.markForCheck();
  }

  onScheduleStudentChange(): void {
    const st = this.teacherAssignedStudents.find(s => s.email === this.scheduleForm.studentEmail);
    if (st) {
      this.scheduleForm.subject = st.asignaturaPrincipal;
    }
    this.cdr.markForCheck();
  }

  confirmScheduleClass(): void {
    const students = this.teacherAssignedStudents;
    const student = students.find(s => s.email === this.scheduleForm.studentEmail);
    if (!student) {
      this.scheduleErrorMsg = 'Selecciona uno de tus alumnos asignados.';
      this.cdr.markForCheck();
      return;
    }
    if (!this.scheduleForm.date || !this.scheduleForm.time) {
      this.scheduleErrorMsg = 'Selecciona fecha y hora en el calendario.';
      this.cdr.markForCheck();
      return;
    }

    const teacherEmail = this.myEmail;
    const teacher = this.dataService.findTeacherByEmail(teacherEmail);
    const tarifa = teacher?.tarifaHora || 30;
    const durationMin = Number(this.scheduleForm.durationMin) || 90;
    const price = Math.round((tarifa * durationMin) / 60);

    this.scheduleService.schedule({
      teacherEmail,
      teacherName: teacher?.nombre || this.currentUser?.name || teacherEmail,
      studentEmail: student.email,
      studentName: student.nombre,
      subject: this.scheduleForm.subject || student.asignaturaPrincipal,
      topic: this.scheduleForm.topic || 'Sesión de tutoría',
      start: `${this.scheduleForm.date}T${this.scheduleForm.time}`,
      durationMin,
      price,
      notes: this.scheduleForm.topic || 'Clase agendada por el profesor',
      branch: teacher?.departamento
    });

    this.showScheduleModal = false;
    this.scheduleSuccessMsg = `¡Clase agendada con ${student.nombre} el ${this.scheduleForm.date} a las ${this.scheduleForm.time}!`;
    // El calendario salta al mes de la clase recién agendada.
    const [yy, mm] = this.scheduleForm.date.split('-').map(Number);
    this.viewYear = yy;
    this.viewMonth = mm - 1;
    this.rebuildCalendar();
    const dayNum = Number(this.scheduleForm.date.split('-')[2]);
    if (dayNum >= 1 && dayNum <= 31) {
      this.selectedDay = dayNum;
    }
    this.cdr.markForCheck();
  }

  /** Descarga el archivo original subido por la profesora o genera el PDF con jsPDF */
  downloadNotePdf(note: StudentNoteItem): void {
    if (note.hasFile) {
      void this.apuntes
        .getBlob(note)
        .then(blob => {
          const url = URL.createObjectURL(blob);
          this.saveBlobAs(url, note);
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        })
        .catch(() => {
          this.noteActionError = 'No se ha podido descargar el archivo. Comprueba tu conexión e inténtalo de nuevo.';
          this.cdr.markForCheck();
        });
      return;
    }

    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('iTUTOR • Apuntes Académicos', 14, 17);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(note.title, 14, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Asignatura: ${note.subject} | Profesor/a: ${note.teacher} | Fecha: ${note.date}`, 14, 50);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    const splitSummary = doc.splitTextToSize(note.summary, 180);
    doc.text(splitSummary, 14, 64);

    doc.save(`${note.id}_${note.subject.replace(/\s+/g, '_')}.pdf`);
  }

  /** Descarga en PDF un justificante de pago */
  downloadPaymentReceipt(payment: StudentPaymentRecord): void {
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('iTUTOR • Recibo Oficial de Pago', 14, 17);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text(`Factura / Recibo Nº: ${payment.id}`, 14, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Alumno/a: ${this.currentUser?.name || this.myEmail} (${this.myEmail})`, 14, 54);
    doc.text(`Concepto: ${payment.concept}`, 14, 62);
    doc.text(`Asignatura: ${payment.subject}`, 14, 70);
    doc.text(`Profesor/a: ${payment.teacher}`, 14, 78);
    doc.text(`Fecha de abono: ${payment.date}`, 14, 86);
    doc.text(`Método de pago: ${payment.method}`, 14, 94);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(payment.status === 'Pagado' ? 16 : 217, payment.status === 'Pagado' ? 185 : 119, payment.status === 'Pagado' ? 129 : 6);
    doc.text(`IMPORTE ${payment.status === 'Pagado' ? 'TOTAL PAGADO' : 'PENDIENTE DE PAGO'}: ${payment.amount},00 € (${payment.status.toUpperCase()})`, 14, 112);

    doc.save(`Recibo_iTUTOR_${payment.id}.pdf`);
  }

  /** =======================================================================
   *  AJUSTES DE CUENTA: FOTO SUBIDA POR EL USUARIO, DATOS NO MODIFICABLES Y ELIMINAR CUENTA
   *  ======================================================================= */
  settingsPhone = '';
  settingsSavedMsg = '';
  showDeleteAccountModal = false;

  get currentUserEmail(): string {
    return this.currentUser?.email || '';
  }

  /** Foto de perfil que haya subido el propio usuario (null si no ha subido ninguna) */
  get userUploadedAvatar(): string | null {
    return this.authService.getUserAvatar(this.currentUserEmail);
  }

  get userInitialsForSettings(): string {
    return this.initialsOf(this.currentUser?.name || this.currentUserEmail);
  }

  /** Fecha ISO (YYYY-MM-DD) -> dd/mm/aaaa */
  private formatBirthDate(value?: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value || 'No indicada';
  }

  /** Datos de ejemplo de las tres cuentas demo (coincidencia exacta de email, no por trozos del correo). */
  private static readonly DEMO_PROFILES: Record<string, { firstName: string; lastName: string; birthDate: string; roleLabel: string }> = {
    'elenaramos@itutor.es': { firstName: 'Elena', lastName: 'Ramos', birthDate: '22/08/1985', roleLabel: 'Profesora Docente' },
    'noeliacantador@itutor.es': { firstName: 'Noelia', lastName: 'Cantador', birthDate: '10/03/1990', roleLabel: 'Jefa Coordinadora (Admin)' },
    'paulagarcia@itutor.es': { firstName: 'Paula', lastName: 'García Serrano', birthDate: '14/05/2004', roleLabel: 'Alumna' }
  };

  /** Datos personales bloqueados (Nombre, Apellidos y Fecha de Nacimiento no modificables) */
  get lockedProfileData(): { firstName: string; lastName: string; birthDate: string; email: string; roleLabel: string } {
    const email = this.currentUserEmail;
    const demo = MisClasesPage.DEMO_PROFILES[email.toLowerCase()];
    if (demo) {
      return { ...demo, email };
    }
    const fullName = (this.currentUser?.name || 'Usuario iTUTOR').trim();
    const parts = fullName.split(/\s+/);
    return {
      firstName: parts[0] || fullName,
      lastName: parts.slice(1).join(' ') || 'Sin especificar',
      birthDate: this.formatBirthDate(this.currentUser?.birthDate),
      email,
      roleLabel: this.isCoordinator ? 'Coordinación (Admin)' : this.isTeacher ? 'Profesor/a Docente' : 'Alumno/a'
    };
  }
  /** Permite al usuario subir su propia foto de perfil desde su dispositivo */
  onUserPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        this.authService.setUserAvatar(this.currentUserEmail, dataUrl);
        this.settingsSavedMsg = '¡Has subido tu foto de perfil correctamente!';
        this.cdr.markForCheck();
      }
    };
    reader.readAsDataURL(file);
  }

  removeUserPhoto(): void {
    this.authService.setUserAvatar(this.currentUserEmail, null);
    this.settingsSavedMsg = 'Se ha eliminado tu foto de perfil.';
    this.cdr.markForCheck();
  }

  saveContactPreferences(): void {
    this.settingsSavedMsg = 'Preferencias de contacto guardadas. Recuerda que el nombre, los apellidos y la fecha de nacimiento son datos oficiales verificados y no se pueden modificar.';
    this.cdr.markForCheck();
  }

  openDeleteAccountModal(): void {
    this.showDeleteAccountModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteAccountModal(): void {
    this.showDeleteAccountModal = false;
    this.cdr.markForCheck();
  }

  confirmDeleteAccount(): void {
    this.showDeleteAccountModal = false;
    this.authService.deleteAccount(this.currentUserEmail);
    this.router.navigate(['/login']);
  }
}
