import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permisoGuard } from './core/guards/permiso.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'recuperar-password',
    loadComponent: () =>
      import('./features/auth/recuperar-password/recuperar-password.component').then(
        (m) => m.RecuperarPasswordComponent,
      ),
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'roles',
    loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent),
    canActivate: [authGuard, permisoGuard('Roles')],
  },
  {
    path: 'permisos',
    loadComponent: () => import('./features/permisos/permisos.component').then((m) => m.PermisosComponent),
    canActivate: [authGuard, permisoGuard('Permisos')],
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
    canActivate: [authGuard, permisoGuard('Usuarios')],
  },
  {
    path: 'novedades',
    loadComponent: () => import('./features/novedades/novedades.component').then((m) => m.NovedadesComponent),
    canActivate: [authGuard, permisoGuard('Novedades')],
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./features/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
    canActivate: [authGuard, permisoGuard('Configuración')],
  },
  {
    path: 'soporte',
    loadComponent: () => import('./features/soporte/soporte.component').then((m) => m.SoporteComponent),
    canActivate: [authGuard, permisoGuard('Soporte')],
  },
  {
    path: 'informes',
    loadComponent: () => import('./features/informes/informes.component').then((m) => m.InformesComponent),
    canActivate: [authGuard, permisoGuard('Informe')],
  },
  {
    path: 'menu',
    loadComponent: () => import('./features/menu/menu.component').then((m) => m.MenuComponent),
    canActivate: [authGuard, permisoGuard('Menu')],
  },
  { path: '**', redirectTo: '' },
];
