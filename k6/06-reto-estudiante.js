// RETO: diseñe su propia prueba
// Complete los espacios marcados con TODO. Este archivo es parte de la entrega del taller.
//
// Contexto: el área de analítica de RutaSegura publica el reporte de estadísticas en una
// pantalla del centro de control que se actualiza constantemente. Se espera que unas
// 15 pantallas consulten /reportes/estadisticas cada 2 segundos, al mismo tiempo que
// 20 viajeros usan la aplicación de forma normal.
//
// Preguntas que debe responder la prueba:
//   1. ¿El reporte cumple su SLO (p95 < 1500 ms) con esa concurrencia?
//   2. ¿Las consultas al reporte afectan el tiempo de respuesta de los viajeros? ¿Por qué?
//
// Ejecutar:  k6 run k6/06-reto-estudiante.js

import http from 'k6/http';
import { check } from 'k6';
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { BASE_URL, SLO, ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

export const options = {
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
    },

    // TODO 1 (resuelto): 15 pantallas que consultan el reporte cada 2 s.
    // constant-arrival-rate es un modelo abierto: k6 inicia 15 iteraciones cada 2 s
    // (7,5 consultas/s) aunque el servidor tarde en responder, igual que una pantalla
    // con un temporizador que no espera a la respuesta anterior.
    // VUs necesarios (Ley de Little) = 7,5 consultas/s × tiempo de respuesta.
    // Con 15 VUs preasignados se cubren respuestas de hasta 2 s; maxVUs deja margen
    // para que k6 no descarte iteraciones (dropped_iterations) si el reporte se degrada.
    pantallas: {
      executor: 'constant-arrival-rate',
      exec: 'pantallaControl',
      rate: 15,
      timeUnit: '2s',
      duration: '3m',
      preAllocatedVUs: 15,
      maxVUs: 60,
    },

    monitor: { ...ESCENARIO_MONITOR, duration: '3m' },
  },
  thresholds: {
    ...SLO,
    // TODO 2 (resuelto): umbrales exclusivos del escenario "pantallas".
    // Al filtrar por scenario, las consultas de las pantallas no se mezclan con los SLO
    // de los viajeros (y viceversa).
    'http_req_duration{scenario:pantallas}': ['p(95)<1500'],
    'http_req_failed{scenario:pantallas}': ['rate<0.01'],
    'checks{scenario:pantallas}': ['rate>0.99'],
  },
};

export function setup() {
  return prepararPrueba();
}

export default function () {
  viajero();
}

export function pantallaControl() {
  // TODO 3 (resuelto): petición de la pantalla con su etiqueta y validaciones.
  const res = http.get(`${BASE_URL}/reportes/estadisticas`, {
    tags: { endpoint: 'estadisticas', name: 'GET /reportes/estadisticas' },
  });
  check(res, {
    'pantalla: status 200': (r) => r.status === 200,
    'pantalla: trae totalIncidentes': (r) => {
      try {
        return typeof r.json('totalIncidentes') === 'number';
      } catch (e) {
        return false;
      }
    },
  });
  // Sin sleep(): el ritmo lo fija el executor (15 consultas cada 2 s), no el VU.
}

export { monitorServidor };

export function teardown(datos) {
  cerrarPrueba(datos);
}

// NOMBRE permite distinguir las dos ejecuciones en resultados/, por ejemplo:
//   k6 run -e NOMBRE=reto-sin-cache k6/06-reto-estudiante.js
//   k6 run -e NOMBRE=reto-con-cache k6/06-reto-estudiante.js
export const handleSummary = crearResumen(__ENV.NOMBRE || 'reto');

// TODO 4 (análisis): ejecute la prueba dos veces, la segunda con la API iniciada con
// CACHE_ESTADISTICAS=true. Registre los resultados en la tabla del taller y explique la diferencia.
