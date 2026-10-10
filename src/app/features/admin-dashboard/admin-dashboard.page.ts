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
  IonBadge
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
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
  sparklesOutline 
} from 'ionicons/icons';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  DataService, 
  MongoClassSession, 
  SqlStudentRate 
} from '../../core/services/data.service';
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
    StatCardComponent,
    DataTableComponent
  ],
  providers: [CurrencyPipe, DatePipe]
})
export class AdminDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('revenueChartCanvas') revenueChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('classesChartCanvas') classesChartCanvas!: ElementRef<HTMLCanvasElement>;

  // Instancias de gráficos Chart.js
  private revenueChart: Chart | null = null;
  private classesChart: Chart | null = null;

  // Estado del Dashboard
  isLoading = true;
  selectedPeriod: 'todos' | 'septiembre' | 'octubre' | 'noviembre' | 'diciembre' = 'todos';

  // Datos brutos recuperados concurrentemente mediante forkJoin
  rawSqlStudents: SqlStudentRate[] = [];
  rawNoSqlSessions: MongoClassSession[] = [];

  // Datos filtrados reactivamente
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

  /** Columnas de la tabla agnóstica */
  tableColumns: TableColumn[] = [
    { key: 'estudianteNombre', label: 'Estudiante' },
    { key: 'materia', label: 'Asignatura (Rama)' },
    { key: 'tutor', label: 'Profesor Tutor' },
    { key: 'fecha', label: 'Fecha y Hora' },
    { key: 'importe', label: 'Tarifa', type: 'currency', align: 'right' },
    { 
      key: 'estado', 
      label: 'Estado', 
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
      sparklesOutline
    });
  }

  ngOnInit(): void {
    this.fetchConcurrentData();
  }

  ngAfterViewInit(): void {
    // Si los datos ya cargaron antes de la vista, inicializamos gráficos
    if (!this.isLoading) {
      this.initCharts();
    }
  }

  ngOnDestroy(): void {
    // Prevención de fugas de memoria destruyendo instancias de Chart.js
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
   * Consumo concurrente mediante DataService (forkJoin de SQL y NoSQL)
   */
  fetchConcurrentData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.dataService.getCombinedDashboardData().subscribe({
      next: (data) => {
        this.rawSqlStudents = data.catalogoSql;
        this.rawNoSqlSessions = data.sesionesNoSql;
        this.applyPeriodFilter();
        this.isLoading = false;
        this.cdr.markForCheck();

        // Renderizado inicial o actualización de gráficos
        setTimeout(() => {
          this.initOrUpdateCharts();
        }, 50);
      },
      error: (err) => {
        console.error('Error al consumir datos concurrentes del Dashboard:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Manejador del filtro dinámico en tiempo real (Segmentación por Periodo/Mes)
   */
  onFilterChange(period: any): void {
    this.selectedPeriod = period;
    this.applyPeriodFilter();
    this.updateChartsData();
    this.cdr.markForCheck();
  }

  /**
   * Filtrado en memoria y recálculo dinámico de estadísticas KPI
   */
  private applyPeriodFilter(): void {
    if (this.selectedPeriod === 'todos') {
      this.filteredSessions = [...this.rawNoSqlSessions];
    } else {
      this.filteredSessions = this.rawNoSqlSessions.filter(
        session => session.mes === this.selectedPeriod
      );
    }

    // Cálculo de KPIs
    const totalIngresos = this.filteredSessions
      .filter(s => s.estado !== 'Cancelada')
      .reduce((sum, s) => sum + s.importe, 0);

    const totalMinutos = this.filteredSessions
      .filter(s => s.estado !== 'Cancelada')
      .reduce((sum, s) => sum + s.duracionMin, 0);

    const alumnosUnicos = new Set(
      this.filteredSessions.map(s => s.estudianteId)
    ).size;

    const sesionesCompletadas = this.filteredSessions.filter(s => s.asistencia).length;
    const tasaAsistencia = this.filteredSessions.length > 0
      ? Math.round((sesionesCompletadas / this.filteredSessions.length) * 100)
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

  /**
   * Inicialización o actualización condicional de los gráficos de Chart.js
   */
  private initOrUpdateCharts(): void {
    if (!this.revenueChartCanvas || !this.classesChartCanvas) return;

    if (!this.revenueChart || !this.classesChart) {
      this.initCharts();
    } else {
      this.updateChartsData();
    }
  }

  /**
   * Creación de las instancias de Chart.js con estilo SaaS y alto contraste visual
   */
  private initCharts(): void {
    if (!this.revenueChartCanvas || !this.classesChartCanvas) return;

    // 1. Gráfico: "Ingresos por Asignatura" (Bar Chart)
    const revenueData = this.computeRevenueBySubject();
    this.revenueChart = new Chart(this.revenueChartCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: revenueData.labels,
        datasets: [{
          label: 'Ingresos (€)',
          data: revenueData.values,
          backgroundColor: [
            'rgba(37, 99, 235, 0.85)',   // Cobalto
            'rgba(99, 102, 241, 0.85)',  // Índigo
            'rgba(14, 165, 233, 0.85)',  // Azul cielo
            'rgba(16, 185, 129, 0.85)',  // Esmeralda
            'rgba(245, 158, 11, 0.85)',  // Ámbar
            'rgba(168, 85, 247, 0.85)'   // Violeta
          ],
          borderColor: [
            '#1d4ed8',
            '#4f46e5',
            '#0284c7',
            '#059669',
            '#d97706',
            '#9333ea'
          ],
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
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
            ticks: {
              callback: (value) => `${value} €`,
              font: { size: 11, weight: 'normal' },
              color: '#64748b'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#475569'
            }
          }
        }
      }
    });

    // 2. Gráfico: "Clases Impartidas: Física vs Matemáticas" (Line / Area Chart)
    const classesData = this.computeClassesByBranch();
    this.classesChart = new Chart(this.classesChartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: classesData.labels,
        datasets: [
          {
            label: 'Física',
            data: classesData.fisica,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4
          },
          {
            label: 'Matemáticas',
            data: classesData.matematicas,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#10b981',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { size: 12, weight: 600 },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: {
              stepSize: 1,
              font: { size: 11 },
              color: '#64748b'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: 500 },
              color: '#475569'
            }
          }
        }
      }
    });
  }

  /**
   * Actualiza los datos de los gráficos sin recargar la página
   */
  private updateChartsData(): void {
    if (!this.revenueChart || !this.classesChart) return;

    // Actualización de Gráfico 1 (Ingresos)
    const rev = this.computeRevenueBySubject();
    this.revenueChart.data.labels = rev.labels;
    this.revenueChart.data.datasets[0].data = rev.values;
    this.revenueChart.update('active');

    // Actualización de Gráfico 2 (Clases por Rama)
    const cls = this.computeClassesByBranch();
    this.classesChart.data.labels = cls.labels;
    this.classesChart.data.datasets[0].data = cls.fisica;
    this.classesChart.data.datasets[1].data = cls.matematicas;
    this.classesChart.update('active');
  }

  /**
   * Agrupa ingresos por materia según la selección actual
   */
  private computeRevenueBySubject(): { labels: string[]; values: number[] } {
    const revenueMap = new Map<string, number>();

    this.filteredSessions
      .filter(s => s.estado !== 'Cancelada')
      .forEach(s => {
        const current = revenueMap.get(s.materia) || 0;
        revenueMap.set(s.materia, current + s.importe);
      });

    return {
      labels: Array.from(revenueMap.keys()),
      values: Array.from(revenueMap.values())
    };
  }

  /**
   * Distribución de sesiones entre Física y Matemáticas
   */
  private computeClassesByBranch(): { labels: string[]; fisica: number[]; matematicas: number[] } {
    const meses = this.selectedPeriod === 'todos' 
      ? ['septiembre', 'octubre', 'noviembre', 'diciembre']
      : [this.selectedPeriod];

    const labels = meses.map(m => m.charAt(0).toUpperCase() + m.slice(1));
    const fisicaCounts: number[] = [];
    const matematicasCounts: number[] = [];

    meses.forEach(mes => {
      const sesMes = this.rawNoSqlSessions.filter(s => s.mes === mes && s.estado !== 'Cancelada');
      fisicaCounts.push(sesMes.filter(s => s.rama === 'Física').length);
      matematicasCounts.push(sesMes.filter(s => s.rama === 'Matemáticas').length);
    });

    return {
      labels,
      fisica: fisicaCounts,
      matematicas: matematicasCounts
    };
  }

  /* ==========================================================================
     EXPORTACIÓN ROBUSTA (CSV LIMPIO Y PDF CORPORATIVO)
     ========================================================================== */

  /**
   * Exporta las sesiones filtradas a un archivo CSV limpio con BOM UTF-8 (compatible con Excel)
   */
  exportToCsv(): void {
    if (this.filteredSessions.length === 0) {
      alert('No hay datos disponibles en el periodo seleccionado para exportar.');
      return;
    }

    const headers = [
      'ID Sesión',
      'Estudiante',
      'Asignatura',
      'Rama',
      'Profesor Tutor',
      'Fecha',
      'Duración (min)',
      'Tarifa (€)',
      'Estado',
      'Asistencia'
    ];

    const rows = this.filteredSessions.map(s => [
      `"${s._id}"`,
      `"${s.estudianteNombre}"`,
      `"${s.materia}"`,
      `"${s.rama}"`,
      `"${s.tutor}"`,
      `"${s.fecha}"`,
      s.duracionMin,
      s.importe,
      `"${s.estado}"`,
      s.asistencia ? '"Presente"' : '"Ausente"'
    ]);

    // Ensamblado con punto y coma para compatibilidad internacional y Excel europeo
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n');

    // Añadimos BOM UTF-8 (\uFEFF) para garantizar visualización de tildes y caracteres especiales
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `TutorFlow_Reporte_${this.selectedPeriod}_${timestamp}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Genera un informe PDF con diseño institucional y tabla tipográfica mediante jsPDF y jspdf-autotable
   */
  exportToPdf(): void {
    if (this.filteredSessions.length === 0) {
      alert('No hay datos para generar el PDF.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor: [number, number, number] = [37, 99, 235]; // Azul Cobalto #2563eb
    const darkColor: [number, number, number] = [15, 23, 42];      // Slate 900 #0f172a
    const grayColor: [number, number, number] = [100, 116, 139];  // Slate 500 #64748b

    // 1. BANNER INSTITUCIONAL DE CABECERA
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 297, 24, 'F');

    // Logotipo y Marca
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('TutorFlow', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Academia de Ciencias: Matemáticas & Física • Informe Oficial de Auditoría', 56, 14);

    // 2. METADATOS DEL REPORTE
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Informe de Gestión Académica y Financiera`, 14, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    const fechaExpedicion = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Fecha de expedición: ${fechaExpedicion}`, 14, 40);
    doc.text(`Periodo analizado: ${this.selectedPeriod.toUpperCase()} | Total registros: ${this.filteredSessions.length}`, 14, 45);

    // Resumen Ejecutivo en Bloques
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(190, 28, 93, 20, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('INGRESOS DEL PERIODO', 194, 34);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(this.kpis.ingresosTotales, 194, 42);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text('HORAS IMPARTIDAS', 248, 34);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text(this.kpis.horasImpartidas, 248, 42);

    // 3. TABLA DE DATOS FORMATADA CON AUTO-TABLE
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
      startY: 52,
      head: [[
        'Estudiante',
        'Asignatura',
        'Rama',
        'Profesor Tutor',
        'Fecha y Hora',
        'Duración',
        'Importe',
        'Estado',
        'Asistió'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 36 },
        4: { cellWidth: 32 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 24 },
        8: { halign: 'center', cellWidth: 16 }
      },
      margin: { left: 14, right: 14 }
    });

    // 4. PIE DE PÁGINA INSTITUCIONAL
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `TutorFlow PWA • Documento confidencial generado automáticamente • Página ${i} de ${totalPages}`,
        14,
        202
      );
    }

    // Descarga del PDF
    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`TutorFlow_Informe_${this.selectedPeriod}_${timestamp}.pdf`);
  }

  // Manejadores de eventos de la tabla agnóstica
  handleEdit(item: any): void {
    console.log('Editar tutoría:', item);
  }

  handleDelete(item: any): void {
    console.log('Eliminar tutoría:', item);
    this.rawNoSqlSessions = this.rawNoSqlSessions.filter(s => s._id !== item._id);
    this.applyPeriodFilter();
    this.updateChartsData();
  }

  handleView(item: any): void {
    console.log('Ver detalle de tutoría:', item);
  }
}
