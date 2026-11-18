// PRUEBA DE ESTRÉS (stress test)
// Objetivo: superar gradualmente la carga normal y observar en qué nivel se degradan
// los tiempos o aparecen errores, además de comprobar la recuperación al reducirla.
//
// Recorrido predeterminado: 20 → 50 → 100 → MAX VUs y luego recuperación a 10 VUs.
//
// Ejecutar:  k6 run k6/02-estres.js
// Escalón máximo distinto: k6 run -e MAX=200 k6/02-estres.js

// Flujo y auxiliares compartidos con el resto de las pruebas.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { SLO, ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

// Controla los dos escalones más altos: 150 VUs por defecto o el valor indicado
// con -e MAX=...; no cambia los niveles de 20, 50 ni 100 VUs.
const MAX = parseInt(__ENV.MAX || '150', 10);

export const options = {
  // Solicita percentiles adicionales para apreciar cómo empeora la cola de latencia.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      // Mantiene VUs concurrentes y cambia su número por etapas. Cada etapa dura
      // un minuto, por lo que la secuencia completa dura 10 minutos.
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 }, // rampa desde cero hasta la referencia normal
        { duration: '1m', target: 20 }, // sostiene el nivel normal
        { duration: '1m', target: 50 }, // sube a una carga superior
        { duration: '1m', target: 50 }, // sostiene para observar el efecto del nivel
        { duration: '1m', target: 100 }, // aumenta el estrés
        { duration: '1m', target: 100 }, // sostiene el nivel de estrés
        { duration: '1m', target: MAX }, // sube al máximo configurado
        { duration: '1m', target: MAX }, // mantiene la carga severa
        { duration: '1m', target: 10 }, // reduce rápido para observar la recuperación
        { duration: '1m', target: 10 },
      ],
      // Permite que las iteraciones activas terminen hasta 10 s después de
      // iniciar una reducción de VUs.
      gracefulRampDown: '10s',
    },
    // Mide /metricas a intervalos regulares durante el mismo recorrido de 10 min.
    monitor: { ...ESCENARIO_MONITOR, duration: '10m' },
  },
  // Se conservan los SLO para registrar qué objetivos se incumplen. Al no tener
  // abortOnFail, un incumplimiento no detiene la prueba: permite ver también la
  // degradación en niveles superiores y el comportamiento durante la recuperación.
  thresholds: SLO,
};

// Comprueba que la API está disponible y reinicia los contadores antes de aplicar carga.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Flujo normal de viajero, con sus probabilidades de acciones y pausas habituales.
  viajero();
}

// Entrada usada por el escenario de monitorización.
export { monitorServidor };

// Informa las métricas del servidor al cierre, incluso si se incumplieron SLO.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Guarda el resumen y los datos de esta ejecución bajo el nombre "estres".
export const handleSummary = crearResumen('estres');
