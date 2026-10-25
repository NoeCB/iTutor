import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent, TableColumn } from './data-table.component';

/**
 * Pruebas unitarias del componente reutilizable de tabla (RA 3).
 *
 * Verifican que el componente es agnóstico respecto a la vista que lo
 * contiene: recibe su configuración por `@Input`, filtra internamente y
 * notifica las interacciones al componente padre mediante `@Output`.
 */
describe('DataTableComponent', () => {
  let component: DataTableComponent;
  let fixture: ComponentFixture<DataTableComponent>;

  const columnas: TableColumn[] = [
    { key: 'estudianteNombre', label: 'Estudiante' },
    { key: 'materia', label: 'Asignatura' },
    { key: 'importe', label: 'Importe', type: 'currency', align: 'right' },
    {
      key: 'estado',
      label: 'Estado',
      type: 'badge',
      badgeColorMap: { Confirmada: 'success', Cancelada: 'danger' }
    }
  ];

  const filas = [
    { estudianteNombre: 'Marcos Vega Ortiz', materia: 'Física Clásica', importe: 45, estado: 'Confirmada' },
    { estudianteNombre: 'Lucía Hernanz Sanz', materia: 'Cálculo Multivariable', importe: 52.5, estado: 'Cancelada' },
    { estudianteNombre: 'Clara Morales Ibáñez', materia: 'Ecuaciones Diferenciales', importe: 30, estado: 'Confirmada' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent);
    component = fixture.componentInstance;
    component.columns = columnas;
    component.rows = filas;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('Recepción de datos por @Input', () => {
    it('debe mostrar todas las filas recibidas cuando no hay búsqueda', () => {
      expect(component.displayedRows.length).toBe(3);
    });

    it('debe tolerar un valor nulo en las filas sin romperse', () => {
      component.rows = null as unknown as unknown[];

      expect(component.rows).toEqual([]);
      expect(component.displayedRows).toEqual([]);
    });
  });

  describe('Buscador integrado', () => {
    it('debe filtrar por cualquier columna visible', () => {
      component.searchTerm = 'Ecuaciones';

      expect(component.displayedRows.length).toBe(1);
      expect(component.displayedRows[0].estudianteNombre).toBe('Clara Morales Ibáñez');
    });

    it('debe ser insensible a mayúsculas y minúsculas', () => {
      component.searchTerm = 'mARCOS';

      expect(component.displayedRows.length).toBe(1);
    });

    it('debe ignorar los espacios sobrantes del término buscado', () => {
      component.searchTerm = '   Física   ';

      expect(component.displayedRows.length).toBe(1);
    });

    it('debe devolver una lista vacía si nada coincide', () => {
      component.searchTerm = 'asignatura-inexistente';

      expect(component.displayedRows.length).toBe(0);
    });

    it('debe restaurar el listado completo al limpiar la búsqueda', () => {
      component.searchTerm = 'Física';
      expect(component.displayedRows.length).toBe(1);

      component.searchTerm = '';

      expect(component.displayedRows.length).toBe(3);
    });
  });

  describe('Emisión de eventos al componente padre (@Output)', () => {
    it('debe emitir la fila al solicitar su edición', () => {
      let recibida: unknown = null;
      component.onEdit.subscribe((fila: unknown) => (recibida = fila));

      component.handleEdit(filas[0]);

      expect(recibida).toEqual(filas[0]);
    });

    it('debe emitir la fila al solicitar su borrado', () => {
      let recibida: unknown = null;
      component.onDelete.subscribe((fila: unknown) => (recibida = fila));

      component.handleDelete(filas[1]);

      expect(recibida).toEqual(filas[1]);
    });

    it('debe emitir la fila al solicitar su detalle', () => {
      let recibida: unknown = null;
      component.onView.subscribe((fila: unknown) => (recibida = fila));

      component.handleView(filas[2]);

      expect(recibida).toEqual(filas[2]);
    });
  });

  describe('Formateo visual de celdas', () => {
    it('debe resolver el color del badge según el mapa recibido', () => {
      const columnaEstado = columnas[3];

      expect(component.getBadgeColor(columnaEstado, 'Confirmada')).toBe('success');
      expect(component.getBadgeColor(columnaEstado, 'Cancelada')).toBe('danger');
    });

    it('debe usar el color neutro para un valor no mapeado', () => {
      expect(component.getBadgeColor(columnas[3], 'Desconocido')).toBe('medium');
    });
  });
});
