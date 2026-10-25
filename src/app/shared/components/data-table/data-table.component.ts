import { 
  Component, 
  ChangeDetectionStrategy, 
  Input, 
  Output, 
  EventEmitter 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonCard } from '@ionic/angular/ion-card';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { addIcons } from 'ionicons';
import { 
  createOutline, 
  trashOutline, 
  eyeOutline, 
  fileTrayOutline,
  searchOutline
} from 'ionicons/icons';

export interface TableColumn {
  /** Clave de la propiedad en el objeto de datos */
  key: string;
  /** Título visible de la cabecera */
  label: string;
  /** Tipo de celda para formateo visual */
  type?: 'text' | 'badge' | 'currency' | 'date';
  /** Alineación del contenido */
  align?: 'left' | 'center' | 'right';
  /** Mapeo de valores a clases o variantes de color para badges */
  badgeColorMap?: Record<string, string>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, IonCard, IonBadge, IonButton, IonIcon],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent {
  /** Definición de las columnas */
  @Input({ required: true }) columns: TableColumn[] = [];

  /** Filas de datos a mostrar */
  @Input() set rows(value: any[]) {
    this._rows = value || [];
  }
  get rows(): any[] {
    return this._rows;
  }
  private _rows: any[] = [];

  /** Término de búsqueda reactivo del buscador integrado (Paso 2.1) */
  searchTerm: string = '';

  /** Filas filtradas según el buscador de la tabla */
  get displayedRows(): any[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this._rows;
    }
    return this._rows.filter(row =>
      this.columns.some(col =>
        String(row[col.key] ?? '').toLowerCase().includes(query)
      )
    );
  }

  /** Título de la tabla */
  @Input() title?: string;

  /** Subtítulo descriptivo */
  @Input() subtitle?: string;

  /** Mensaje cuando no hay registros */
  @Input() emptyMessage: string = 'No hay datos registrados en este momento.';

  /** Habilitar columna de acciones */
  @Input() showActions: boolean = true;

  /** Eventos emitidos hacia el componente padre */
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onEdit = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onDelete = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onView = new EventEmitter<any>();

  constructor() {
    addIcons({
      createOutline,
      trashOutline,
      eyeOutline,
      fileTrayOutline,
      searchOutline
    });
  }

  handleEdit(row: any): void {
    this.onEdit.emit(row);
  }

  handleDelete(row: any): void {
    this.onDelete.emit(row);
  }

  handleView(row: any): void {
    this.onView.emit(row);
  }

  getBadgeColor(column: TableColumn, value: any): string {
    if (column.badgeColorMap && column.badgeColorMap[value]) {
      return column.badgeColorMap[value];
    }
    return 'medium';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
