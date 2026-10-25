import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { addIcons } from 'ionicons';
import { 
  arrowUpOutline, 
  arrowDownOutline, 
  trendingUpOutline, 
  cashOutline, 
  peopleOutline, 
  timeOutline, 
  schoolOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonIcon],
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  /** Título del indicador estadístico */
  @Input({ required: true }) title!: string;

  /** Valor principal (ej: '4.850 €', 128, '96%') */
  @Input({ required: true }) value!: string | number;

  /** Nombre del icono de Ionic (ej: 'cash-outline', 'people-outline') */
  @Input({ required: true }) icon!: string;

  /** Porcentaje de crecimiento (positivo = verde, negativo = rojo) */
  @Input({ required: true }) growthPercentage!: number;

  /** Periodo comparativo (ej: 'vs. mes anterior') */
  @Input() period: string = 'vs. mes anterior';

  /** Variante de color del icono: 'primary' | 'secondary' | 'tertiary' | 'warning' */
  @Input() iconVariant: 'primary' | 'secondary' | 'tertiary' | 'warning' = 'primary';

  constructor() {
    addIcons({
      arrowUpOutline,
      arrowDownOutline,
      trendingUpOutline,
      cashOutline,
      peopleOutline,
      timeOutline,
      schoolOutline
    });
  }

  get isPositive(): boolean {
    return this.growthPercentage >= 0;
  }

  get formattedGrowth(): string {
    const prefix = this.growthPercentage > 0 ? '+' : '';
    return `${prefix}${this.growthPercentage}%`;
  }
}
