import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
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
import { ScheduleService } from '../../core/services/schedule.service';
import { DataService, SqlStudentRate } from '../../core/services/data.service';
import { ApiSyncService } from '../../core/services/api-sync.service';

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

export interface StudentNoteItem {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  date: string;
  size: string;
  pages: number;
  summary: string;
  fileName?: string;
  fileDataUrl?: string;
}

export interface TeacherConversation {
  id: string;
  peerEmail?: string;
  teacherName: string;
  subject: string;
  initials: string;
  online: boolean;
  unread: number;
  messages: {
    sender: 'teacher' | 'student' | 'coordinator';
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
  status: 'Pagado';
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
  private apiSync = inject(ApiSyncService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public sidebarService = inject(SidebarService);
  private authService = inject(AuthService);
  private http = inject(HttpClient, { optional: true });
  private readonly apiUrl = environment.apiUrl || 'http://18.192.203.101:3000/api';
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

  /** Día seleccionado en el calendario de Octubre 2026 (Por defecto el día 10 de octubre) */
  selectedDay = 10;

  /** Días de la semana (Lunes a Domingo) */
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /** Sesiones programadas de Paula García en Octubre 2026 */
  sessionsMap: Record<number, TutoriaSession> = {
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

  /** Apuntes y Recursos de Paula García */
  private static readonly UPLOADED_NOTES_KEY = 'itutor_uploaded_notes';
  /** Ids de apuntes subidos que aún no han llegado al servidor (cuerpo en UPLOADED_NOTES_KEY). */
  private static readonly PENDING_NOTES_KEY = 'itutor_pending_note_ids';
  private uploadingNote = false;
  private readonly onOnline = () => void this.retryPendingNotes();
  selectedNotesFilter = 'Todos';
  showUploadNoteModal = false;
  uploadNoteError = '';
  uploadNoteSuccess = '';
  uploadNoteForm = {
    title: '',
    subject: 'Ecuaciones Diferenciales',
    summary: '',
    fileName: '',
    fileSize: '',
    fileDataUrl: ''
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

  /** Conversaciones con los Profesores */
  selectedTeacherId = 'elena';
  newMessageText = '';

  /** Conversaciones de coordinación entre la Jefa Coordinadora (Noelia) y los Profesores */
  coordinatorConversations: TeacherConversation[] = [
    {
      id: 'elena',
      teacherName: 'Elena Ramos',
      subject: 'Física Teórica & Mecánica Clásica',
      initials: 'ER',
      online: true,
      unread: 1,
      messages: [
        {
          sender: 'coordinator',
          text: 'Estimada Elena Ramos, ¿cómo avanza el seguimiento de las tutorías de Física y Mecánica este mes?',
          time: '09:30'
        },
        {
          sender: 'teacher',
          text: 'Buenos días Noelia. Todo marcha según el plan docente. Marcos y Paula están completando las hojas de problemas y las actas de sesiones ya están cargadas en la plataforma.',
          time: '10:05'
        },
        {
          sender: 'coordinator',
          text: 'Perfecto Elena, reviso las horas impartidas para validar los honorarios docentes de este ciclo. ¡Muchas gracias por el informe!',
          time: '10:15'
        },
        {
          sender: 'teacher',
          text: 'A ti, Noelia. Quedo a tu disposición para cualquier ajuste o nueva asignación en el calendario.',
          time: '10:20'
        }
      ]
    },
    {
      id: 'carlos',
      teacherName: 'Prof. Carlos Méndez',
      subject: 'Cálculo Multivariable & Álgebra Lineal',
      initials: 'CM',
      online: true,
      unread: 1,
      messages: [
        {
          sender: 'coordinator',
          text: 'Hola Carlos, confírmame por favor si has recibido la asignación de los nuevos alumnos para Cálculo y Álgebra.',
          time: 'Ayer'
        },
        {
          sender: 'teacher',
          text: 'Hola Noelia, sí, todo recibido y verificado. Ya he fijado los horarios de tutorías en el calendario para el próximo mes.',
          time: 'Ayer'
        },
        {
          sender: 'coordinator',
          text: 'Excelente gestión. Avisamos a los estudiantes asignados para que confirmen sus reservas.',
          time: 'Ayer'
        }
      ]
    },
    {
      id: 'miguel',
      teacherName: 'Miguel Ángel Santos',
      subject: 'Termodinámica & Mecánica de Fluidos',
      initials: 'MS',
      online: true,
      unread: 1,
      messages: [
        {
          sender: 'coordinator',
          text: 'Hola Miguel Ángel, ¿se ha completado la sesión de Termodinámica de Alejandro Gómez sin incidencias?',
          time: '08 Oct'
        },
        {
          sender: 'teacher',
          text: 'Buenas tardes Noelia, sí, sesión completada y asistencia registrada. Muy buen aprovechamiento del contenido por parte del alumno.',
          time: '08 Oct'
        },
        {
          sender: 'coordinator',
          text: 'Magnífico. Queda validada en el registro oficial de sesiones.',
          time: '08 Oct'
        }
      ]
    }
  ];

  /** Conversaciones de la Alumna (Paula García) */
  studentConversations: TeacherConversation[] = [
    {
      id: 'elena',
      teacherName: 'Elena Ramos',
      subject: 'Profesora de Ecuaciones Diferenciales',
      initials: 'ER',
      online: true,
      unread: 1,
      messages: [
        {
          sender: 'teacher',
          text: '¡Hola Paula! Te he dejado subidos en "Mis Apuntes" el PDF con los ejercicios de la clase del sábado 10 de octubre sobre Transformada de Laplace.',
          time: '10:15'
        },
        {
          sender: 'student',
          text: '¡Muchas gracias Elena! Los estoy revisando ahora mismo. ¿En la clase del día 10 veremos también sistemas de ecuaciones diferenciales?',
          time: '10:18'
        },
        {
          sender: 'teacher',
          text: '¡Sí! En los últimos 30 minutos de la sesión del 10 de octubre resolveremos un sistema acoplado de 2º orden tipo examen. ¡Nos vemos en la Sala #04!',
          time: '10:21'
        }
      ]
    },
    {
      id: 'carlos',
      teacherName: 'Prof. Carlos Méndez',
      subject: 'Profesor de Cálculo y Álgebra Lineal',
      initials: 'CM',
      online: true,
      unread: 1,
      messages: [
        {
          sender: 'teacher',
          text: 'Buenas tardes Paula, recuerda repasar el cálculo del Jacobiano para las integrales dobles en polares.',
          time: 'Ayer'
        },
        {
          sender: 'student',
          text: 'Perfecto Carlos, ya he terminado los 4 primeros ejercicios del boletín.',
          time: 'Ayer'
        }
      ]
    },
    {
      id: 'noelia',
      teacherName: 'Noelia Cantador',
      subject: 'Coordinadora Académica iTUTOR',
      initials: 'NC',
      online: true,
      unread: 0,
      messages: [
        {
          sender: 'teacher',
          text: '¡Bienvenida a iTUTOR, Paula! Tu bono de tutorías de Octubre ya está confirmado y todas tus clases aparecen en tu calendario.',
          time: '01 Oct'
        }
      ]
    }
  ];

  /** Conversaciones de la Profesora (Elena Ramos) con sus alumnos asignados */
  teacherConversations: TeacherConversation[] = [
    {
      id: 'paula',
      peerEmail: 'paulagarcia@itutor.es',
      teacherName: 'Paula García',
      subject: 'Alumna • Ecuaciones Diferenciales',
      initials: 'PG',
      online: true,
      unread: 0,
      messages: []
    },
    {
      id: 'marcos',
      peerEmail: 'marcosvega@itutor.es',
      teacherName: 'Marcos Vega Ortiz',
      subject: 'Alumno • Física Clásica & Mecánica',
      initials: 'MV',
      online: true,
      unread: 0,
      messages: [
        {
          sender: 'student',
          text: 'Hola Elena, ya he subido la hoja de problemas de dinámica de rotación.',
          time: 'Ayer'
        },
        {
          sender: 'teacher',
          text: '¡Estupendo Marcos! La reviso esta tarde y comentamos los ejercicios en la próxima sesión.',
          time: 'Ayer'
        }
      ]
    },
    {
      id: 'noelia',
      peerEmail: 'noeliacantador@itutor.es',
      teacherName: 'Noelia Cantador',
      subject: 'Coordinadora Académica iTUTOR',
      initials: 'NC',
      online: true,
      unread: 0,
      messages: []
    }
  ];

  /** Devuelve las conversaciones correspondientes al rol en sesión (Coordinadora, Profesora o Alumna) */
  get conversations(): TeacherConversation[] {
    if (this.isCoordinator) {
      return this.coordinatorConversations;
    }
    if (this.isTeacher) {
      return this.teacherConversations;
    }
    return this.studentConversations;
  }

  /** Estado de la ventana emergente para agendar clase desde la vista del profesor */
  showScheduleModal = false;
  scheduleSuccessMsg = '';
  scheduleErrorMsg = '';
  scheduleForm = {
    studentEmail: '',
    subject: '',
    topic: '',
    date: '2026-10-28',
    time: '17:00',
    durationMin: 90
  };
  availableHours = ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  get teacherAssignedStudents(): SqlStudentRate[] {
    const email = this.currentUser?.email || 'elenaramos@itutor.es';
    return this.dataService.getStudentsForTeacher(email);
  }

  /** Dashboard de Facturación & Pagos de Paula García */
  paymentKpis = {
    totalPagado: '385,00 €',
    clasesAbonadas: '11 sesiones',
    horasTotales: '16,5 horas',
    ultimoPago: '35,00 €',
    ultimoPagoDetalle: '10 Oct 2026 • Ecuaciones Diferenciales',
    saldoPendiente: '0,00 €',
    metodoPago: 'Visa •••• 4821'
  };

  subjectSpending = [
    { subject: 'Ecuaciones Diferenciales (Elena Ramos)', amount: 210, sessions: 6, percentage: 55, color: '#2563eb' },
    { subject: 'Cálculo Multivariable (Prof. Carlos Méndez)', amount: 105, sessions: 3, percentage: 27, color: '#10b981' },
    { subject: 'Álgebra Lineal (Prof. Carlos Méndez)', amount: 70, sessions: 2, percentage: 18, color: '#6366f1' }
  ];

  paymentsHistory: StudentPaymentRecord[] = [
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
    this.syncChatThreads();
    this.buildOctoberCalendar();
  }

  ngOnInit(): void {
    window.addEventListener('online', this.onOnline);
    void this.retryPendingNotes();
    if (this.isTeacher) {
      this.selectedTeacherId = 'paula';
    }
    this.route.data.subscribe(data => {
      if (data && data['section']) {
        this.activeSection = data['section'];
        if (this.isTeacher && this.selectedTeacherId === 'elena') {
          this.selectedTeacherId = 'paula';
        }
        this.syncChatThreads();
        this.cdr.markForCheck();
      }
    });
    this.chatService.messages$.subscribe(() => {
      this.syncChatThreads();
      this.cdr.markForCheck();
    });
    this.scheduleService.classes$.subscribe(() => {
      this.syncScheduledClassesIntoCalendar();
      this.cdr.markForCheck();
    });
    if (this.http) {
      this.http.get<StudentNoteItem[]>(`${this.apiUrl}/apuntes`).subscribe({
        next: remoteNotes => {
          if (Array.isArray(remoteNotes) && remoteNotes.length > 0) {
            const existingIds = new Set(this.baseNotesList.map(n => n.id));
            for (const rn of remoteNotes) {
              if (!existingIds.has(rn.id)) {
                this.baseNotesList.unshift(rn);
              }
            }
            this.cdr.markForCheck();
          }
        },
        error: () => {}
      });
    }
  }

  /** Sincroniza los mensajes en tiempo real entre Elena (Profesora), Paula (Alumna) y Noelia (Coordinadora) */
  private syncChatThreads(): void {
    const elenaPaulaThread = this.chatService.getThread('elenaramos@itutor.es', 'paulagarcia@itutor.es').map(m => ({
      sender: (m.from === 'elenaramos@itutor.es' ? 'teacher' : 'student') as 'teacher' | 'student',
      text: m.text,
      time: this.chatService.formatTime(m.ts)
    }));

    const studentElenaConv = this.studentConversations.find(c => c.id === 'elena');
    if (studentElenaConv && elenaPaulaThread.length > 0) {
      studentElenaConv.messages = elenaPaulaThread;
    }

    const teacherPaulaConv = this.teacherConversations.find(c => c.id === 'paula');
    if (teacherPaulaConv) {
      teacherPaulaConv.messages = elenaPaulaThread;
    }

    const elenaNoeliaThread = this.chatService.getThread('elenaramos@itutor.es', 'noeliacantador@itutor.es').map(m => ({
      sender: (m.from === 'noeliacantador@itutor.es' ? 'coordinator' : 'teacher') as 'coordinator' | 'teacher',
      text: m.text,
      time: this.chatService.formatTime(m.ts)
    }));

    const teacherNoeliaConv = this.teacherConversations.find(c => c.id === 'noelia');
    if (teacherNoeliaConv) {
      teacherNoeliaConv.messages = elenaNoeliaThread;
    }
    const coordElenaConv = this.coordinatorConversations.find(c => c.id === 'elena');
    if (coordElenaConv && elenaNoeliaThread.length > 0) {
      coordElenaConv.messages = elenaNoeliaThread;
    }
  }

  /** Incorpora las clases agendadas por el profesor en el calendario de Octubre 2026 */
  private syncScheduledClassesIntoCalendar(): void {
    for (const c of this.scheduleService.classes) {
      const [datePart, timePart = '17:00'] = c.start.split('T');
      const [year, month, dayStr] = datePart.split('-');
      const dayNum = Number(dayStr);
      if (year === '2026' && month === '10' && dayNum >= 1 && dayNum <= 31) {
        this.sessionsMap[dayNum] = {
          day: dayNum,
          dateLabel: `${dayNum} de Octubre de 2026`,
          subject: c.subject,
          topic: c.topic,
          teacher: c.teacherName,
          teacherRole: `Alumno/a: ${c.studentName}`,
          teacherInitials: 'ER',
          teacherEmail: c.teacherEmail,
          time: `${timePart.slice(0, 5)} (${c.durationMin} min)`,
          duration: `${c.durationMin} min`,
          room: 'Aula Virtual iTUTOR • Sala Interactiva #04',
          status: 'Confirmada',
          price: c.price,
          notes: c.notes,
          color: '#2563eb'
        };
      }
    }
    this.buildOctoberCalendar();
  }

  /** Construye la cuadrícula del mes de Octubre de 2026 */
  private buildOctoberCalendar(): void {
    // 1 de Octubre de 2026 es Jueves (3 celdas vacías antes: Lun, Mar, Mié)
    const emptyPrefixDays = 3;
    const totalDaysInOctober = 31;
    const cells: CalendarCell[] = [];

    for (let i = 0; i < emptyPrefixDays; i++) {
      cells.push({ day: null, isCurrentMonth: false });
    }

    for (let day = 1; day <= totalDaysInOctober; day++) {
      cells.push({
        day,
        isCurrentMonth: true,
        session: this.sessionsMap[day]
      });
    }

    this.calendarCells = cells;
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

  /** Ir directamente al chat con la profesora desde el recuadro de la clase */
  openChatWithTeacher(teacherName: string): void {
    if (teacherName.toLowerCase().includes('elena')) {
      this.selectedTeacherId = 'elena';
    } else if (teacherName.toLowerCase().includes('carlos')) {
      this.selectedTeacherId = 'carlos';
    } else if (teacherName.toLowerCase().includes('miguel') || teacherName.toLowerCase().includes('santos')) {
      this.selectedTeacherId = 'miguel';
    } else {
      this.selectedTeacherId = this.isCoordinator ? 'elena' : 'noelia';
    }
    this.switchSection('mensajes');
  }

  /** Lista completa de apuntes: los subidos por la profesora + los del repositorio base (sin duplicados por id) */
  get notesList(): StudentNoteItem[] {
    let uploaded: StudentNoteItem[] = [];
    try {
      const raw = localStorage.getItem(MisClasesPage.UPLOADED_NOTES_KEY);
      const parsed = raw ? (JSON.parse(raw) as StudentNoteItem[]) : [];
      uploaded = Array.isArray(parsed) ? parsed : [];
    } catch {
      uploaded = [];
    }
    // Un apunte subido ya está en el servidor y vuelve en el GET: sin esto salía repetido.
    const seen = new Set<string>();
    return [...uploaded, ...this.baseNotesList].filter(n => {
      if (seen.has(n.id)) {
        return false;
      }
      seen.add(n.id);
      return true;
    });
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
    this.uploadNoteForm = {
      title: '',
      subject: 'Ecuaciones Diferenciales',
      summary: '',
      fileName: '',
      fileSize: '',
      fileDataUrl: ''
    };
    this.showUploadNoteModal = true;
    this.cdr.markForCheck();
  }

  closeUploadNoteModal(): void {
    this.showUploadNoteModal = false;
    this.uploadNoteError = '';
    this.cdr.markForCheck();
  }

  onNoteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadNoteForm.fileName = file.name;
    const sizeKb = file.size / 1024;
    this.uploadNoteForm.fileSize = sizeKb >= 1024
      ? `${(sizeKb / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(sizeKb))} KB`;

    if (!this.uploadNoteForm.title) {
      this.uploadNoteForm.title = file.name.replace(/\.[^/.]+$/, '');
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadNoteForm.fileDataUrl = String(reader.result || '');
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  async confirmUploadNote(): Promise<void> {
    if (this.uploadingNote) {
      return;
    }
    if (!this.uploadNoteForm.fileDataUrl) {
      this.uploadNoteError = 'Por favor, selecciona un archivo PDF o documento de tu equipo.';
      this.cdr.markForCheck();
      return;
    }

    const newNote: StudentNoteItem = {
      id: `AP-UP-${Date.now().toString(36).toUpperCase()}`,
      title: this.uploadNoteForm.title.trim() || this.uploadNoteForm.fileName,
      subject: this.uploadNoteForm.subject || 'Ecuaciones Diferenciales',
      teacher: this.currentUser?.name || 'Elena Ramos',
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      size: this.uploadNoteForm.fileSize || '1.0 MB',
      pages: 1,
      summary: this.uploadNoteForm.summary.trim() || `Archivo subido por ${this.currentUser?.name || 'Elena Ramos'}: ${this.uploadNoteForm.fileName}`,
      fileName: this.uploadNoteForm.fileName,
      fileDataUrl: this.uploadNoteForm.fileDataUrl
    };

    this.uploadingNote = true;
    this.uploadNoteError = '';
    this.cdr.markForCheck();

    // 1) Primero al servidor. El PDF no se mete en la cola genérica (duplicaría el
    //    peso en localStorage): si falla, se reintenta desde la copia local.
    const result = await this.apiSync.send('/apuntes', newNote, false);
    this.uploadingNote = false;

    if (result === 'rejected') {
      this.uploadNoteError =
        'El servidor no ha aceptado el archivo (puede ser demasiado grande). Prueba con un PDF más pequeño.';
      this.cdr.markForCheck();
      return;
    }

    // 2) Copia local para verlo al instante y sin conexión.
    try {
      const raw = localStorage.getItem(MisClasesPage.UPLOADED_NOTES_KEY);
      const uploaded = raw ? (JSON.parse(raw) as StudentNoteItem[]) : [];
      const next = [newNote, ...(Array.isArray(uploaded) ? uploaded : [])];
      localStorage.setItem(MisClasesPage.UPLOADED_NOTES_KEY, JSON.stringify(next));
    } catch {
      // Sin espacio en localStorage (PDF grande): se mantiene en memoria esta sesión.
      this.baseNotesList.unshift(newNote);
    }

    this.showUploadNoteModal = false;
    if (result === 'queued') {
      this.addPendingNote(newNote.id);
      this.uploadNoteSuccess =
        `Archivo "${newNote.fileName}" guardado en este equipo. No se ha podido enviar al servidor todavía: se reintentará automáticamente cuando haya conexión.`;
    } else {
      this.uploadNoteSuccess = `¡Archivo "${newNote.fileName}" subido y guardado! Ya está disponible para que Paula lo vea y descargue.`;
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onOnline);
  }

  private readPendingNotes(): string[] {
    try {
      const raw = localStorage.getItem(MisClasesPage.PENDING_NOTES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writePendingNotes(ids: string[]): void {
    try {
      if (ids.length === 0) {
        localStorage.removeItem(MisClasesPage.PENDING_NOTES_KEY);
      } else {
        localStorage.setItem(MisClasesPage.PENDING_NOTES_KEY, JSON.stringify(ids));
      }
    } catch {
      // ignore
    }
  }

  private addPendingNote(id: string): void {
    const ids = this.readPendingNotes();
    if (!ids.includes(id)) {
      this.writePendingNotes([...ids, id]);
    }
  }

  /** Reintenta enviar al servidor los apuntes que se subieron sin conexión. */
  private async retryPendingNotes(): Promise<void> {
    const ids = this.readPendingNotes();
    if (ids.length === 0) {
      return;
    }
    let uploaded: StudentNoteItem[] = [];
    try {
      const raw = localStorage.getItem(MisClasesPage.UPLOADED_NOTES_KEY);
      uploaded = raw ? (JSON.parse(raw) as StudentNoteItem[]) : [];
    } catch {
      uploaded = [];
    }
    const stillPending: string[] = [];
    for (const id of ids) {
      const note = Array.isArray(uploaded) ? uploaded.find(n => n.id === id) : undefined;
      if (!note) {
        continue; // la copia local ya no existe: nada que reenviar
      }
      const result = await this.apiSync.send('/apuntes', note, false);
      if (result === 'queued') {
        stillPending.push(id);
      }
    }
    this.writePendingNotes(stillPending);
  }

  /** Abre en una nueva pestaña el archivo real subido por la profesora */
  viewUploadedNote(note: StudentNoteItem): void {
    if (!note.fileDataUrl) {
      this.downloadNotePdf(note);
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${note.fileDataUrl}" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
      );
    }
  }

  /** Conversación activa seleccionada */
  get activeConversation(): TeacherConversation {
    return this.conversations.find(c => c.id === this.selectedTeacherId) || this.conversations[0];
  }

  selectConversation(id: string): void {
    this.selectedTeacherId = id;
    const conv = this.conversations.find(c => c.id === id);
    if (conv) {
      conv.unread = 0;
    }
    this.cdr.markForCheck();
  }

  /** Determina si el mensaje fue enviado por el usuario actual */
  isMyMessage(msg: { sender: string }): boolean {
    if (this.isCoordinator) {
      return msg.sender === 'coordinator';
    }
    if (this.isTeacher) {
      return msg.sender === 'teacher';
    }
    return msg.sender === 'student';
  }

  /** Envía un mensaje en tiempo real y lo persiste para que Elena y Paula puedan chatear entre sí */
  sendMessage(): void {
    const text = this.newMessageText.trim();
    if (!text) return;

    const conv = this.activeConversation;
    if (this.isTeacher && conv.id === 'paula') {
      this.chatService.send('elenaramos@itutor.es', 'paulagarcia@itutor.es', text);
    } else if (!this.isTeacher && !this.isCoordinator && conv.id === 'elena') {
      this.chatService.send('paulagarcia@itutor.es', 'elenaramos@itutor.es', text);
    } else if (this.isTeacher && conv.id === 'noelia') {
      this.chatService.send('elenaramos@itutor.es', 'noeliacantador@itutor.es', text);
    } else if (this.isCoordinator && conv.id === 'elena') {
      this.chatService.send('noeliacantador@itutor.es', 'elenaramos@itutor.es', text);
    } else {
      conv.messages.push({
        sender: this.isCoordinator ? 'coordinator' : (this.isTeacher ? 'teacher' : 'student'),
        text,
        time: 'Ahora'
      });
    }

    this.newMessageText = '';
    this.syncChatThreads();
    this.cdr.markForCheck();
  }

  /** Conmuta rápidamente entre el rol de Elena (Profesora) y Paula (Alumna) para probar el chat en vivo */
  switchChatRole(target: 'elena' | 'paula'): void {
    if (target === 'elena') {
      this.authService.login('elenaramos@itutor.es', 'Teacher', 'Elena Ramos');
      this.selectedTeacherId = 'paula';
    } else {
      this.authService.login('paulagarcia@itutor.es', 'Standard', 'Paula García');
      this.selectedTeacherId = 'elena';
    }
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
      date: '2026-10-28',
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

    const teacherEmail = this.currentUser?.email || 'elenaramos@itutor.es';
    const teacher = this.dataService.findTeacherByEmail(teacherEmail);
    const tarifa = teacher?.tarifaHora || 35;
    const durationMin = Number(this.scheduleForm.durationMin) || 90;
    const price = Math.round((tarifa * durationMin) / 60);

    this.scheduleService.schedule({
      teacherEmail,
      teacherName: teacher?.nombre || 'Elena Ramos',
      studentEmail: student.email,
      studentName: student.nombre,
      subject: this.scheduleForm.subject || student.asignaturaPrincipal,
      topic: this.scheduleForm.topic || 'Sesión de tutoría',
      start: `${this.scheduleForm.date}T${this.scheduleForm.time}`,
      durationMin,
      price,
      notes: this.scheduleForm.topic || 'Clase agendada por el profesor'
    });

    this.showScheduleModal = false;
    this.scheduleSuccessMsg = `¡Clase agendada con ${student.nombre} el ${this.scheduleForm.date} a las ${this.scheduleForm.time}!`;
    this.syncScheduledClassesIntoCalendar();
    const dayNum = Number(this.scheduleForm.date.split('-')[2]);
    if (dayNum >= 1 && dayNum <= 31) {
      this.selectedDay = dayNum;
    }
    this.cdr.markForCheck();
  }

  /** Descarga el archivo original subido por la profesora o genera el PDF con jsPDF */
  downloadNotePdf(note: StudentNoteItem): void {
    if (note.fileDataUrl) {
      const a = document.createElement('a');
      a.href = note.fileDataUrl;
      a.download = note.fileName || `${note.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    doc.text(`Alumna: Paula García (paulagarcia@itutor.es)`, 14, 54);
    doc.text(`Concepto: ${payment.concept}`, 14, 62);
    doc.text(`Asignatura: ${payment.subject}`, 14, 70);
    doc.text(`Profesor/a: ${payment.teacher}`, 14, 78);
    doc.text(`Fecha de abono: ${payment.date}`, 14, 86);
    doc.text(`Método de pago: ${payment.method}`, 14, 94);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text(`IMPORTE TOTAL PAGADO: ${payment.amount},00 € (${payment.status.toUpperCase()})`, 14, 112);

    doc.save(`Recibo_iTUTOR_${payment.id}.pdf`);
  }

  /** =======================================================================
   *  AJUSTES DE CUENTA: FOTO SUBIDA POR EL USUARIO, DATOS NO MODIFICABLES Y ELIMINAR CUENTA
   *  ======================================================================= */
  settingsPhone = '+34 611 000 111';
  settingsSavedMsg = '';
  showDeleteAccountModal = false;

  get currentUserEmail(): string {
    return this.currentUser?.email || 'paulagarcia@itutor.es';
  }

  /** Foto de perfil que haya subido el propio usuario (null si no ha subido ninguna) */
  get userUploadedAvatar(): string | null {
    return this.authService.getUserAvatar(this.currentUserEmail);
  }

  get userInitialsForSettings(): string {
    const email = this.currentUserEmail.toLowerCase();
    if (email.includes('noelia')) return 'NC';
    if (email.includes('elena') || email.includes('profesor')) return 'ER';
    if (email.includes('paula')) return 'PG';
    const name = this.currentUser?.name || email;
    return name.substring(0, 2).toUpperCase();
  }

  /** Datos personales bloqueados (Nombre, Apellidos y Fecha de Nacimiento no modificables) */
  get lockedProfileData(): { firstName: string; lastName: string; birthDate: string; email: string; roleLabel: string } {
    const email = this.currentUserEmail.toLowerCase();
    if (email.includes('elena') || email.includes('profesor')) {
      return {
        firstName: 'Elena',
        lastName: 'Ramos',
        birthDate: '22/08/1985',
        email: this.currentUserEmail,
        roleLabel: 'Profesora Docente'
      };
    }
    if (email.includes('noelia')) {
      return {
        firstName: 'Noelia',
        lastName: 'Cantador',
        birthDate: '10/03/1990',
        email: this.currentUserEmail,
        roleLabel: 'Jefa Coordinadora (Admin)'
      };
    }
    if (email.includes('paula')) {
      return {
        firstName: 'Paula',
        lastName: 'García Serrano',
        birthDate: '14/05/2004',
        email: this.currentUserEmail,
        roleLabel: 'Alumna'
      };
    }
    const fullName = (this.currentUser?.name || 'Usuario iTUTOR').trim();
    const parts = fullName.split(' ');
    return {
      firstName: parts[0] || fullName,
      lastName: parts.slice(1).join(' ') || 'Sin especificar',
      birthDate: this.currentUser?.birthDate || '14/05/2002',
      email: this.currentUserEmail,
      roleLabel: this.isTeacher ? 'Profesor/a Docente' : 'Alumno/a'
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
