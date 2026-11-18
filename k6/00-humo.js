// PRUEBA DE HUMO (smoke test)
// Es la primera prueba que conviene ejecutar: verifica que k6 puede correr el
// flujo y que la API responde correctamente con una carga pequeña. No busca
// medir la capacidad máxima ni simular tráfico realista.
//
// Ejecutar:  k6 run k6/00-humo.js

// Se reutilizan las mismas funciones que en las demás pruebas: el flujo del viajero,
// la lectura periódica de métricas del servidor, la preparación y el cierre.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { SLO, ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

export const options = {
  // Hace que k6 calcule estas estadísticas para las métricas de tipo Trend,
  // como los tiempos de respuesta.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    // Escenario funcional: cada uno de los 2 VUs ejecuta 5 iteraciones,
    // es decir, se esperan 10 recorridos de viajero en total.
    viajeros: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 5,
      // Límite para terminar el escenario si las iteraciones tardan demasiado.
      maxDuration: '1m',
    },
    // Escenario de observabilidad: consulta /metricas cada 5 segundos durante
    // 30 segundos. Corre en paralelo con "viajeros", no genera recorridos.
    monitor: { ...ESCENARIO_MONITOR, duration: '30s' },
  },
  thresholds: {
    // Conserva los umbrales compartidos, incluidos los específicos por endpoint.
    ...SLO,
    // Estas dos reglas sustituyen a las reglas globales de SLO con la misma
    // etiqueta: la prueba de humo requiere 0 % de fallos HTTP y 100 % de checks
    // correctos en las peticiones del escenario viajeros.
    'http_req_failed{scenario:viajeros}': ['rate==0'],
    'checks{scenario:viajeros}': ['rate==1'],
    // En humo se permite hasta 1.5 s en el p95 global de viajeros. Los umbrales
    // por endpoint heredados de SLO siguen aplicándose individualmente.
    'http_req_duration{scenario:viajeros}': ['p(95)<1500'],
  },
};

// k6 ejecuta setup una vez antes de iniciar los escenarios. La función comprueba
// que la API esté sana, reinicia métricas y entrega datos para teardown.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Cada iteración simula un flujo y fuerza la consulta de reportes y estadísticas.
  // Así se ejercitan también esos endpoints opcionales durante esta prueba corta.
  // La pausa de 1 segundo reduce la carga; no se pretende generar concurrencia alta.
  viajero({ probReporte: 1, probEstadisticas: 1, pausa: [1, 1] });
}

// El nombre debe coincidir con exec: 'monitorServidor' en ESCENARIO_MONITOR.
export { monitorServidor };

// k6 llama teardown una vez al terminar, pasando el objeto que devolvió setup.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Al finalizar, genera el resumen legible y los archivos de evidencia de la prueba
// bajo el nombre "humo" en el directorio resultados/.
export const handleSummary = crearResumen('humo');
