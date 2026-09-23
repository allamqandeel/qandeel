/**
 * I-08B3.1-D2R — THE PRODUCT OWNER REVIEW SURFACE.
 *
 * §21 of the brief draws the line and this file keeps it: the Product Owner reviews the BIG
 * experiences, not blur radii, not 180 ms against 220 ms, not accessibility arithmetic. So there
 * is no number on this page, no token name, no English, and no craft vocabulary. Four films,
 * their stills, one sentence each about how the moment FEELS, and the seven questions §21 asks.
 *
 * THE ARABIC IS COMPOSED IN ARABIC, not translated from the English elsewhere in this package.
 * Register is فصحى throughout, because this is a decision surface for a product owner rather
 * than in-product copy — and because every one of these sentences has to survive being read
 * aloud in a review.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './d2-main.mjs';
import { resolveFont } from './d2-font.mjs';
import { FOUNDATION } from '../scene/d2-foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const FONT = resolveFont();

/**
 * THE REVIEW SURFACE'S OWN PALETTE, and it lives HERE rather than in the scene.
 *
 * I-08B3.1-D0R found the builder inlining the review board's colours into the product bundle as
 * dead data — including a name C3's invariant I-18 forbids. D1 moved them out. D2 keeps them
 * out: no product module imports this file, and the scene has no idea this page exists.
 */
const INK = {
  world: FOUNDATION.WORLD,
  surface: '#161616',
  rule: '#262626',
  primary: FOUNDATION.PRIMARY,
  secondary: FOUNDATION.SECONDARY,
  tertiary: FOUNDATION.TERTIARY,
};

export const CATEGORIES = [
  {
    letter: 'A',
    title: 'المحيط',
    kind: 'حياة العالم حين لا يحدث شيء',
    video: 'video/D2_A_AMBIENT_WORLD_FIELD.mp4',
    rm: 'video/D2_RM_A_AMBIENT_WORLD_FIELD.mp4',
    stills: [
      ['frames/A/D2_A_01_PERSONAL.png', 'العالم الخاص، ساكن تماماً'],
      ['frames/A/D2_A_02_PARALLAX.png', 'العالم وقد حرّكته اليد'],
      ['frames/A/D2_A_03_SHARED.png', 'عالم مشترك: للعالم كلّه هيئة واحدة تميّزه'],
      ['frames/A/D2_A_04_PUBLIC.png', 'عالم عام: الهيئة نفسها، أهدأ، وكلّ موضوع مسمّى'],
    ],
    feeling: 'الإحساس هنا هو أنّ العالم حيٌّ وهو ساكن: خطوطٌ متراكبة لكلّ موضوع، وعمقٌ يتبدّى حين تحرّك الخريطة بيدك، ولا شيء فيها يتحرّك من تلقاء نفسه.',
  },
  {
    letter: 'B',
    title: 'الرابط',
    kind: 'معنى جديد يتّصل بفهم سابق — وهو ما اخترته من قبل، دون تغيير',
    video: 'video/D2_B_CONNECTION_INHERITED.mp4',
    rm: 'video/D2_RM_B_CONNECTION_INHERITED.mp4',
    stills: [
      ['frames/B/D2_B_01_REST.png', 'قبل أن يبدأ شيء'],
      ['frames/B/D2_B_02_EVENT.png', 'لحظة الوصول'],
      ['frames/B/D2_B_03_SETTLED.png', 'وقد هدأ العالم'],
    ],
    feeling: 'الإحساس هنا هو الذي اخترتَه في المرحلة السابقة، كما هو: معنى في حديثك اليوم يجد فهماً سبق أن ظهر، فيسير إليه ويتبلور بينهما رابط، ثمّ يعود العالم إلى سكونه.',
  },
  {
    letter: 'C',
    title: 'النمط',
    kind: 'أمور متفرّقة تتبيّن بنيةً واحدة',
    video: 'video/D2_C_PATTERN_CRYSTALLIZATION.mp4',
    rm: 'video/D2_RM_C_PATTERN_CRYSTALLIZATION.mp4',
    stills: [
      ['frames/C/D2_C_01_REST.png', 'أربعة مواضيع على الخريطة منذ وقت'],
      ['frames/C/D2_C_02_EVENT.png', 'الضوء يتجمّع من كلٍّ منها نحو موضع واحد'],
      ['frames/C/D2_C_03_SETTLED.png', 'وقد ظهر النمط، ووُصِل بأعضائه الأربعة'],
    ],
    feeling: 'الإحساس هنا هو أنّ أربعة أمور كانت متفرّقة تبيّن أنّها نمطٌ واحد. يتجمّع الضوء من كلٍّ منها، فيظهر النمط نفسه شيئاً جديداً على الخريطة، وتصله بأعضائه أربعة وصلات متساوية: لا أوّل فيها ولا آخِر، ولا واحدة أقوى من أختها.',
  },
  {
    letter: 'D',
    title: 'الفهم',
    kind: 'إدراك جديد ينبثق حيث لم يكن شيء',
    video: 'video/D2_D_INSIGHT_EMERGENCE.mp4',
    rm: 'video/D2_RM_D_INSIGHT_EMERGENCE.mp4',
    stills: [
      ['frames/D/D2_D_01_REST.png', 'الموضع خالٍ'],
      ['frames/D/D2_D_02_EVENT.png', 'الضوء يتجمّع إليه من حوله'],
      ['frames/D/D2_D_03_SETTLED.png', 'وقد بقي الفهم'],
    ],
    feeling: 'الإحساس هنا هو أنّ فهماً جديداً انبثق في موضع كان خالياً. لا يلمع شيء ثمّ ينتشر، بل ينجذب الضوء من حول الموضع إليه، فيتّضح ما لم يكن موجوداً، ثمّ ينطفئ الضوء ويبقى الفهم.',
  },
];

