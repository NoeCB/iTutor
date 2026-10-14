import { 
  Component, 
  OnInit, 
  AfterViewInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  inject 
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonBadge,
  IonToggle
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  menuOutline,
  trendingUpOutline,
  checkmarkCircleOutline,
  checkmarkDoneCircleOutline,
  downloadOutline, 
  documentTextOutline, 
  filterOutline, 
  refreshOutline, 
  cashOutline, 
  peopleOutline, 
  timeOutline, 
  schoolOutline, 
  barChartOutline, 
  pieChartOutline,
  sparklesOutline,
  walletOutline,
  alertCircleOutline,
  eyeOutline,
  cardOutline,
  addCircleOutline,
  personRemoveOutline,
  informationCircleOutline,
  serverOutline,
  cloudOutline,
  shieldCheckmarkOutline,
  settingsOutline
} from 'ionicons/icons';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subscription } from 'rxjs';

import { 
  DataService, 
  MongoClassSession, 
  SqlStudentRate,
  TeacherRecord 
} from '../../core/services/data.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonButtons, 
    IonGrid, 
    IonRow, 
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonBadge,
    IonToggle,
    StatCardComponent,
    DataTableComponent
  ],
  providers: [CurrencyPipe, DatePipe]
})
export class AdminDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public sidebarService = inject(SidebarService);

  @ViewChild('revenueChartCanvas') revenueChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('classesChartCanvas') classesChartCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de gráficos Chart.js
  private revenueChart: Chart | null = null;
  private classesChart: Chart | null = null;
  private querySub?: Subscription;

  // Estado del Dashboard
  isLoading = true;
  activeTab: 'metricas' | 'profesores' | 'alumnos' | 'ajustes' = 'metricas';
  selectedPeriod: 'todos' | 'septiembre' | 'octubre' | 'noviembre' | 'diciembre' = 'todos';

  // Deslizador interactivo para filtrar clases confirmadas
  mostrarSoloConfirmadas = true;
  confirmedSessionsCount = 0;
  totalPeriodSessionsCount = 0;

  // Datos brutos recuperados concurrentemente mediante forkJoin
  rawSqlStudents: SqlStudentRate[] = [];
  rawTeachers: TeacherRecord[] = [];
  rawNoSqlSessions: MongoClassSession[] = [];

  // Datos filtrados reactivamente para métricas
  filteredSessions: MongoClassSession[] = [];

  // KPIs dinámicos calculados
  kpis = {
    ingresosTotales: '0 €',
    ingresosCrecimiento: 14.2,
    estudiantesActivos: 0,
    estudiantesCrecimiento: 8.5,
    horasImpartidas: '0 h',
    horasCrecimiento: 18.0,
    tasaAsistencia: '0%',
    asistenciaCrecimiento: 2.4
  };

  // KPIs específicos de profesores (sin emojis)
  teacherKpis = {
    totalProfesores: 10,
    totalGanado: '0 €',
    totalHoras: '0 h',
    valoracionMedia: '4.8 / 5'
  };

  // KPIs específicos de alumnos
  studentKpis = {
    totalAlumnos: 10,
    saldoPendienteTotal: '0 €',
    horasTotalesAlumnos: '0 h',
    tarifaMedia: '0 €/h'
  };

  /** Columnas de la tabla de sesiones (sin 'estado' ni 'acciones') */
  tableColumns: TableColumn[] = [
    { key: 'estudianteNombre', label: 'Estudiante' },
    { key: 'materia', label: 'Asignatura (Rama)' },
    { key: 'tutor', label: 'Profesor Tutor' },
    { key: 'fecha', label: 'Fecha y Hora' },
    { key: 'importe', label: 'Tarifa', type: 'currency', align: 'right' }
  ];

  /** Columnas de la tabla de profesores */
  teacherTableColumns: TableColumn[] = [
    { key: 'nombre', label: 'Profesor / Docente' },
    { key: 'especialidad', label: 'Especialidad Docente' },
    { key: 'departamento', label: 'Departamento' },
    { key: 'alumnosCount', label: 'Alumnos', align: 'center' },
    { key: 'horasImpartidas', label: 'Horas Dadas', align: 'center' },
    { key: 'tarifaHora', label: 'Tarifa/Hora', type: 'currency', align: 'right' },
    { key: 'totalGanado', label: 'Total Ganado', type: 'currency', align: 'right' },
    { key: 'telefono', label: 'Contacto' },
    { 
      key: 'estado', 
      label: 'Estado', 
      type: 'badge', 
      align: 'center',
      badgeColorMap: {
        'Activo': 'success',
        'Disponible': 'primary'
      }
    }
  ];

  /** Columnas de la tabla de alumnos */
  studentTableColumns: TableColumn[] = [
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nombre', label: 'Estudiante' },
    { key: 'asignaturaPrincipal', label: 'Asignatura Principal' },
    { 
      key: 'plan', 
      label: 'Plan', 
      type: 'badge', 
      align: 'center',
      badgeColorMap: {
        'Premium': 'secondary',
        'Intensivo': 'primary',
        'Básico': 'medium'
      }
    },
    { key: 'profesorAsignado', label: 'Profesor Tutor' },
    { key: 'horasTotales', label: 'Horas', align: 'center' },
    { key: 'tarifaHora', label: 'Tarifa/h', type: 'currency', align: 'right' },
    { key: 'saldoPendiente', label: 'Saldo Pend.', type: 'currency', align: 'right' },
    { 
      key: 'estado', 
      label: 'Estado', 
      type: 'badge', 
      align: 'center',
      badgeColorMap: {
        'Al día': 'success',
        'Pendiente': 'warning'
      }
    }
  ];

  constructor() {
    addIcons({
      menuOutline,
      trendingUpOutline,
      checkmarkCircleOutline,
      checkmarkDoneCircleOutline,
      downloadOutline,
      documentTextOutline,
      filterOutline,
      refreshOutline,
      cashOutline,
      peopleOutline,
      timeOutline,
      schoolOutline,
      barChartOutline,
      pieChartOutline,
      sparklesOutline,
      walletOutline,
      alertCircleOutline,
      eyeOutline,
      cardOutline,
      addCircleOutline,
      personRemoveOutline,
      informationCircleOutline,
      serverOutline,
      cloudOutline,
      shieldCheckmarkOutline,
      settingsOutline
    });
  }

  /** Alterna la apertura o colapso del menú lateral */
  toggleMenu(): void {
    this.sidebarService.toggleMenu();
  }

  /** Manejador del deslizador para alternar clases confirmadas */
  onConfirmedToggleChange(checked: boolean): void {
    this.mostrarSoloConfirmadas = checked;
    this.applyPeriodFilter();
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.fetchConcurrentData();

    // Sincronizar pestaña si entra desde el menú lateral con parámetro
    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['vista'] && (params['vista'] === 'metricas' || params['vista'] === 'profesores' || params['vista'] === 'alumnos' || params['vista'] === 'ajustes')) {
        this.activeTab = params['vista'];
        this.cdr.markForCheck();
        if (this.activeTab === 'metricas') {
          setTimeout(() => this.initOrUpdateCharts(), 100);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.isLoading && this.activeTab === 'metricas') {
      this.initCharts();
    }
  }

  ngOnDestroy(): void {
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
    if (this.revenueChart) {
      this.revenueChart.destroy();
      this.revenueChart = null;
    }
    if (this.classesChart) {
      this.classesChart.destroy();
      this.classesChart = null;
    }
  }

  /**
   * Consumo concurrente mediante DataService (forkJoin de Alumnos SQL, Profesores SQL y Sesiones NoSQL)
   */
  fetchConcurrentData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.dataService.getCombinedDashboardData().subscribe({
      next: (data) => {
        this.rawSqlStudents = data.catalogoSql;
        this.rawTeachers = data.profesoresSql;
        this.rawNoSqlSessions = data.sesionesNoSql;
        
        this.applyPeriodFilter();
        this.calculateTeachersAndStudentsKpis();

        this.isLoading = false;
        this.cdr.markForCheck();

        if (this.activeTab === 'metricas') {
          setTimeout(() => {
            this.initOrUpdateCharts();
          }, 50);
        }
      },
      error: (err) => {
        console.error('Error al consumir datos concurrentes del Dashboard:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Cambio entre Pestaña Métricas / Profesores / Alumnos */
  onTabChange(tab: any): void {
    this.activeTab = tab;
    this.cdr.markForCheck();

    if (this.activeTab === 'metricas') {
      setTimeout(() => {
        this.initOrUpdateCharts();
      }, 50);
    }
  }

  /** Calcula métricas de los 10 profesores y 10 alumnos */
  private calculateTeachersAndStudentsKpis(): void {
    // Profesores
    const totalGanado = this.rawTeachers.reduce((sum, t) => sum + t.totalGanado, 0);
    const totalHoras = this.rawTeachers.reduce((sum, t) => sum + t.horasImpartidas, 0);
    const avgRating = (this.rawTeachers.reduce((sum, t) => sum + t.calificacion, 0) / (this.rawTeachers.length || 1)).toFixed(1);

    this.teacherKpis = {
      totalProfesores: this.rawTeachers.length,
      totalGanado: `${totalGanado.toLocaleString('es-ES')} €`,
      totalHoras: `${totalHoras} h`,
      valoracionMedia: `${avgRating} / 5`
    };

    // Alumnos
    const saldoPend = this.rawSqlStudents.reduce((sum, s) => sum + s.saldoPendiente, 0);
    const horasAlumnos = this.rawSqlStudents.reduce((sum, s) => sum + s.horasTotales, 0);
    const tarifaMedia = Math.round(this.rawSqlStudents.reduce((sum, s) => sum + s.tarifaHora, 0) / (this.rawSqlStudents.length || 1));

    this.studentKpis = {
      totalAlumnos: this.rawSqlStudents.length,
      saldoPendienteTotal: `${saldoPend.toLocaleString('es-ES')} €`,
      horasTotalesAlumnos: `${horasAlumnos} h`,
      tarifaMedia: `${tarifaMedia} €/h`
    };
  }

  /** Navega directamente al portal del profesor seleccionado */
  viewTeacherPortal(teacher: any): void {
    this.router.navigate(['/portal-profesor']);
  }

  /** Manejador del filtro de mes */
  onFilterChange(period: any): void {
    this.selectedPeriod = period;
    this.applyPeriodFilter();
    this.updateChartsData();
    this.cdr.markForCheck();
  }

  /** Filtrado en memoria y recálculo dinámico de estadísticas KPI */
  private applyPeriodFilter(): void {
    const periodSessions = this.selectedPeriod === 'todos'
      ? [...this.rawNoSqlSessions]
      : this.rawNoSqlSessions.filter(session => session.mes === this.selectedPeriod);

    this.totalPeriodSessionsCount = periodSessions.length;
    this.confirmedSessionsCount = periodSessions.filter(s => s.estado === 'Confirmada').length;

    if (this.mostrarSoloConfirmadas) {
      this.filteredSessions = periodSessions.filter(s => s.estado === 'Confirmada');
    } else {
      this.filteredSessions = periodSessions;
    }

    const totalIngresos = periodSessions
      .filter(s => s.estado !== 'Cancelada')
      .reduce((sum, s) => sum + s.importe, 0);

    const totalMinutos = periodSessions
      .filter(s => s.estado !== 'Cancelada')
      .reduce((sum, s) => sum + s.duracionMin, 0);

    const alumnosUnicos = new Set(
      periodSessions.map(s => s.estudianteId)
    ).size;

    const sesionesCompletadas = periodSessions.filter(s => s.asistencia).length;
    const tasaAsistencia = periodSessions.length > 0
      ? Math.round((sesionesCompletadas / periodSessions.length) * 100)
      : 0;

    this.kpis = {
      ingresosTotales: `${totalIngresos.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €`,
      ingresosCrecimiento: this.selectedPeriod === 'diciembre' ? -3.4 : 14.2,
      estudiantesActivos: alumnosUnicos || this.rawSqlStudents.length,
      estudiantesCrecimiento: 8.5,
      horasImpartidas: `${Math.round(totalMinutos / 60)} h`,
      horasCrecimiento: 18.0,
      tasaAsistencia: `${tasaAsistencia}%`,
      asistenciaCrecimiento: 2.4
    };
  }

  /** Inicialización o actualización condicional de los gráficos de Chart.js */
  private initOrUpdateCharts(): void {
    if (!this.revenueChartCanvas) return;

    if (!this.revenueChart) {
      this.initCharts();
    } else {
      this.updateChartsData();
    }
  }

  /** Creación de las instancias de Chart.js */
  private initCharts(): void {
    if (!this.revenueChartCanvas) return;

    // 1. Gráfico: "Ingresos por Asignatura" (Line Chart)
    const revenueData = this.computeRevenueBySubject();
    this.revenueChart = new Chart(this.revenueChartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: revenueData.labels,
        datasets: [{
          label: 'Ingresos (€)',
          data: revenueData.values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.parsed.y} € facturados`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { callback: (value) => `${value} €`, color: '#64748b' }
          },
          x: { grid: { display: false }, ticks: { color: '#475569' } }
        }
      }
    });
  }

  /** Actualización reactiva de datos en gráficos existentes */
  private updateChartsData(): void {
    if (this.revenueChart) {
      const revenueData = this.computeRevenueBySubject();
      this.revenueChart.data.labels = revenueData.labels;
      this.revenueChart.data.datasets[0].data = revenueData.values;
      this.revenueChart.update('active');
    }
  }

  private computeRevenueBySubject(): { labels: string[]; values: number[] } {
    const revenueMap: { [key: string]: number } = {};
    this.filteredSessions
      .filter(s => s.estado !== 'Cancelada')
      .forEach(s => {
        revenueMap[s.materia] = (revenueMap[s.materia] || 0) + s.importe;
      });

    return {
      labels: Object.keys(revenueMap),
      values: Object.values(revenueMap)
    };
  }

  private computeClassesByBranch(): { labels: string[]; values: number[] } {
    const branchMap: { [key: string]: number } = {};
    this.filteredSessions.forEach(s => {
      branchMap[s.rama] = (branchMap[s.rama] || 0) + 1;
    });

    return {
      labels: Object.keys(branchMap),
      values: Object.values(branchMap)
    };
  }

  /** Exportación a CSV adaptada a la pestaña activa */
  exportToCsv(): void {
    let csvContent = '';
    let fileName = '';

    if (this.activeTab === 'profesores') {
      csvContent = 'Nombre,Especialidad,Departamento,Alumnos,Horas,TarifaHora,TotalGanado,Telefono,Estado\n';
      this.rawTeachers.forEach(t => {
        csvContent += `"${t.nombre}","${t.especialidad}","${t.departamento}",${t.alumnosCount},${t.horasImpartidas},${t.tarifaHora},${t.totalGanado},"${t.telefono}","${t.estado}"\n`;
      });
      fileName = `iTUTOR_Listado_Profesores_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (this.activeTab === 'alumnos') {
      csvContent = 'Matricula,Nombre,Email,AsignaturaPrincipal,Plan,ProfesorAsignado,TarifaHora,SaldoPendiente,HorasTotales,Telefono,Estado\n';
      this.rawSqlStudents.forEach(s => {
        csvContent += `"${s.matricula}","${s.nombre}","${s.email}","${s.asignaturaPrincipal}","${s.plan}","${s.profesorAsignado}",${s.tarifaHora},${s.saldoPendiente},${s.horasTotales},"${s.telefono}","${s.estado}"\n`;
      });
      fileName = `iTUTOR_Listado_Alumnos_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      csvContent = 'Estudiante,Materia,Rama,Tutor,Fecha,DuracionMin,Importe,Estado,Asistencia\n';
      this.filteredSessions.forEach(s => {
        csvContent += `"${s.estudianteNombre}","${s.materia}","${s.rama}","${s.tutor}","${s.fecha}",${s.duracionMin},${s.importe},"${s.estado}",${s.asistencia}\n`;
      });
      fileName = `iTUTOR_Sesiones_${this.selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** Exportación a PDF adaptada a la pestaña activa */
  exportToPdf(): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor: [number, number, number] = [37, 99, 235];
    const darkColor: [number, number, number] = [15, 23, 42];
    const grayColor: [number, number, number] = [100, 116, 139];

    // Encabezado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('iTUTOR', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Plataforma Inteligente de Gestión Académica • Informe Oficial', 50, 14);

    if (this.activeTab === 'profesores') {
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Censo Oficial de Profesores y Honorarios Docentes', 14, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text(`Total docentes en plantilla: ${this.rawTeachers.length} | Honorarios globales: ${this.teacherKpis.totalGanado}`, 14, 40);

      const tableData = this.rawTeachers.map(t => [
        t.nombre,
        t.especialidad,
        t.departamento,
        t.alumnosAsignados.join(', '),
        `${t.horasImpartidas} h`,
        `${t.tarifaHora} €/h`,
        `${t.totalGanado} €`,
        `${t.calificacion} / 5`,
        t.telefono,
        t.estado
      ]);

      autoTable(doc, {
        startY: 46,
        head: [['Profesor', 'Especialidad', 'Rama', 'Alumnos Asignados', 'Horas', 'Tarifa', 'Total Ganado', 'Valoración', 'Contacto', 'Estado']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 34 },
          1: { cellWidth: 38 },
          6: { fontStyle: 'bold', halign: 'right', cellWidth: 22 }
        }
      });

      doc.save(`iTUTOR_Listado_Profesores_${new Date().toISOString().slice(0, 10)}.pdf`);
    } else if (this.activeTab === 'alumnos') {
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Censo Oficial de Alumnos Matriculados y Tarifas', 14, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text(`Total alumnos activos: ${this.rawSqlStudents.length} | Saldo pendiente global: ${this.studentKpis.saldoPendienteTotal}`, 14, 40);

      const tableData = this.rawSqlStudents.map(s => [
        s.matricula,
        s.nombre,
        s.email,
        s.asignaturaPrincipal,
        s.plan,
        s.profesorAsignado,
        `${s.horasTotales} h`,
        `${s.tarifaHora} €/h`,
        `${s.saldoPendiente} €`,
        s.estado
      ]);

      autoTable(doc, {
        startY: 46,
        head: [['Matrícula', 'Estudiante', 'Email', 'Asignatura Principal', 'Plan', 'Profesor Tutor', 'Horas', 'Tarifa', 'Saldo Pendiente', 'Estado']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 26 },
          1: { fontStyle: 'bold', cellWidth: 34 },
          8: { fontStyle: 'bold', halign: 'right', cellWidth: 22 }
        }
      });

      doc.save(`iTUTOR_Listado_Alumnos_${new Date().toISOString().slice(0, 10)}.pdf`);
    } else {
      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Informe de Gestión Académica y Financiera (Sesiones)', 14, 34);

      const tableData = this.filteredSessions.map(s => [
        s.estudianteNombre,
        s.materia,
        s.rama,
        s.tutor,
        s.fecha,
        `${s.duracionMin} min`,
        `${s.importe} €`,
        s.estado,
        s.asistencia ? 'Sí' : 'No'
      ]);

      autoTable(doc, {
        startY: 44,
        head: [['Estudiante', 'Asignatura', 'Rama', 'Profesor Tutor', 'Fecha y Hora', 'Duración', 'Importe', 'Estado', 'Asistió']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 42 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 }
        }
      });

      doc.save(`iTUTOR_Informe_Sesiones_${this.selectedPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  }

  /** Dar de alta un nuevo alumno */
  openAddStudentModal(): void {
    const nuevoId = Math.max(...this.rawSqlStudents.map(s => s.id), 0) + 1;
    const nuevoAlumno: SqlStudentRate = {
      id: nuevoId,
      nombre: `Nuevo Alumno ${nuevoId}`,
      email: `alumno${nuevoId}@alumnos.nebrija.es`,
      matricula: `MAT-2026-${String(nuevoId).padStart(3, '0')}`,
      tarifaHora: 30,
      plan: 'Básico',
      asignaturaPrincipal: 'Sin asignar',
      profesorAsignado: 'Sin asignar',
      saldoPendiente: 0,
      horasTotales: 0,
      telefono: '+34 600 000 000',
      estado: 'Al día'
    };
    this.rawSqlStudents = [...this.rawSqlStudents, nuevoAlumno];
    this.calculateTeachersAndStudentsKpis();
    this.cdr.markForCheck();
  }

  /** Dar de baja un alumno */
  darDeBajaAlumno(student: SqlStudentRate): void {
    this.rawSqlStudents = this.rawSqlStudents.filter(s => s.id !== student.id);
    this.calculateTeachersAndStudentsKpis();
    this.cdr.markForCheck();
  }

  /** Dar de alta un nuevo profesor */
  openAddTeacherModal(): void {
    const nuevoId = Math.max(...this.rawTeachers.map(t => t.id), 0) + 1;
    const nuevoProfesor: TeacherRecord = {
      id: nuevoId,
      nombre: `Nuevo Profesor ${nuevoId}`,
      email: `profesor${nuevoId}@itutor.es`,
      especialidad: 'Sin asignar',
      departamento: 'Matemáticas',
      tarifaHora: 30,
      alumnosAsignados: [],
      alumnosCount: 0,
      horasImpartidas: 0,
      totalGanado: 0,
      calificacion: 0,
      telefono: '+34 600 000 000',
      estado: 'Disponible'
    };
    this.rawTeachers = [...this.rawTeachers, nuevoProfesor];
    this.calculateTeachersAndStudentsKpis();
    this.cdr.markForCheck();
  }

  /** Dar de baja un profesor */
  darDeBajaProfesor(teacher: TeacherRecord): void {
    this.rawTeachers = this.rawTeachers.filter(t => t.id !== teacher.id);
    this.calculateTeachersAndStudentsKpis();
    this.cdr.markForCheck();
  }

  handleEdit(item: any): void {
    console.log('Editar registro:', item);
  }

  handleDelete(item: any): void {
    console.log('Eliminar registro:', item);
    if (this.activeTab === 'profesores') {
      this.rawTeachers = this.rawTeachers.filter(t => t.id !== item.id);
      this.calculateTeachersAndStudentsKpis();
    } else if (this.activeTab === 'alumnos') {
      this.rawSqlStudents = this.rawSqlStudents.filter(s => s.id !== item.id);
      this.calculateTeachersAndStudentsKpis();
    } else {
      this.rawNoSqlSessions = this.rawNoSqlSessions.filter(s => s._id !== item._id);
      this.applyPeriodFilter();
      this.updateChartsData();
    }
  }

  handleView(item: any): void {
    console.log('Ver detalle:', item);
    if (this.activeTab === 'profesores') {
      this.viewTeacherPortal(item);
    }
  }
}
