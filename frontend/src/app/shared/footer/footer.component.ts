import { Component } from '@angular/core';

/** Pie fijo con los derechos de autor — transversal, montado una vez en `app.html`. */
@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  readonly anio = new Date().getFullYear();
}
