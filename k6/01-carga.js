// PRUEBA DE CARGA (load test)
// Objetivo: comprobar si la API mantiene los objetivos de servicio (SLO) bajo una
// carga normal y esperada. No busca saturarla: para eso están estrés y punto de quiebre.
// Con los valores predeterminados, el escenario viajeros sube gradualmente a 20 VUs,
// sostiene ese nivel 3 minutos y luego baja a cero.
//
// Ejecutar:               k6 run k6/01-carga.js
// Cambiar usuarios/tiempo: k6 run -e VUS=30 -e SOSTENER=5m k6/01-carga.js

// Se reutilizan el flujo funcional, el monitor y las funciones de ciclo de vida,
// además de los SLO y el formato de resumen comunes a las demás pruebas.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { SLO, ESCENARIO_MONITOR, TREND_STATS, aSegundos } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

// __ENV recibe variables pasadas a k6 con -e. Estos valores solo definen la
// concurrencia y el tiempo a carga estable; las etapas de subida y bajada son fijas.
const VUS = parseInt(__ENV.VUS || '20', 10);
const SOSTENER = __ENV.SOSTENER || '3m';

export const options = {
  // Incluye p90, p95 y p99 en las métricas de tiempos para ver también las
  // respuestas lentas, no solo el promedio.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      // El modelo de VUs mantiene usuarios virtuales activos; cada uno repite
      // el flujo de viajero mientras la etapa esté en curso.
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS }, // rampa de calentamiento hasta la carga objetivo
        { duration: SOSTENER, target: VUS }, // periodo útil para evaluar los SLO bajo carga estable
        { duration: '30s', target: 0 }, // descenso gradual para observar el fin de la carga
      ],
      // Da hasta 10 s a las iteraciones activas para terminar al bajar los VUs.
      gracefulRampDown: '10s',
    },
    // Escenario independiente que consulta /metricas cada 5 s. Su duración se
    // calcula para cubrir las tres etapas del escenario viajeros.
    monitor: { ...ESCENARIO_MONITOR, duration: `${60 + aSegundos(SOSTENER) + 30}s` },
  },
  // Incluye objetivos globales y por endpoint. Un umbral incumplido hace que
  // k6 marque la ejecución como fallida al terminar; no corta la carga antes.
  thresholds: SLO,
};

// Se ejecuta una vez antes de los escenarios: valida disponibilidad y reinicia
// las métricas del servidor para que el resultado corresponda a esta ejecución.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Una iteración equivale al flujo de uso habitual, con probabilidades y pausas
  // predeterminadas; a diferencia del humo, no fuerza todos los endpoints opcionales.
  viajero();
}

// Función invocada por el escenario monitor declarado arriba.
export { monitorServidor };

// Se ejecuta una vez al final para informar el estado del servidor y comparar
// las métricas tomadas al inicio con las del cierre.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Produce el resumen en consola y la evidencia con el nombre "carga".
export const handleSummary = crearResumen('carga');
