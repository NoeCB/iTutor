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
  saldoPendiente: number;
}

/** Interfaz representativa de colección documental en NoSQL (MongoDB) */
export interface MongoClassSession {
  _id: string;
  estudianteId: number;
  estudianteNombre: string;
  materia: string;
  rama: 'Física' | 'Matemáticas';
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
  sesionesNoSql: MongoClassSession[];
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor() {}

  /**
   * Simula consulta a API Backend conectada a SQL (PostgreSQL/MySQL).
   * Recupera catálogo maestro de alumnos, tarifas horarias contratadas y saldos.
   */
  getSqlStudentsCatalog(): Observable<SqlStudentRate[]> {
    const mockSqlData: SqlStudentRate[] = [
      {
        id: 101,
        nombre: 'Marcos Vega Ortiz',
        email: 'marcos.vega@alumnos.nebrija.es',
        matricula: 'MAT-2026-041',
        tarifaHora: 30,
        plan: 'Intensivo',
        asignaturaPrincipal: 'Física Clásica & Mecánica',
        saldoPendiente: 0
      },
      {
        id: 102,
        nombre: 'Lucía Hernanz Sanz',
        email: 'lucia.hernanz@alumnos.nebrija.es',
        matricula: 'MAT-2026-089',
        tarifaHora: 35,
        plan: 'Premium',
        asignaturaPrincipal: 'Cálculo Multivariable II',
        saldoPendiente: 70
      },
      {
        id: 103,
        nombre: 'Alejandro Gómez Soto',
        email: 'alejandro.gomez@alumnos.nebrija.es',
        matricula: 'MAT-2026-112',
        tarifaHora: 30,
        plan: 'Intensivo',
        asignaturaPrincipal: 'Termodinámica & Fluidos',
        saldoPendiente: 0
      },
      {
        id: 104,
        nombre: 'Sofía Navarro Cruz',
        email: 'sofia.navarro@alumnos.nebrija.es',
        matricula: 'MAT-2026-135',
        tarifaHora: 25,
        plan: 'Básico',
        asignaturaPrincipal: 'Álgebra Lineal & Matrices',
        saldoPendiente: 40
      },
      {
        id: 105,
        nombre: 'Javier Domínguez Rey',
        email: 'javier.dominguez@alumnos.nebrija.es',
        matricula: 'MAT-2026-180',
        tarifaHora: 35,
        plan: 'Premium',
        asignaturaPrincipal: 'Electromagnetismo Avanzado',
        saldoPendiente: 110
      },
      {
        id: 106,
        nombre: 'Clara Morales Ibáñez',
        email: 'clara.morales@alumnos.nebrija.es',
        matricula: 'MAT-2026-204',
        tarifaHora: 30,
        plan: 'Intensivo',
        asignaturaPrincipal: 'Ecuaciones Diferenciales',
        saldoPendiente: 0
      }
    ];

    // Simulación de latencia de red y consulta SQL (550 ms)
    return of(mockSqlData).pipe(delay(550));
  }

  /**
   * Simula consulta a API Backend conectada a NoSQL (MongoDB Atlas).
   * Recupera histórico y sesiones de tutoría en tiempo real con metadatos no estructurados.
   */
  getMongoSessionsStream(): Observable<MongoClassSession[]> {
    const mockMongoData: MongoClassSession[] = [
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
        tutor: 'Dra. Elena Ramos',
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
        tutor: 'Dra. Elena Ramos',
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
        tutor: 'Prof. Carlos Méndez',
        fecha: '2026-10-09 11:00',
        mes: 'octubre',
        duracionMin: 60,
        importe: 30,
        estado: 'Confirmada',
        asistencia: true,
        notasSeguimiento: 'Transformada de Laplace aplicada a sistemas RLC.'
      },

      // Noviembre
      {
        _id: '654a1f9e2b1c8a001a111109',
        estudianteId: 103,
        estudianteNombre: 'Alejandro Gómez Soto',
        materia: 'Termodinámica',
        rama: 'Física',
        tutor: 'Dra. Elena Ramos',
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
        tutor: 'Dra. Elena Ramos',
        fecha: '2026-11-12 17:00',
        mes: 'noviembre',
        duracionMin: 90,
        importe: 52.5,
        estado: 'Confirmada',
        asistencia: true,
        notasSeguimiento: 'Ecuaciones de Maxwell en medios dieléctricos.'
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
      }
    ];

    // Simulación de latencia de red y consulta NoSQL (700 ms)
    return of(mockMongoData).pipe(delay(700));
  }

  /**
   * ORQUESTACIÓN CONCURRENTE CON RxJS forkJoin:
   * Dispara en paralelo ambas fuentes heterogéneas (SQL y NoSQL).
   * Emite únicamente cuando ambas fuentes completan su emisión.
   */
  getCombinedDashboardData(): Observable<CombinedDashboardData> {
    return forkJoin({
      catalogoSql: this.getSqlStudentsCatalog(),
      sesionesNoSql: this.getMongoSessionsStream()
    }).pipe(
      map(({ catalogoSql, sesionesNoSql }) => ({
        catalogoSql,
        sesionesNoSql,
        timestamp: new Date().toISOString()
      }))
    );
  }
}
