import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MisClasesPage } from './mis-clases.page';

describe('MisClasesPage', () => {
  let component: MisClasesPage;
  let fixture: ComponentFixture<MisClasesPage>;

  beforeEach(async () => {
    // La página lee la sección activa desde ActivatedRoute (data.section),
    // por lo que necesita el router configurado en el entorno de pruebas.
    await TestBed.configureTestingModule({
      imports: [MisClasesPage],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MisClasesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
