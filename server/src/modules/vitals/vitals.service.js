import { EventEmitter } from 'node:events';
import { HttpError } from '../../utils/http-error.js';
import * as repo from './vitals.repository.js';

/** In-process pub/sub: every saved reading is pushed to open SSE streams. */
export const vitalsBus = new EventEmitter();
vitalsBus.setMaxListeners(200);

const RULES = [
  {
    type: 'HEART_RATE',
    test: (r) => r.heartRate > 120 || r.heartRate < 50,
    detail: (r) => `Nhịp tim ${r.heartRate} bpm`,
  },
  { type: 'SPO2', test: (r) => r.spo2 < 92, detail: (r) => `SpO₂ ${r.spo2}%` },
  {
    type: 'BLOOD_PRESSURE',
    test: (r) => r.systolicBp >= 160 || r.systolicBp < 90,
    detail: (r) => `Huyết áp ${r.systolicBp}/${r.diastolicBp} mmHg`,
  },
  { type: 'TEMPERATURE', test: (r) => r.temperature >= 38.5, detail: (r) => `Nhiệt độ ${r.temperature}°C` },
];

export const detectAlerts = (r) =>
  RULES.filter((rule) => rule.test(r)).map((rule) => ({ type: rule.type, detail: rule.detail(r) }));

export async function record(input) {
  const reading = {
    ...input,
    recordedAt: input.recordedAt ?? new Date(),
    deviceId: input.deviceId ?? 'manual',
  };
  const alerts = detectAlerts(reading);
  await repo.save(reading, alerts);
  vitalsBus.emit('reading', { ...reading, alerts });
  return { ...reading, alerts };
}

export const history = (patientId, { day, limit }) => repo.findByDay(patientId, day, limit);
export const latest = (patientIds) => repo.latest(patientIds);
export const alerts = ({ day, limit }) => repo.alerts(day, limit);

// ---------------------------------------------------------------- device simulator

let simulation = null;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const drift = (v, step, lo, hi) => clamp(v + (Math.random() * 2 - 1) * step, lo, hi);

function nextReading(patientId, state) {
  state.hr = drift(state.hr, 3, 55, 110);
  state.sys = drift(state.sys, 3, 100, 150);
  state.dia = drift(state.dia, 2, 60, 95);
  state.spo2 = drift(state.spo2, 0.5, 93, 100);
  state.temp = drift(state.temp, 0.05, 36.2, 38);
  const spike = Math.random() < 0.04; // ~4% abnormal readings so alerts show up in the demo
  return {
    patientId,
    heartRate: Math.round(spike ? 130 + Math.random() * 20 : state.hr),
    systolicBp: Math.round(state.sys),
    diastolicBp: Math.round(state.dia),
    spo2: Math.round(spike && Math.random() < 0.5 ? 88 : state.spo2),
    temperature: Math.round(state.temp * 10) / 10,
    deviceId: `monitor-${patientId}`,
  };
}

export function simulatorStatus() {
  if (!simulation) return { running: false };
  const { patientIds, intervalMs, endsAt, written, failed } = simulation;
  return { running: true, patientIds, intervalMs, endsAt, written, failed };
}

export function startSimulator({ patientIds, intervalMs, durationSec }) {
  if (simulation) throw new HttpError(409, 'Trình giả lập đang chạy, hãy dừng trước');
  const states = new Map(
    patientIds.map((id) => [id, { hr: 70 + Math.random() * 15, sys: 118, dia: 76, spo2: 98, temp: 36.7 }]),
  );
  simulation = {
    patientIds,
    intervalMs,
    endsAt: new Date(Date.now() + durationSec * 1000),
    written: 0,
    failed: 0,
  };
  simulation.timer = setInterval(() => {
    if (Date.now() >= simulation.endsAt.getTime()) return stopSimulator();
    for (const [id, state] of states) {
      record(nextReading(id, state)).then(
        () => simulation && simulation.written++,
        () => simulation && simulation.failed++,
      );
    }
  }, intervalMs);
  return simulatorStatus();
}

export function stopSimulator() {
  if (simulation) clearInterval(simulation.timer);
  const final = simulatorStatus();
  simulation = null;
  return { ...final, running: false };
}
