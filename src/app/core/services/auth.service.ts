import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface User {
  email: string;
  role: 'Admin' | 'Standard';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Inicialización por defecto en Modo Admin para evaluación directa
  private currentUserSubject = new BehaviorSubject<User | null>({
    email: 'admin@nebrija.es',
    role: 'Admin'
  });
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        this.currentUserSubject.next(JSON.parse(saved));
      } catch {
        this.login('admin@nebrija.es', 'Admin');
      }
    } else {
      this.login('admin@nebrija.es', 'Admin');
    }
  }

  login(email: string, role: 'Admin' | 'Standard'): void {
    const user: User = { email, role };
    this.currentUserSubject.next(user);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'simulated-jwt-token'); // Simulación JWT
  }

  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  // Simulación de petición a API para validación asíncrona
  checkEmailExists(email: string): Observable<boolean> {
    const existingEmails = ['admin@nebrija.es', 'profesora@nebrija.es'];
    const exists = existingEmails.includes(email);
    return of(exists).pipe(delay(800)); // Retardo de 800ms simulando latencia de red
  }
}