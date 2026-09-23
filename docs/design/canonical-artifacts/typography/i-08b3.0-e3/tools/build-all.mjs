/** I-08B3.0-E3 - render every board. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from './render.mjs';
import { PKG } from './ui.mjs';
import {
  overview, conversation, longAnalysisMobile, longAnalysisTablet,
  statementBoard, metadataBoard, mixedScriptBoard, controlsBoard,
} from './build-boards.mjs';
import {
  accessibilityMatrix, readingMeasureBoard, diacriticBoard, stressBoard, failureBoard,
} from './build-boards2.mjs';

const REVIEW = join(PKG, 'review');
mkdirSync(REVIEW, { recursive: true });

const boards = [
  overview(),
  conversation(1), conversation(2),
  longAnalysisMobile(), longAnalysisTablet(),
  statementBoard(), metadataBoard(), mixedScriptBoard(), controlsBoard(),
  accessibilityMatrix(), readingMeasureBoard(), diacriticBoard(), stressBoard(),
  failureBoard(),
];

const only = process.argv[2];
const results = [];
for (const b of boards) {
  if (only && !b.name.includes(only)) continue;
  results.push(await render(b.html, b.width, join(REVIEW, `${b.name}.png`), b.name));
}
writeFileSync(join(PKG, '..', '.i08b3-work-e3', 'boards.json'), JSON.stringify(results, null, 1), 'utf8');
console.log(`\n${results.length} boards rendered.`);
