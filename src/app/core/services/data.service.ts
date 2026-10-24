import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

/** Interfaz representativa de entidad en base de datos relacional (SQL / PostgreSQL) */
export interface SqlStudentRate {
  id: number;
  nombre: string;
  email: string;
  matricula: string;
  tarifaHora: number;
  plan: 'Básico' | 'Intensivo' | 'Premium';
  asignaturaPrincipal: string;
  profesorAsignado: string;
  saldoPendiente: number;
  horasTotales: number;
  telefono: string;
  estado: 'Al día' | 'Pendiente' | 'Activo';
}

/** Interfaz representativa de entidad Profesor en el sistema iTUTOR */
export interface TeacherRecord {
  id: number;
  nombre: string;
  email: string;
  especialidad: string;
  departamento: 'Física' | 'Matemáticas' | 'Química';
  tarifaHora: number;
  alumnosAsignados: string[];
  alumnosCount: number;
  horasImpartidas: number;
  totalGanado: number;
  calificacion: number;
  telefono: string;
  estado: 'Activo' | 'Disponible';
}

/** Interfaz representativa de colección documental en NoSQL (MongoDB) */
export interface MongoClassSession {
  _id: string;
  estudianteId: number;
  estudianteNombre: string;
  materia: string;
  rama: 'Física' | 'Matemáticas' | 'Química';
  tutor: string;
  fecha: string;
  mes: 'septiembre' | 'octubre' | 'noviembre' | 'diciembre';
  duracionMin: number;
  importe: number;
  estado: 'Confirmada' | 'En Curso' | 'Pendiente' | 'Cancelada';
  asistencia: boolean;
  notasSeguimiento: string;
}

