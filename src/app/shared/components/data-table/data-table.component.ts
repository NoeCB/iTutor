import { 
  Component, 
  ChangeDetectionStrategy, 
  Input, 
  Output, 
  EventEmitter 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonCard, 
  IonBadge, 
  IonButton, 
  IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  createOutline, 
  trashOutline, 
  eyeOutline, 
  fileTrayOutline 
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
  imports: [CommonModule, IonCard, IonBadge, IonButton, IonIcon],
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
      fileTrayOutline
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
