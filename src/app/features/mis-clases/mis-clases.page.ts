import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonMenuButton, 
  IonButton, 
  IonIcon, 
  IonBadge, 
  IonCard, 
  IonCardContent
} from '@ionic/angular';
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
  menuOutline
} from 'ionicons/icons';
import jsPDF from 'jspdf';
import { SidebarService } from '../../core/services/sidebar.service';

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
}

export interface TeacherConversation {
  id: string;
  teacherName: string;
  subject: string;
  initials: string;
  online: boolean;
  unread: number;
  messages: {
    sender: 'teacher' | 'student';
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
export class MisClasesPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public sidebarService = inject(SidebarService);

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
      teacher: 'Dra. Elena Ramos',
      teacherRole: 'Catedrática de Matemáticas Aplicadas',
      teacherInitials: 'ER',
      teacherEmail: 'elena.ramos@itutor.es',
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
      teacherEmail: 'carlos.mendez@itutor.es',
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
      teacher: 'Dra. Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elena.ramos@itutor.es',
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
      teacherEmail: 'carlos.mendez@itutor.es',
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
      teacher: 'Dra. Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elena.ramos@itutor.es',
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
      teacher: 'Dra. Elena Ramos',
      teacherRole: 'Profesora Titular de Ecuaciones Diferenciales',
      teacherInitials: 'ER',
      teacherEmail: 'elena.ramos@itutor.es',
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
      teacherEmail: 'carlos.mendez@itutor.es',
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
  selectedNotesFilter = 'Todos';
  notesList: StudentNoteItem[] = [
    {
      id: 'AP-01',
      title: 'Tema 4: Transformada de Laplace y EDOs de 2º Orden',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Dra. Elena Ramos',
      date: '10 Oct 2026',
      size: '2.4 MB',
      pages: 18,
      summary: 'Apuntes completos de la clase del 10 de octubre: tabla de transformadas, teoremas de traslación y 8 problemas de valor inicial resueltos paso a paso.'
    },
    {
      id: 'AP-02',
      title: 'Boletín Resuelto: EDOs Exactas y Factor Integrante',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Dra. Elena Ramos',
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
      teacher: 'Dra. Elena Ramos',
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
  conversations: TeacherConversation[] = [
    {
      id: 'elena',
      teacherName: 'Dra. Elena Ramos',
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
    { subject: 'Ecuaciones Diferenciales (Dra. Elena Ramos)', amount: 210, sessions: 6, percentage: 55, color: '#2563eb' },
    { subject: 'Cálculo Multivariable (Prof. Carlos Méndez)', amount: 105, sessions: 3, percentage: 27, color: '#10b981' },
    { subject: 'Álgebra Lineal (Prof. Carlos Méndez)', amount: 70, sessions: 2, percentage: 18, color: '#6366f1' }
  ];

  paymentsHistory: StudentPaymentRecord[] = [
    {
      id: 'FAC-2026-1010',
      date: '10 Oct 2026',
      concept: 'Tutoría Ecuaciones Diferenciales (90 min)',
      subject: 'Ecuaciones Diferenciales',
      teacher: 'Dra. Elena Ramos',
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
      teacher: 'Dra. Elena Ramos',
      method: 'Visa •••• 4821',
      amount: 35,
      status: 'Pagado'
    },
    {
      id: 'FAC-2026-0926',
      date: '26 Sep 2026',
      concept: 'Bono Mensual Septiembre (8 Sesiones Intensivas)',
      subject: 'Ecuaciones Diferenciales & Cálculo',
      teacher: 'Dra. Elena Ramos / Prof. Carlos Méndez',
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
      menuOutline
    });
    this.buildOctoberCalendar();
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      if (data && data['section']) {
        this.activeSection = data['section'];
        this.cdr.markForCheck();
      }
    });
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
    } else {
      this.selectedTeacherId = 'noelia';
    }
    this.switchSection('mensajes');
  }

  /** Apuntes filtrados por asignatura */
  get filteredNotes(): StudentNoteItem[] {
    if (this.selectedNotesFilter === 'Todos') {
      return this.notesList;
    }
    return this.notesList.filter(n => n.subject === this.selectedNotesFilter);
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

  /** Envía un mensaje en tiempo real al profesor seleccionado */
  sendMessage(): void {
    const text = this.newMessageText.trim();
    if (!text) return;

    this.activeConversation.messages.push({
      sender: 'student',
      text,
      time: 'Ahora'
    });
    this.newMessageText = '';
    this.cdr.markForCheck();
  }

  /** Descarga en PDF un apunte o recibo usando jsPDF */
  downloadNotePdf(note: StudentNoteItem): void {
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
}
