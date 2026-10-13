import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboardPage } from './admin-dashboard.page';

describe('AdminDashboardPage', () => {
  let component: AdminDashboardPage;
  let fixture: ComponentFixture<AdminDashboardPage>;

  beforeEach(async () => {
    // La página inyecta ActivatedRoute (ion-menu-button + routerLink),
    // por lo que es imprescindible proveer el router en el entorno de pruebas.
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debe arrancar con el periodo "todos" seleccionado', () => {
    expect(component.selectedPeriod).toBe('todos');
  });

  it('debe definir las columnas de la tabla de sesiones', () => {
    expect(component.tableColumns.length).toBeGreaterThan(0);
    const claves = component.tableColumns.map(c => c.key);
    expect(claves).toContain('estudianteNombre');
    expect(claves).toContain('importe');
  });
});
