import { Injectable, inject } from '@angular/core';
import { MenuController } from '@ionic/angular/menu-controller';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private menuCtrl = inject(MenuController);

  /** Estado de colapso en escritorio */
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  isCollapsed$ = this.isCollapsedSubject.asObservable();

  get isCollapsed(): boolean {
    return this.isCollapsedSubject.value;
  }

  /**
   * Alterna el menú lateral tanto en escritorio (colapsar / desplegar)
   * como en móvil / tablet (abrir cajón overlay).
   */
  async toggleMenu(): Promise<void> {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 992;

    if (isDesktop) {
      const nextState = !this.isCollapsedSubject.value;
      this.isCollapsedSubject.next(nextState);

      // Si está colapsado en desktop y el usuario pulsa, abre el menú overlay
      if (nextState) {
        await this.menuCtrl.enable(true, 'main-menu');
        await this.menuCtrl.open('main-menu');
      } else {
        await this.menuCtrl.close('main-menu');
      }
    } else {
      // En móvil / tablet, despliega el menú lateral overlay de inmediato
      await this.menuCtrl.enable(true, 'main-menu');
      await this.menuCtrl.toggle('main-menu');
    }
  }

  /** Fuerza el estado colapsado / expandido */
  setCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
  }
}