/** Agregación combinada para el Dashboard */
export interface CombinedDashboardData {
  catalogoSql: SqlStudentRate[];
  profesoresSql: TeacherRecord[];
  sesionesNoSql: MongoClassSession[];
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {

  /** Base de datos: Catálogo oficial de 10 Alumnos registrados */
  private readonly STUDENTS_CATALOG: SqlStudentRate[] = [
    {
      id: 101,
      nombre: 'Marcos Vega Ortiz',
      email: 'marcosvega@itutor.es',
      matricula: 'MAT-2026-041',
      tarifaHora: 30,
      plan: 'Intensivo',
      asignaturaPrincipal: 'Física Clásica & Mecánica',
      profesorAsignado: 'Dra. Elena Ramos',
      saldoPendiente: 0,
      horasTotales: 18,
      telefono: '+34 600 111 222',
      estado: 'Al día'
    },
    {
      id: 102,
      nombre: 'Lucía Hernanz Sanz',
      email: 'luciahernanz@itutor.es',
      matricula: 'MAT-2026-089',
      tarifaHora: 35,
      plan: 'Premium',
      asignaturaPrincipal: 'Cálculo Multivariable II',
      profesorAsignado: 'Prof. Carlos Méndez',
      saldoPendiente: 70,
      horasTotales: 22,
      telefono: '+34 600 222 333',
      estado: 'Pendiente'
    },
    {
      id: 103,
      nombre: 'Alejandro Gómez Soto',
      email: 'alejandrogomez@itutor.es',
      matricula: 'MAT-2026-112',
      tarifaHora: 30,
      plan: 'Intensivo',
      asignaturaPrincipal: 'Termodinámica & Fluidos',
      profesorAsignado: 'Dr. Miguel Ángel Santos',
      saldoPendiente: 0,
      horasTotales: 15,
      telefono: '+34 600 333 444',
      estado: 'Al día'
    },
    {
      id: 104,
      nombre: 'Sofía Navarro Cruz',
      email: 'sofianavarro@itutor.es',
      matricula: 'MAT-2026-135',
      tarifaHora: 25,
      plan: 'Básico',
      asignaturaPrincipal: 'Álgebra Lineal & Matrices',
      profesorAsignado: 'Prof. Carlos Méndez',
      saldoPendiente: 40,
      horasTotales: 12,
      telefono: '+34 600 444 555',
      estado: 'Pendiente'
    },
    {
      id: 105,
      nombre: 'Javier Domínguez Rey',
      email: 'javierdominguez@itutor.es',
      matricula: 'MAT-2026-180',
      tarifaHora: 35,
      plan: 'Premium',
      asignaturaPrincipal: 'Electromagnetismo Avanzado',
      profesorAsignado: 'Dr. Fernando Alonso',
      saldoPendiente: 110,
      horasTotales: 20,
      telefono: '+34 600 555 666',
      estado: 'Pendiente'
    },
    {
      id: 106,
      nombre: 'Clara Morales Ibáñez',
      email: 'claramorales@itutor.es',
      matricula: 'MAT-2026-204',
      tarifaHora: 30,
      plan: 'Intensivo',
      asignaturaPrincipal: 'Ecuaciones Diferenciales',
      profesorAsignado: 'Prof. Roberto Gil',
      saldoPendiente: 0,
      horasTotales: 16,
      telefono: '+34 600 666 777',
      estado: 'Al día'
    },
    {
      id: 107,
      nombre: 'David Romero Pascual',
      email: 'davidromero@itutor.es',
      matricula: 'MAT-2026-228',
      tarifaHora: 28,
      plan: 'Básico',
      asignaturaPrincipal: 'Química Aplicada e Ingeniería',
      profesorAsignado: 'Prof. Laura Vicente',
      saldoPendiente: 56,
      horasTotales: 10,
      telefono: '+34 600 777 888',
      estado: 'Pendiente'
    },
    {
      id: 108,
      nombre: 'Elena Ruiz Gallego',
      email: 'elenaruiz@itutor.es',
      matricula: 'MAT-2026-253',
      tarifaHora: 32,
      plan: 'Premium',
      asignaturaPrincipal: 'Estadística & Análisis Numérico',
      profesorAsignado: 'Dra. Carmen Delgado',
      saldoPendiente: 0,
      horasTotales: 24,
      telefono: '+34 600 888 999',
      estado: 'Al día'
    },
    {
      id: 109,
      nombre: 'Adrián Torres Molina',
      email: 'adriantorres@itutor.es',
      matricula: 'MAT-2026-279',
      tarifaHora: 38,
      plan: 'Intensivo',
      asignaturaPrincipal: 'Mecánica Cuántica & Partículas',
      profesorAsignado: 'Dra. Natalia Molina',
      saldoPendiente: 76,
      horasTotales: 14,
      telefono: '+34 600 999 000',
      estado: 'Pendiente'
    },
    {
      id: 110,
      nombre: 'Paula García Serrano',
      email: 'paulagarcia@itutor.es',
      matricula: 'MAT-2026-301',
      tarifaHora: 35,
      plan: 'Premium',
      asignaturaPrincipal: 'Astrofísica & Cinemática',
      profesorAsignado: 'Dra. Elena Ramos',
      saldoPendiente: 0,
      horasTotales: 26,
      telefono: '+34 611 000 111',
      estado: 'Al día'
    }
  ];

  /** Base de datos: Catálogo oficial de 10 Profesores registrados */
  private readonly TEACHERS_CATALOG: TeacherRecord[] = [
    {
      id: 201,
      nombre: 'Dra. Elena Ramos',
      email: 'elenaramos@itutor.es',
      especialidad: 'Física Teórica & Mecánica Clásica',
      departamento: 'Física',
      tarifaHora: 35,
      alumnosAsignados: ['Marcos Vega Ortiz', 'Paula García Serrano'],
      alumnosCount: 2,
      horasImpartidas: 44,
      totalGanado: 1540,
      calificacion: 4.9,
      telefono: '+34 611 223 344',
      estado: 'Activo'
    },
    {
      id: 202,
      nombre: 'Prof. Carlos Méndez',
      email: 'carlosmendez@itutor.es',
      especialidad: 'Cálculo Multivariable & Álgebra Lineal',
      departamento: 'Matemáticas',
      tarifaHora: 35,
      alumnosAsignados: ['Lucía Hernanz Sanz', 'Sofía Navarro Cruz'],
      alumnosCount: 2,
      horasImpartidas: 34,
      totalGanado: 1190,
      calificacion: 4.8,
      telefono: '+34 622 334 455',
      estado: 'Activo'
    },
    {
      id: 203,
      nombre: 'Dr. Miguel Ángel Santos',
      email: 'miguelsantos@itutor.es',
      especialidad: 'Termodinámica & Mecánica de Fluidos',
      departamento: 'Física',
      tarifaHora: 30,
      alumnosAsignados: ['Alejandro Gómez Soto'],
      alumnosCount: 1,
      horasImpartidas: 15,
      totalGanado: 450,
      calificacion: 4.9,
      telefono: '+34 633 445 566',
      estado: 'Activo'
    },
    {
      id: 204,
      nombre: 'Prof. Laura Vicente',
      email: 'lauravicente@itutor.es',
      especialidad: 'Química Aplicada e Ingeniería de Materiales',
      departamento: 'Química',
      tarifaHora: 28,
      alumnosAsignados: ['David Romero Pascual'],
      alumnosCount: 1,
      horasImpartidas: 10,
      totalGanado: 280,
      calificacion: 4.7,
      telefono: '+34 644 556 677',
      estado: 'Activo'
    },
    {
      id: 205,
      nombre: 'Dr. Fernando Alonso',
      email: 'fernandoalonso@itutor.es',
      especialidad: 'Electromagnetismo Avanzado & Circuitos',
      departamento: 'Física',
      tarifaHora: 35,
      alumnosAsignados: ['Javier Domínguez Rey'],
      alumnosCount: 1,
      horasImpartidas: 20,
      totalGanado: 700,
      calificacion: 4.9,
      telefono: '+34 655 667 788',
      estado: 'Activo'
    },
    {
      id: 206,
      nombre: 'Dra. Carmen Delgado',
      email: 'carmendelgado@itutor.es',
      especialidad: 'Estadística Aplicada & Probabilidad Bayesiana',
      departamento: 'Matemáticas',
      tarifaHora: 32,
      alumnosAsignados: ['Elena Ruiz Gallego'],
      alumnosCount: 1,
      horasImpartidas: 24,
      totalGanado: 768,
      calificacion: 4.8,
      telefono: '+34 666 778 899',
      estado: 'Activo'
    },
    {
      id: 207,
      nombre: 'Prof. Roberto Gil',
      email: 'robertogil@itutor.es',
      especialidad: 'Ecuaciones Diferenciales & Modelos Físicos',
      departamento: 'Matemáticas',
      tarifaHora: 30,
      alumnosAsignados: ['Clara Morales Ibáñez'],
      alumnosCount: 1,
      horasImpartidas: 16,
      totalGanado: 480,
      calificacion: 4.6,
      telefono: '+34 677 889 900',
      estado: 'Activo'
    },
    {
      id: 208,
      nombre: 'Dra. Natalia Molina',
      email: 'nataliamolina@itutor.es',
      especialidad: 'Física Cuántica & Partículas Subatómicas',
      departamento: 'Física',
      tarifaHora: 38,
      alumnosAsignados: ['Adrián Torres Molina'],
      alumnosCount: 1,
      horasImpartidas: 14,
      totalGanado: 532,
      calificacion: 5.0,
      telefono: '+34 688 990 011',
      estado: 'Activo'
    },
    {
      id: 209,
      nombre: 'Prof. Jorge Herrera',
      email: 'jorgeherrera@itutor.es',
      especialidad: 'Geometría Diferencial & Topología Espacial',
      departamento: 'Matemáticas',
      tarifaHora: 30,
      alumnosAsignados: ['Lucía Hernanz Sanz'],
      alumnosCount: 1,
      horasImpartidas: 12,
      totalGanado: 360,
      calificacion: 4.7,
      telefono: '+34 699 001 122',
      estado: 'Disponible'
    },
    {
      id: 210,
      nombre: 'Dra. Patricia Serrano',
      email: 'patriciaserrano@itutor.es',
      especialidad: 'Astrofísica, Óptica & Ondas Gravitacionales',
      departamento: 'Física',
      tarifaHora: 36,
      alumnosAsignados: ['Paula García Serrano'],
      alumnosCount: 1,
      horasImpartidas: 18,
      totalGanado: 648,
      calificacion: 4.9,
      telefono: '+34 610 112 233',
      estado: 'Activo'
    }
  ];

  /** Base de datos: Histórico de Sesiones en MongoDB Atlas */
  private readonly SESSIONS_COLLECTION: MongoClassSession[] = [
    // Septiembre
    {
      _id: '654a1f9e2b1c8a001a111101',
      estudianteId: 101,
      estudianteNombre: 'Marcos Vega Ortiz',
      materia: 'Física Clásica',
      rama: 'Física',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-09-18 16:30',
      mes: 'septiembre',
      duracionMin: 90,
      importe: 45,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Repaso de leyes de Newton y momento lineal.'
    },
    {
      _id: '654a1f9e2b1c8a001a111102',
      estudianteId: 102,
      estudianteNombre: 'Lucía Hernanz Sanz',
      materia: 'Cálculo Multivariable',
      rama: 'Matemáticas',
      tutor: 'Prof. Carlos Méndez',
      fecha: '2026-09-22 18:00',
      mes: 'septiembre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Integrales dobles sobre regiones generales.'
    },
    {
      _id: '654a1f9e2b1c8a001a111103',
      estudianteId: 104,
      estudianteNombre: 'Sofía Navarro Cruz',
      materia: 'Álgebra Lineal',
      rama: 'Matemáticas',
      tutor: 'Prof. Carlos Méndez',
      fecha: '2026-09-25 17:00',
      mes: 'septiembre',
      duracionMin: 60,
      importe: 25,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Diagonalización y valores propios.'
    },
    {
      _id: '654a1f9e2b1c8a001a111120',
      estudianteId: 110,
      estudianteNombre: 'Paula García Serrano',
      materia: 'Astrofísica & Cinemática',
      rama: 'Física',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-09-28 17:00',
      mes: 'septiembre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Introducción a mecánica celeste y gravedad newtoniana.'
    },

    // Octubre
    {
      _id: '654a1f9e2b1c8a001a111104',
      estudianteId: 101,
      estudianteNombre: 'Marcos Vega Ortiz',
      materia: 'Física Clásica',
      rama: 'Física',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-10-02 16:30',
      mes: 'octubre',
      duracionMin: 90,
      importe: 45,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Oscilaciones armónicas simples y amortiguadas.'
    },
    {
      _id: '654a1f9e2b1c8a001a111105',
      estudianteId: 102,
      estudianteNombre: 'Lucía Hernanz Sanz',
      materia: 'Cálculo Multivariable',
      rama: 'Matemáticas',
      tutor: 'Prof. Carlos Méndez',
      fecha: '2026-10-05 18:00',
      mes: 'octubre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'En Curso',
      asistencia: true,
      notasSeguimiento: 'Teorema de Green y campos vectoriales conservativos.'
    },
    {
      _id: '654a1f9e2b1c8a001a111106',
      estudianteId: 103,
      estudianteNombre: 'Alejandro Gómez Soto',
      materia: 'Termodinámica',
      rama: 'Física',
      tutor: 'Dr. Miguel Ángel Santos',
      fecha: '2026-10-06 10:00',
      mes: 'octubre',
      duracionMin: 90,
      importe: 45,
      estado: 'Pendiente',
      asistencia: false,
      notasSeguimiento: 'Ciclos de Carnot y entropía de gases ideales.'
    },
    {
      _id: '654a1f9e2b1c8a001a111107',
      estudianteId: 105,
      estudianteNombre: 'Javier Domínguez Rey',
      materia: 'Electromagnetismo',
      rama: 'Física',
      tutor: 'Dr. Fernando Alonso',
      fecha: '2026-10-08 17:00',
      mes: 'octubre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Cancelada',
      asistencia: false,
      notasSeguimiento: 'Cancelado por estudiante. Reagendar Ley de Gauss.'
    },
    {
      _id: '654a1f9e2b1c8a001a111108',
      estudianteId: 106,
      estudianteNombre: 'Clara Morales Ibáñez',
      materia: 'Ecuaciones Diferenciales',
      rama: 'Matemáticas',
      tutor: 'Prof. Roberto Gil',
      fecha: '2026-10-09 11:00',
      mes: 'octubre',
      duracionMin: 60,
      importe: 30,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Transformada de Laplace aplicada a sistemas RLC.'
    },
    {
      _id: '654a1f9e2b1c8a001a111121',
      estudianteId: 110,
      estudianteNombre: 'Paula García Serrano',
      materia: 'Ecuaciones Diferenciales',
      rama: 'Matemáticas',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-10-10 10:00',
      mes: 'octubre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Resolución de ecuaciones de orden superior homogéneas.'
    },
    {
      _id: '654a1f9e2b1c8a001a111122',
      estudianteId: 107,
      estudianteNombre: 'David Romero Pascual',
      materia: 'Química Aplicada',
      rama: 'Química',
      tutor: 'Prof. Laura Vicente',
      fecha: '2026-10-14 16:00',
      mes: 'octubre',
      duracionMin: 60,
      importe: 28,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Estequiometría de reacciones y rendimientos reales.'
    },
    {
      _id: '654a1f9e2b1c8a001a111123',
      estudianteId: 108,
      estudianteNombre: 'Elena Ruiz Gallego',
      materia: 'Estadística & Probabilidad',
      rama: 'Matemáticas',
      tutor: 'Dra. Carmen Delgado',
      fecha: '2026-10-18 12:00',
      mes: 'octubre',
      duracionMin: 90,
      importe: 48,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Distribuciones continuas: Normal, Student y Chi-cuadrado.'
    },
    {
      _id: '654a1f9e2b1c8a001a111124',
      estudianteId: 109,
      estudianteNombre: 'Adrián Torres Molina',
      materia: 'Mecánica Cuántica',
      rama: 'Física',
      tutor: 'Dra. Natalia Molina',
      fecha: '2026-10-22 17:30',
      mes: 'octubre',
      duracionMin: 90,
      importe: 57,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Ecuación de Schrödinger independiente del tiempo.'
    },

    // Noviembre
    {
      _id: '654a1f9e2b1c8a001a111109',
      estudianteId: 103,
      estudianteNombre: 'Alejandro Gómez Soto',
      materia: 'Termodinámica',
      rama: 'Física',
      tutor: 'Dr. Miguel Ángel Santos',
      fecha: '2026-11-03 10:00',
      mes: 'noviembre',
      duracionMin: 90,
      importe: 45,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Ecuación de estado de Van der Waals.'
    },
    {
      _id: '654a1f9e2b1c8a001a111110',
      estudianteId: 104,
      estudianteNombre: 'Sofía Navarro Cruz',
      materia: 'Álgebra Lineal',
      rama: 'Matemáticas',
      tutor: 'Prof. Carlos Méndez',
      fecha: '2026-11-05 12:00',
      mes: 'noviembre',
      duracionMin: 60,
      importe: 25,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Descomposición en valores singulares (SVD).'
    },
    {
      _id: '654a1f9e2b1c8a001a111111',
      estudianteId: 105,
      estudianteNombre: 'Javier Domínguez Rey',
      materia: 'Electromagnetismo',
      rama: 'Física',
      tutor: 'Dr. Fernando Alonso',
      fecha: '2026-11-12 17:00',
      mes: 'noviembre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Ecuaciones de Maxwell en medios dieléctricos.'
    },
    {
      _id: '654a1f9e2b1c8a001a111125',
      estudianteId: 110,
      estudianteNombre: 'Paula García Serrano',
      materia: 'Astrofísica & Cinemática',
      rama: 'Física',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-11-15 17:00',
      mes: 'noviembre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Órbitas elípticas y leyes de Kepler.'
    },
    {
      _id: '654a1f9e2b1c8a001a111126',
      estudianteId: 102,
      estudianteNombre: 'Lucía Hernanz Sanz',
      materia: 'Geometría Diferencial',
      rama: 'Matemáticas',
      tutor: 'Prof. Jorge Herrera',
      fecha: '2026-11-20 18:30',
      mes: 'noviembre',
      duracionMin: 60,
      importe: 30,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Curvatura gaussiana y geodésicas en superficies.'
    },

    // Diciembre
    {
      _id: '654a1f9e2b1c8a001a111112',
      estudianteId: 101,
      estudianteNombre: 'Marcos Vega Ortiz',
      materia: 'Física Clásica',
      rama: 'Física',
      tutor: 'Dra. Elena Ramos',
      fecha: '2026-12-02 16:30',
      mes: 'diciembre',
      duracionMin: 90,
      importe: 45,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Preparación examen final de Mecánica Teórica.'
    },
    {
      _id: '654a1f9e2b1c8a001a111113',
      estudianteId: 102,
      estudianteNombre: 'Lucía Hernanz Sanz',
      materia: 'Cálculo Multivariable',
      rama: 'Matemáticas',
      tutor: 'Prof. Carlos Méndez',
      fecha: '2026-12-04 18:00',
      mes: 'diciembre',
      duracionMin: 90,
      importe: 52.5,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Teorema de Stokes y cálculo de flujo.'
    },
    {
      _id: '654a1f9e2b1c8a001a111127',
      estudianteId: 110,
      estudianteNombre: 'Paula García Serrano',
      materia: 'Óptica & Ondas',
      rama: 'Física',
      tutor: 'Dra. Patricia Serrano',
      fecha: '2026-12-10 11:30',
      mes: 'diciembre',
      duracionMin: 90,
      importe: 54,
      estado: 'Confirmada',
      asistencia: true,
      notasSeguimiento: 'Interferencias, difracción y redes ópticas.'
    }
  ];

  constructor() {}

  /**
   * Simula consulta a API Backend conectada a SQL (PostgreSQL/MySQL).
   * Recupera catálogo maestro de los 10 alumnos, tarifas horarias y profesores asignados.
   */
  getSqlStudentsCatalog(): Observable<SqlStudentRate[]> {
    return of(this.STUDENTS_CATALOG).pipe(delay(350));
  }

  /**
   * Simula consulta a API Backend conectada a SQL.
   * Recupera catálogo maestro de los 10 profesores de iTUTOR con balance y horas.
   */
  getTeachersCatalog(): Observable<TeacherRecord[]> {
    return of(this.TEACHERS_CATALOG).pipe(delay(350));
  }

  /**
   * Simula consulta a API Backend conectada a NoSQL (MongoDB Atlas).
   * Recupera histórico y sesiones de tutoría en tiempo real con metadatos no estructurados.
   */
  getMongoSessionsStream(): Observable<MongoClassSession[]> {
    return of(this.SESSIONS_COLLECTION).pipe(delay(400));
  }

  /**
   * Obtiene la información personalizada para el portal de un profesor específico:
   * sus alumnos asignados, sesiones impartidas y cálculo exacto del dinero ganado.
   */
  getTeacherPortalData(teacherEmailOrName: string): Observable<{
    teacher: TeacherRecord;
    students: SqlStudentRate[];
    sessions: MongoClassSession[];
    totalEarned: number;
    hoursCount: number;
  }> {
    const query = (teacherEmailOrName || '').toLowerCase().trim();
    
    // Búsqueda por email o por nombre parcial
    let teacher = this.TEACHERS_CATALOG.find(t => 
      t.email.toLowerCase() === query || 
      t.nombre.toLowerCase().includes(query)
    );

    // Fallback al profesor titular principal (Dra. Elena Ramos) si no coincide
    if (!teacher) {
      teacher = this.TEACHERS_CATALOG[0];
    }

    // Filtrar sesiones del profesor
    const sessions = this.SESSIONS_COLLECTION.filter(s => 
      s.tutor.toLowerCase().includes(teacher!.nombre.toLowerCase()) || 
      teacher!.nombre.toLowerCase().includes(s.tutor.toLowerCase())
    );

    // Filtrar alumnos que tiene asignados
    const students = this.STUDENTS_CATALOG.filter(st => 
      teacher!.alumnosAsignados.some(assigned => assigned.toLowerCase() === st.nombre.toLowerCase()) ||
      st.profesorAsignado.toLowerCase().includes(teacher!.nombre.toLowerCase())
    );

    // Calcular dinero total ganado en sesiones confirmadas / en curso
    const totalEarned = sessions
      .filter(s => s.estado !== 'Cancelada')
      .reduce((sum, s) => sum + s.importe, 0);

    const hoursCount = Math.round(
      sessions.reduce((sum, s) => sum + s.duracionMin, 0) / 60
    );

    return of({
      teacher,
      students,
      sessions,
      totalEarned,
      hoursCount
    }).pipe(delay(300));
  }

  /**
   * ORQUESTACIÓN CONCURRENTE CON RxJS forkJoin:
   * Dispara en paralelo las fuentes heterogéneas (Alumnos SQL, Profesores SQL y Sesiones NoSQL).
   * Emite únicamente cuando todas completan su emisión.
   */
  getCombinedDashboardData(): Observable<CombinedDashboardData> {
    return forkJoin({
      catalogoSql: this.getSqlStudentsCatalog(),
      profesoresSql: this.getTeachersCatalog(),
      sesionesNoSql: this.getMongoSessionsStream()
    }).pipe(
      map(({ catalogoSql, profesoresSql, sesionesNoSql }) => ({
        catalogoSql,
        profesoresSql,
        sesionesNoSql,
        timestamp: new Date().toISOString()
      }))
    );
  }
}
