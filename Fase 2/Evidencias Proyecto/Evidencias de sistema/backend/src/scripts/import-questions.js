// Carga al banco (colección `questions`) una muestra de los bancos de preguntas
// de la carpeta del proyecto (PAES Chile Matematica / Biologia / Verbal), para
// que la app del alumno tenga qué practicar. IDs deterministas => se puede
// correr varias veces sin duplicar. NO borra nada.
// Uso: npm run questions:import -- [--per 80] [--real]
// Supuesto de demo: los archivos de origen no traen dificultad ni eje, así que la
// dificultad se reparte d1/d2/d3 en orden y el eje queda vacío.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
assertSafeTarget('import-questions');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const perArg = process.argv.indexOf('--per');
const PER = perArg > -1 ? Math.max(1, Math.min(500, Number(process.argv[perArg + 1]) || 80)) : 80;

const BANKS = [
  { dir: 'PAES Chile Matematica', testId: 'm1' },
  { dir: 'PAES Chile Biologia', testId: 'b1' },
  { dir: 'PAES Chile Verbal', testId: 'l1' },
];
const DIFFS = ['d1', 'd2', 'd3'];
const LETTERS = 'ABCDE';

function loadBank(dir) {
  const full = path.join(root, dir);
  const out = [];
  for (const f of fs.readdirSync(full).filter((x) => x.toLowerCase().endsWith('.json')).sort()) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')); } catch { console.warn(`  (se omite ${f}: JSON inválido)`); continue; }
    const arr = Array.isArray(j) ? j : (j.preguntas || j.questions || []);
    for (const q of arr) {
      const ok = typeof q?.pregunta === 'string' && Array.isArray(q.alternativas) && q.alternativas.length >= 2
        && q.alternativas.length <= 5 && LETTERS.slice(0, q.alternativas.length).includes(String(q.respuesta_correcta || '').toUpperCase());
      if (ok) out.push(q);
    }
  }
  return out;
}

const now = new Date().toISOString();
let total = 0;
for (const { dir, testId } of BANKS) {
  const all = loadBank(dir);
  const step = Math.max(1, Math.floor(all.length / PER));
  const picked = [];
  for (let i = 0; i < all.length && picked.length < PER; i += step) picked.push([i, all[i]]);
  let batch = db.batch(); let n = 0;
  for (const [i, q] of picked) {
    const id = `qst_${testId}_${String(i).padStart(4, '0')}`;
    batch.set(db.collection(COL.questions).doc(id), {
      testId, axis: null, difficulty: DIFFS[n % DIFFS.length],
      statement: q.pregunta, options: q.alternativas, correctAnswer: String(q.respuesta_correcta).toUpperCase(),
      explanation: q.explicacion_respuesta || '', requiredSkill: q.habilidad_requerida || '',
      status: 'published', createdAt: now, updatedAt: now,
    });
    n += 1;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  total += n;
  console.log(`  ✓ ${testId}: ${n} preguntas (de ${all.length} válidas en "${dir}")`);
}
console.log(`Listo: ${total} preguntas publicadas.`);
process.exit(0);
