import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisClasesPage } from './mis-clases.page';

describe('MisClasesPage', () => {
  let component: MisClasesPage;
  let fixture: ComponentFixture<MisClasesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MisClasesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