export const QUESTIONS = [
  'هل يجعل المحيطُ العالمَ حيّاً؟',
  'هل ما زال «الرابط» يبدو لك أنّه قنديل يصل معنى بمعنى؟',
  'هل يبدو «النمط» فعلاً أنّ أشياء متفرّقة صارت بنية واحدة؟',
  'هل يبدو «الفهم» أنّه إدراك جديد ينبثق؟',
  'هل تنتمي الأربعة إلى لغة واحدة؟',
  'هل يوحي شيء منها بمعنًى تحليليّ غير صحيح؟',
  'هل صار قنديل بصريّاً لا يُنسى، أم ما زال محتشماً؟',
];

function page() {
  const face = `'QD-Estedad',system-ui,sans-serif`;
  const section = (c) => `
  <section class="cat" id="cat-${c.letter}">
    <h2><span class="letter" aria-hidden="true">${c.letter}</span>${c.title}</h2>
    <p class="kind">${c.kind}</p>
    <video class="film" src="${c.video}" controls preload="metadata" playsinline
           aria-label="فيلم ${c.title}"></video>
    <p class="feeling">${c.feeling}</p>
    <div class="stills">
      ${c.stills.map(([src, alt]) => `<figure><img src="${src}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`).join('\n      ')}
    </div>
    <details>
      <summary>الحركة المخفّفة</summary>
      <p class="note">هذه هي الصورة نفسها لمن اختار تقليل الحركة في جهازه. المعنى كما هو، والحركة أقلّ.</p>
      <video class="film rm" src="${c.rm}" controls preload="metadata" playsinline
             aria-label="فيلم ${c.title} — حركة مخفّفة"></video>
    </details>
  </section>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>قنديل — نظام الضوء — للمراجعة</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@font-face{
  font-family:'QD-Estedad';
  font-style:normal;font-weight:100 900;font-display:swap;
  src:url(${JSON.stringify(FONT.url)}) format('woff2');
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  background:${INK.world};color:${INK.primary};
  font-family:${face};
  /* Arabic ascenders, descenders and diacritics clip below about 1.6. Nothing on this page is
     tighter than 1.7, and nothing anywhere has letter-spacing: Arabic is a connected script. */
  line-height:1.8;
  padding:56px 20px 96px;
}
.wrap{max-width:860px;margin-inline:auto}
h1{font-size:34px;font-variation-settings:'wght' 600;line-height:1.6;margin-block-end:10px}
.lede{color:${INK.secondary};font-size:17px;max-width:62ch;margin-block-end:14px}
.meta{color:${INK.tertiary};font-size:14px;margin-block-end:44px}
hr{border:0;border-top:1px solid ${INK.rule};margin-block:44px}

h2{font-size:25px;font-variation-settings:'wght' 580;line-height:1.6;display:flex;align-items:baseline;gap:12px}
.letter{
  color:${INK.tertiary};font-size:14px;font-variation-settings:'wght' 500;
  /* The ONLY Latin glyph on this page, and the only element permitted tracking. */
  letter-spacing:.08em;
}
.kind{color:${INK.tertiary};font-size:15px;margin-block:4px 18px}

.film{
  display:block;width:100%;max-width:330px;border-radius:14px;
  background:${INK.world};border:1px solid ${INK.rule};
}
.feeling{
  font-size:18px;color:${INK.primary};max-width:58ch;
  margin-block:22px 8px;padding-inline-start:14px;
  border-inline-start:2px solid ${INK.rule};
}
.stills{display:flex;flex-wrap:wrap;gap:14px;margin-block-start:24px}
figure{width:150px}
figure img{width:100%;display:block;border-radius:8px;border:1px solid ${INK.rule}}
figcaption{color:${INK.tertiary};font-size:13px;margin-block-start:8px;line-height:1.7}

details{margin-block-start:26px}
summary{
  color:${INK.secondary};font-size:15px;cursor:pointer;
  padding-block:6px;
}
summary:focus-visible{outline:2px solid ${INK.secondary};outline-offset:3px;border-radius:4px}
.note{color:${INK.tertiary};font-size:14px;margin-block:8px 12px;max-width:56ch}

.section-lede{color:${INK.secondary};font-size:16px;max-width:60ch;margin-block-end:20px}
ol{margin-inline-start:20px}
li{font-size:17px;margin-block-end:12px;max-width:58ch}

section.cat{margin-block-end:64px}
@media (max-width:560px){ figure{width:calc(50% - 7px)} }
</style>
</head>
<body>
<div class="wrap">
  <h1>قنديل — نظام الضوء</h1>
  <p class="lede">
    أربع لحظات يظهر فيها الضوء في قنديل. واحدة منها اخترتَها من قبل ولم تتغيّر، وثلاث جديدة.
    السؤال الأهمّ في هذه المراجعة ليس عن واحدة منها، بل عنها مجتمعة: هل تبدو لغةً واحدة؟
  </p>
  <p class="meta">
    شاهد الأفلام بالترتيب من الأعلى إلى الأسفل. وفي آخر الصفحة فيلم واحد يجمعها كلّها.
  </p>

  <hr>

${CATEGORIES.map(section).join('\n')}

  <hr>

  <section id="coherence">
    <h2>الأربعة معاً</h2>
    <p class="section-lede">
      فيلم واحد يعرض الأربعة بالترتيب، بينها عناوين. هذا هو الفيلم الذي يُجيب عن سؤال المراجعة:
      هل تنتمي الأربعة إلى لغة واحدة؟
    </p>
    <video class="film" src="video/D2_COHERENCE_FOUR_CATEGORIES.mp4" controls preload="metadata" playsinline
           aria-label="فيلم الأربعة معاً"></video>
    <div class="stills" style="margin-block-start:26px">
      <figure style="width:100%;max-width:420px">
        <img src="frames/proof/D2_COHERENCE_GRID.png" alt="الأربعة في صورة واحدة: لكلٍّ منها ثلاث لحظات" loading="lazy">
        <figcaption>الأربعة في صورة واحدة: لكلٍّ منها ثلاث لحظات — قبل، وأثناء، وبعد أن يهدأ العالم.</figcaption>
      </figure>
    </div>
  </section>

  <hr>

  <section id="colour">
    <h2>لون الضوء</h2>
    <p class="section-lede">
      لون الضوء في هذه المرحلة أقرب إلى ضوء المصباح منه إلى لون الهويّة النحاسيّ. اخترناه ليبقى
      مختلفاً عن النحاس في كلّ درجاته، لا في أقواها وحدها: في الصورة أدناه شريطان يمثّلان الضوء
      وهو يشتدّ، وبينهما لون الهويّة. الشريط الأعلى هو اللون السابق، والأسفل هو المقترح.
    </p>
    <div class="stills">
      <figure style="width:100%;max-width:520px">
        <img src="frames/proof/D2_LIGHT_SEPARATION.png" alt="شريطان للضوء وهو يشتدّ، وبينهما لون الهويّة النحاسيّ" loading="lazy">
        <figcaption>العلامة الصغيرة تحت كلّ شريط هي أقرب موضع يقترب فيه الضوء من لون الهويّة.</figcaption>
      </figure>
    </div>
  </section>

  <hr>

  <section id="questions">
    <h2>ما نطلب رأيك فيه</h2>
    <p class="section-lede">
      سبعة أسئلة، وكلّها عن الإحساس لا عن التفاصيل. أمّا مقادير الضوء ومدد الحركة ودقائق
      الاستجابة فهي من صنعتنا، وقد حُسمت داخل هذه المرحلة.
    </p>
    <ol>
      ${QUESTIONS.map((q) => `<li>${q}</li>`).join('\n      ')}
    </ol>
  </section>
</div>

<script>
/* Autoplay is never set on these videos, so there is nothing to cancel — but if a future edit
   adds it, this removes it under a reduced-motion preference. CSS cannot cancel an autoplay. */
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const v of document.querySelectorAll('video')) { v.autoplay = false; v.pause(); }
}
</script>
</body>
</html>
`;
}

if (isMain(import.meta.url)) {
  mkdirSync(PKG, { recursive: true });
  const html = page();
  const out = join(PKG, 'D2_PRODUCT_OWNER_REVIEW_BOARD.html');
  writeFileSync(out, html);
  console.log('D2 BOARD');
  console.log(`  ${CATEGORIES.length} categories, ${CATEGORIES.reduce((a, c) => a + c.stills.length, 0)} stills, ${CATEGORIES.length * 2 + 1} films`);
  console.log(`  ${QUESTIONS.length} Product questions, no number and no English on the page`);
  console.log(`  wrote D2_PRODUCT_OWNER_REVIEW_BOARD.html (${Buffer.byteLength(html).toLocaleString()} bytes)`);
}

export { page };
