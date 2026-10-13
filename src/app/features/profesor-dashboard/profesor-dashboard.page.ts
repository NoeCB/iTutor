import { 
  Component, 
  OnInit, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  inject 
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonMenuButton, 
  IonGrid, 
  IonRow, 
  IonCol,
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  cashOutline, 
  peopleOutline, 
  timeOutline, 
  schoolOutline, 
  walletOutline,
  downloadOutline,
  documentTextOutline,
  star,
  callOutline,
  mailOutline,
  checkmarkCircle,
  sparklesOutline,
  personCircleOutline,
  cardOutline,
  checkmarkDoneOutline,
  chatbubblesOutline
} from 'ionicons/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  DataService, 
  TeacherRecord, 
  SqlStudentRate, 
  MongoClassSession 
} from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  templateUrl: './profesor-dashboard.page.html',
  styleUrls: ['./profesor-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonButtons, 
    IonMenuButton, 
    IonGrid, 
    IonRow, 
    IonCol,
    IonButton,
    IonIcon,
    IonSpinner,
    StatCardComponent,
    DataTableComponent
  ],
  providers: [CurrencyPipe, DatePipe]
})
export class ProfesorDashboardPage implements OnInit {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;

  /** Catálogo completo de profesores disponibles para conmutar */
  allTeachers: TeacherRecord[] = [];

  /** Profesor actualmente visualizado */
  selectedTeacherId: number = 201;
  currentTeacher: TeacherRecord | null = null;

  /** Alumnos que tiene asignados este profesor */
  assignedStudents: SqlStudentRate[] = [];

  /** Sesiones impartidas por este profesor */
  teacherSessions: MongoClassSession[] = [];

  /** Resumen de métricas del profesor */
  totalMoneyEarned = 0;
  totalHoursTaught = 0;
  activeStudentsCount = 0;

  /** Columnas de la tabla agnóstica de sesiones del profesor */
  sessionColumns: TableColumn[] = [
    { key: 'estudianteNombre', label: 'Alumno' },
    { key: 'materia', label: 'Asignatura Impartida' },
    { key: 'fecha', label: 'Fecha y Hora' },
    { key: 'duracionMin', label: 'Duración (min)', align: 'center' },
    { key: 'importe', label: 'Honorarios Ganados', type: 'currency', align: 'right' },
    { 
      key: 'estado', 
      label: 'Estado de Pago', 
      type: 'badge', 
      align: 'center',
      badgeColorMap: {
        'Confirmada': 'success',
        'En Curso': 'primary',
        'Pendiente': 'warning',
        'Cancelada': 'danger'
      }
    }
  ];

  constructor() {
    addIcons({
      cashOutline,
      peopleOutline,
      timeOutline,
      schoolOutline,
      walletOutline,
      downloadOutline,
      documentTextOutline,
      star,
      callOutline,
      mailOutline,
      checkmarkCircle,
      sparklesOutline,
      personCircleOutline,
      cardOutline,
      checkmarkDoneOutline,
      chatbubblesOutline
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.dataService.getTeachersCatalog().subscribe({
      next: (teachers) => {
        this.allTeachers = teachers;

        // Comprobar si el usuario en sesión es un profesor específico
        const user = this.authService.currentUserValue;
        if (user && user.role === 'Teacher') {
          const match = teachers.find(t => t.email.toLowerCase() === user.email.toLowerCase());
          if (match) {
            this.selectedTeacherId = match.id;
          }
        }

        this.selectTeacher(this.selectedTeacherId);
      },
      error: (err) => {
        console.error('Error al cargar catálogo de profesores:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Cambia el profesor seleccionado en el selector */
  onTeacherSelected(teacherId: number): void {
    this.selectedTeacherId = teacherId;
    this.selectTeacher(teacherId);
  }

  selectTeacher(teacherId: number): void {
    const teacher = this.allTeachers.find(t => t.id === teacherId) || this.allTeachers[0];
    if (!teacher) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.currentTeacher = teacher;

    this.dataService.getTeacherPortalData(teacher.email).subscribe({
      next: (portalData) => {
        this.assignedStudents = portalData.students;
        this.teacherSessions = portalData.sessions;
        this.totalMoneyEarned = portalData.totalEarned;
        this.totalHoursTaught = portalData.hoursCount;
        this.activeStudentsCount = portalData.students.length;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar datos del profesor:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Calcula las iniciales del profesor */
  getTeacherInitials(nombre?: string): string {
    if (!nombre) return 'PR';
    const clean = nombre.replace(/(Dra\.|Dr\.|Prof\.)/g, '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  }

  /** Genera e imprime en PDF el informe oficial de honorarios ganados */
  exportEarningsPdf(): void {
    if (!this.currentTeacher) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor: [number, number, number] = [37, 99, 235];
    const darkColor: [number, number, number] = [15, 23, 42];
    const grayColor: [number, number, number] = [100, 116, 139];

    // Encabezado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('iTUTOR • Liquidación Oficial de Honorarios Docentes', 14, 17);

    // Datos del profesor
    doc.setTextColor(...darkColor);
    doc.setFontSize(13);
    doc.text(`Profesor/a: ${this.currentTeacher.nombre}`, 14, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text(`Especialidad: ${this.currentTeacher.especialidad} (${this.currentTeacher.departamento})`, 14, 47);
    doc.text(`Email oficial: ${this.currentTeacher.email} | Tel: ${this.currentTeacher.telefono}`, 14, 53);
    doc.text(`Tarifa estipulada: ${this.currentTeacher.tarifaHora} € / hora`, 14, 59);

    // Tarjeta de Resumen
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 66, 182, 22, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('TOTAL DINERO GANADO', 20, 74);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Verde esmeralda
    doc.text(`${this.totalMoneyEarned},00 €`, 20, 83);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('ALUMNOS ASIGNADOS', 90, 74);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text(`${this.assignedStudents.length} estudiantes`, 90, 83);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('HORAS IMPARTIDAS', 150, 74);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`${this.totalHoursTaught} horas`, 150, 83);

    // Tabla de sesiones
    const tableData = this.teacherSessions.map(s => [
      s.estudianteNombre,
      s.materia,
      s.fecha,
      `${s.duracionMin} min`,
      `${s.importe} €`,
      s.estado
    ]);

    autoTable(doc, {
      startY: 96,
      head: [['Alumno', 'Asignatura', 'Fecha y Hora', 'Duración', 'Ganancia', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { fontStyle: 'bold', halign: 'right' },
        5: { halign: 'center' }
      }
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`iTUTOR_Honorarios_${this.currentTeacher.nombre.replace(/\s+/g, '_')}_${timestamp}.pdf`);
  }
}
