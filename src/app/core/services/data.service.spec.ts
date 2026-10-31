import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';

/**
 * Pruebas unitarias del servicio de datos (RA 5).
 *
 * Verifican la orquestación concurrente de las dos fuentes heterogéneas
 * (catálogo relacional SQL y colección documental NoSQL) y los cálculos
 * de agregación que alimentan el cuadro de mando y los informes.
 */
describe('DataService', () => {
  let service: DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('Consumo asíncrono de las fuentes de datos', () => {
    it('debe recuperar el catálogo de alumnos (SQL)', async () => {
      const alumnos = await firstValueFrom(service.getSqlStudentsCatalog());

      expect(alumnos.length).toBeGreaterThan(0);
      expect(alumnos[0].nombre).toBeTruthy();
    });

    it('debe recuperar el catálogo de profesores (SQL)', async () => {
      const profesores = await firstValueFrom(service.getTeachersCatalog());

      expect(profesores.length).toBeGreaterThan(0);
      expect(profesores[0].especialidad).toBeTruthy();
    });

    it('debe recuperar las sesiones documentales (NoSQL)', async () => {
      const sesiones = await firstValueFrom(service.getMongoSessionsStream());

      expect(sesiones.length).toBeGreaterThan(0);
      expect(sesiones[0]._id).toBeTruthy();
    });
  });

  describe('getCombinedDashboardData() - orquestación con forkJoin', () => {
    it('debe combinar las tres fuentes en una única emisión', async () => {
      const datos = await firstValueFrom(service.getCombinedDashboardData());

      expect(datos.catalogoSql.length).toBeGreaterThan(0);
      expect(datos.profesoresSql.length).toBeGreaterThan(0);
      expect(datos.sesionesNoSql.length).toBeGreaterThan(0);
    });

    it('debe sellar la respuesta con una marca temporal válida', async () => {
      const datos = await firstValueFrom(service.getCombinedDashboardData());

      expect(Number.isNaN(Date.parse(datos.timestamp))).toBe(false);
    });

    it('debe resolver en paralelo, no en serie (prueba de concurrencia)', async () => {
      const inicio = Date.now();
      await firstValueFrom(service.getCombinedDashboardData());
      const transcurrido = Date.now() - inicio;

      // Los retardos simulados son 350 + 350 + 400 ms. En serie superarían
      // los 1000 ms; con forkJoin deben solaparse y quedar muy por debajo.
      expect(transcurrido).toBeLessThan(900);
    });
  });

  describe('getTeacherPortalData() - agregación por profesor', () => {
    it('debe devolver los datos del profesor solicitado por email', async () => {
      const portal = await firstValueFrom(
        service.getTeacherPortalData('elenaramos@itutor.es')
      );

      expect(portal.teacher?.nombre).toContain('Elena Ramos');
    });

    it('debe excluir las sesiones canceladas del total facturado', async () => {
      const portal = await firstValueFrom(
        service.getTeacherPortalData('elenaramos@itutor.es')
      );

      const esperado = portal.sessions
        .filter(s => s.estado !== 'Cancelada')
        .reduce((suma, s) => suma + s.importe, 0);

      expect(portal.totalEarned).toBe(esperado);
    });

    it('debe calcular las horas impartidas a partir de los minutos', async () => {
      const portal = await firstValueFrom(
        service.getTeacherPortalData('elenaramos@itutor.es')
      );

      const minutos = portal.sessions.reduce((suma, s) => suma + s.duracionMin, 0);

      expect(portal.hoursCount).toBe(Math.round(minutos / 60));
    });

    it('NO debe mostrar los datos de otro profesor si la búsqueda no coincide', async () => {
      const portal = await firstValueFrom(
        service.getTeacherPortalData('no-existe@itutor.es')
      );

      expect(portal.teacher).toBeNull();
      expect(portal.students).toEqual([]);
      expect(portal.sessions).toEqual([]);
      expect(portal.totalEarned).toBe(0);
    });

    it('un email parcial no debe coincidir con el nombre de otro profesor', async () => {
      const portal = await firstValueFrom(service.getTeacherPortalData('elena@otro.es'));

      expect(portal.teacher).toBeNull();
    });
  });
});
