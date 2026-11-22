import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { signal } from '@angular/core';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../servicios/auth.service';
import { DemoService } from '../servicios/demo.service';
import { Login } from '../paginas/login/login';

describe('authInterceptor — manejo de token y respuestas HTTP 401', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let routerSpy: jasmine.SpyObj<Router>;
    let modoDemo: ReturnType<typeof signal<boolean>>;
    let tokenActual: string | null;

    const configurar = (urlInicial = '/') => {
        tokenActual = 'token-sintetico-102';
        modoDemo = signal(false);
        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: urlInicial });
        routerSpy.navigate.and.resolveTo(true);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: { obtenerToken: () => Promise.resolve(tokenActual) } },
                { provide: DemoService, useValue: { esModoDemo: modoDemo } },
                { provide: Router, useValue: routerSpy },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    };

    afterEach(() => {
        httpMock?.verify();
    });

    it('adjunta Authorization Bearer cuando hay token válido', fakeAsync(() => {
        configurar('/');
        let respuesta: unknown = null;

        http.get('/api/ofertas').subscribe(datos => { respuesta = datos; });
        tick();

        const req = httpMock.expectOne('/api/ofertas');
        expect(req.request.headers.get('Authorization')).toBe('Bearer token-sintetico-102');
        req.flush({ exito: true, datos: [] });
        expect(respuesta).toEqual({ exito: true, datos: [] });
    }));

    it('redirige una sola vez a /login?motivo=sesion-expirada ante múltiples 401 concurrentes y propaga el error', fakeAsync(() => {
        configurar('/');
        let erroresCapturados = 0;

        http.get('/api/ofertas').subscribe({ error: () => { erroresCapturados++; } });
        http.get('/api/evaluacion/progreso').subscribe({ error: () => { erroresCapturados++; } });
        http.get('/api/automatizacion/estado').subscribe({ error: () => { erroresCapturados++; } });
        tick();

        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Se requiere un token de autenticación' },
            { status: 401, statusText: 'Unauthorized' }
        );
        httpMock.expectOne('/api/evaluacion/progreso').flush(
            { exito: false, error: 'Se requiere un token de autenticación' },
            { status: 401, statusText: 'Unauthorized' }
        );
        httpMock.expectOne('/api/automatizacion/estado').flush(
            { exito: false, error: 'Se requiere un token de autenticación' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();

        expect(erroresCapturados).toBe(3);
        expect(routerSpy.navigate).toHaveBeenCalledTimes(1);
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { motivo: 'sesion-expirada' },
            replaceUrl: true,
        });
    }));

    it('no redirige a /login ante errores 503 ni en modo demo ni si ya está en /login', fakeAsync(() => {
        configurar('/');
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Error temporal' },
            { status: 503, statusText: 'Service Unavailable' }
        );
        tick();
        expect(routerSpy.navigate).not.toHaveBeenCalled();

        modoDemo.set(true);
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Sin token' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    }));

    it('no redirige cuando la ruta actual ya es /login', fakeAsync(() => {
        configurar('/login?motivo=sesion-expirada');
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Sin token' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    }));

    it('no redirige a /login ante HTTP 403 y propaga el error', fakeAsync(() => {
        configurar('/');
        let statusRecibido = 0;

        http.get('/api/ofertas').subscribe({
            error: (err) => { statusRecibido = err.status; },
        });
        tick();

        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Acceso denegado' },
            { status: 403, statusText: 'Forbidden' }
        );
        tick();

        expect(statusRecibido).toBe(403);
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    }));

    it('permite redirigir nuevamente si ocurre otro 401 después de completar una redirección y reautenticar', fakeAsync(() => {
        configurar('/');
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Token vencido' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();
        expect(routerSpy.navigate).toHaveBeenCalledTimes(1);

        // Usuario reautenticó y volvió al dashboard; más tarde vence la sesión de nuevo.
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Token vencido otra vez' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();
        expect(routerSpy.navigate).toHaveBeenCalledTimes(2);
    }));

    it('redirige una vez a /login cuando obtenerToken() rechaza por token expirado de Firebase sin disparar request HTTP', fakeAsync(() => {
        modoDemo = signal(false);
        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/' });
        routerSpy.navigate.and.resolveTo(true);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: {
                        obtenerToken: () => Promise.reject({ code: 'auth/user-token-expired', message: 'Token expirado' }),
                    },
                },
                { provide: DemoService, useValue: { esModoDemo: modoDemo } },
                { provide: Router, useValue: routerSpy },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);

        let errorCapturado: any = null;
        http.get('/api/ofertas').subscribe({ error: (err) => { errorCapturado = err; } });
        tick();

        httpMock.expectNone('/api/ofertas');
        expect(errorCapturado?.code).toBe('auth/user-token-expired');
        expect(routerSpy.navigate).toHaveBeenCalledTimes(1);
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { motivo: 'sesion-expirada' },
            replaceUrl: true,
        });
    }));

    it('no redirige a /login cuando obtenerToken() falla por red de Firebase y propaga el error', fakeAsync(() => {
        modoDemo = signal(false);
        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/' });
        routerSpy.navigate.and.resolveTo(true);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: {
                        obtenerToken: () => Promise.reject({ code: 'auth/network-request-failed', message: 'Sin conexión' }),
                    },
                },
                { provide: DemoService, useValue: { esModoDemo: modoDemo } },
                { provide: Router, useValue: routerSpy },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);

        let errorCapturado: any = null;
        http.get('/api/ofertas').subscribe({ error: (err) => { errorCapturado = err; } });
        tick();

        httpMock.expectNone('/api/ofertas');
        expect(errorCapturado?.code).toBe('auth/network-request-failed');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    }));

    it('libera la guarda de redirección sin rechazo no manejado si router.navigate rechaza', fakeAsync(() => {
        configurar('/');
        routerSpy.navigate.and.rejectWith(new Error('Navegación cancelada'));

        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Sin token' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();

        routerSpy.navigate.and.resolveTo(true);
        http.get('/api/ofertas').subscribe({ error: () => {} });
        tick();
        httpMock.expectOne('/api/ofertas').flush(
            { exito: false, error: 'Sin token' },
            { status: 401, statusText: 'Unauthorized' }
        );
        tick();

        expect(routerSpy.navigate).toHaveBeenCalledTimes(2);
    }));
});

describe('Login — aviso de sesión expirada', () => {
    it('muestra alerta clara cuando recibe motivo=sesion-expirada en la URL', async () => {
        await TestBed.configureTestingModule({
            imports: [Login],
            providers: [
                { provide: Auth, useValue: {} },
                { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']) },
                { provide: DemoService, useValue: { activarDemo: () => {} } },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap({ motivo: 'sesion-expirada' }) } },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Login);
        fixture.detectChanges();

        const alerta = fixture.nativeElement.querySelector('[role="alert"]');
        expect(alerta).not.toBeNull();
        expect(alerta.textContent).toContain('sesión expiró');
    });
});
