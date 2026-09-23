'use strict';
// I-08B2.5 / build-svg.js
// Emits every SVG the package ships. All approved geometry is carried by
// verbatim copy of the I-08B2.3 masters' defs blocks -- no path data is
// re-emitted, re-rounded or redrawn anywhere in this file.
//
// Header comments deliberately avoid writing element names with angle brackets:
// in I-08B2.4 a header that did so made the identity verifier find the comment
// instead of the element.

const fs = require('fs');
const path = require('path');
const A = require('./assets');

const OUT = path.join(__dirname, '..', 'out');
const w = (rel, text) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
  return rel;
};

const written = [];
const emit = (rel, text) => {
  // XML forbids a double hyphen inside a comment. Chrome parses SVG loaded as
  // an image strictly, so one of these makes the whole document fail to parse
  // and the asset renders as nothing at all. Refuse to write such a file.
  for (const c of text.match(/<!--[\s\S]*?-->/g) || []) {
    if (c.slice(4, -3).includes('--')) {
      throw new Error(`${rel}: XML comment contains a double hyphen, which makes the file unparseable`);
    }
  }
  written.push(w(rel, text));
};

const PROV = `     Geometry: the APPROVED I-08B2.3 masters, unmodified. The defs block below
     is a verbatim copy of the approved master's own defs block. No path data is
     redrawn, re-rounded or re-ordered. Nothing is scaled non-uniformly.

     STATUS: I-08B2.5 production packaging. NOT a redesign. This file does not
     freeze any QANDEEL Brand colour token.`;

// ---------------------------------------------------------------------------
// 1. app icon -- canonical source artwork
// ---------------------------------------------------------------------------
// The frozen I-08B2.4 Variant B file is carried across byte-for-byte so that
// its hash still matches the frozen artefact. Its internal header predates the
// I-08B2.4 freeze; it is retained unedited rather than "corrected", and the
// manifest records that.
emit('app-icon/APP_ICON_B_DARK_LUMINOUS.svg', A.B24_B_TEXT);

// ---------------------------------------------------------------------------
// 2. app icon -- Android foreground at Android framing
// ---------------------------------------------------------------------------
// Same composition, same colours, same bloom and halo as Variant B. The only
// difference is the placement matrix: Android crops to its 72 dp viewport, so
// the mark is set to Android's documented 48 dp logo size to hold comparable
// perceived scale. The bloom and halo ride the same matrix, so the luminous
// treatment stays self-similar to the approved one.
function iconSVG(framing, title, note) {
  const m = `matrix(${framing.scale} 0 0 ${framing.scale} ${framing.tx} ${framing.ty})`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- QANDEEL App Icon ${title}
     I-08B2.5 production packaging of the frozen I-08B2.4 direction B DARK LUMINOUS.
${PROV}

     ${note} -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${A.CANVAS} ${A.CANVAS}" width="${A.CANVAS}" height="${A.CANVAS}" fill-rule="nonzero">
 <title>QANDEEL App Icon ${title}</title>
 <desc>The approved I-08B2.3 compact Q, unmodified, placed by a single uniform matrix over the approved Variant B ground, bloom and halo.</desc>
 <defs>
${A.G.defs.qBase}
  <radialGradient id="halo-q" gradientUnits="userSpaceOnUse" cx="${A.G.q.halo.cx}" cy="${A.G.q.halo.cy}" r="${A.G.q.halo.R}">
${A.G.q.halo.stops.map(s => `   <stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2]}"/>`).join('\n')}
  </radialGradient>
  <filter id="stroke-bloom" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
   <feGaussianBlur stdDeviation="${A.PAINT.bloomStdDev}" result="b"/>
   <feComponentTransfer in="b" result="s"><feFuncA type="linear" slope="${A.PAINT.bloomSlope.toFixed(2)}"/></feComponentTransfer>
   <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
 </defs>

 <rect id="icon-ground" x="0" y="0" width="${A.CANVAS}" height="${A.CANVAS}" fill="${A.PAINT.ground}"/>

 <g id="q-placement" transform="${m}">
  <g id="q-ink" fill="${A.PAINT.ink}" filter="url(#stroke-bloom)"><use href="#q-mark"/></g>
  <g id="q-light-core-tint" fill="${A.PAINT.coreTint}"><use href="#q-light-core"/></g>
 </g>

 <g id="q-halo" transform="${m}" style="mix-blend-mode:screen" opacity="${A.PAINT.haloOpacity.toFixed(2)}">
  <circle cx="${A.G.q.halo.cx}" cy="${A.G.q.halo.cy}" r="${A.G.q.halo.R}" fill="url(#halo-q)"/>
 </g>
</svg>
`;
}

emit('app-icon/android/source/ANDROID_FOREGROUND.svg', iconSVG(
  A.ANDROID_FRAMING,
  'B DARK LUMINOUS - Android adaptive foreground',
  `Android framing: the mark's enclosing circle is ${A.ANDROID.logoMinDp} dp on the 108 dp
     canvas. That is Android's documented minimum logo size, and the closest
     permitted value to perceptual parity with the square iOS never crops.
     Full bleed and opaque: the adaptive background layer is the identical flat
     ground colour, so parallax reveals only more of the same field.`));

// ---------------------------------------------------------------------------
// 3. monochrome derivatives
// ---------------------------------------------------------------------------
// One flat ink, authored as currentColor so it takes any single colour. The
// structural light-point core survives on its own geometry: it is a disc
// centred on the tail's inner terminus and standing clear of it inside the
// ring's counter, so it stays visible with glow and amber removed. Nothing is
// substituted for it.
function flatSVG(kind, opts) {
  const isQ = kind === 'q';
  const vb = isQ ? A.G.viewBox.q : A.G.viewBox.wm;
  const defs = isQ ? A.G.defs.qBase : A.G.defs.wmBase;
  const useId = isQ ? 'q-mark' : 'wordmark-geometry';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- QANDEEL ${opts.title}
     I-08B2.5 production derivative.
${PROV}

     ${opts.note} -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="${vb.join(' ')}" fill-rule="nonzero">
 <title>QANDEEL ${opts.title}</title>
 <desc>${opts.desc}</desc>
 <defs>
${defs}
 </defs>
 <g id="${opts.gid}" fill="currentColor" color="${opts.ink}">
  <use href="#${useId}"/>
 </g>
</svg>
`;
}

const MONO_NOTE = `Single flat ink. The light point is NOT replaced by a sparkle or a
     separate symbol: it is the approved structural core disc, carried unchanged,
     which reads on its own because it stands clear of the tail terminus inside
     the ring's counter. Geometry, tail, spacing and proportions are untouched.
     Paint is currentColor, so the mark inherits whatever single ink it is given;
     the declared colour is only the fallback.`;

const LIGHT_NOTE = `Light-background-safe treatment. This is the same approved identity,
     not a new visual style: only the ink value changes, to the approved dark
     neutral ground colour of the canonical app icon. No glow is carried, because
     a luminous treatment cannot read on a light field; the light point remains
     structurally present as its approved core disc. The file has no background
     of its own, so it composites onto any light surface.`;

emit('derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', flatSVG('q', {
  title: 'Q Compact - Monochrome', gid: 'q-monochrome', ink: A.PAINT.monoInk,
  desc: 'The approved compact Q in one flat ink, with the structural light-point core preserved.',
  note: MONO_NOTE,
}));
emit('derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME.svg', flatSVG('wm', {
  title: 'Wordmark - Monochrome', gid: 'wordmark-monochrome', ink: A.PAINT.monoInk,
  desc: 'The approved full wordmark in one flat ink, with both structural light-point cores preserved.',
  note: MONO_NOTE,
}));
emit('derivatives/light-background/QANDEEL_Q_LIGHT_BG.svg', flatSVG('q', {
  title: 'Q Compact - Light Background Safe', gid: 'q-light-bg', ink: A.PAINT.lightBgInk,
  desc: 'The approved compact Q in the approved dark neutral, for placement on light surfaces.',
  note: LIGHT_NOTE,
}));
emit('derivatives/light-background/QANDEEL_WORDMARK_LIGHT_BG.svg', flatSVG('wm', {
  title: 'Wordmark - Light Background Safe', gid: 'wordmark-light-bg', ink: A.PAINT.lightBgInk,
  desc: 'The approved full wordmark in the approved dark neutral, for placement on light surfaces.',
  note: LIGHT_NOTE,
}));

// ---------------------------------------------------------------------------
// 4. Android resource XML
// ---------------------------------------------------------------------------
// The monochrome (themed icon) layer IS portable to VectorDrawable: it carries
// no filter and no blend mode, so the approved path data goes across verbatim,
// placed by a group transform rather than by rewriting coordinates.
function vectorDrawable() {
  const f = A.ANDROID_FRAMING;
  const s = +(f.scale * A.ANDROID.canvasDp / A.CANVAS).toFixed(8);
  const tx = +(f.tx * A.ANDROID.canvasDp / A.CANVAS).toFixed(6);
  const ty = +(f.ty * A.ANDROID.canvasDp / A.CANVAS).toFixed(6);
  const p = A.G.q.ds;
  const one = (id, d) => `        <path\n            android:name="${id}"\n            android:fillColor="#FFFFFFFF"\n            android:fillType="nonZero"\n            android:pathData="${d}"/>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- QANDEEL themed / monochrome launcher layer.
     The approved I-08B2.3 Q path data, verbatim, placed by a group transform so
     no coordinate is rewritten. fillType is nonZero to match the masters: the
     ring and tail overlap, and a non-zero rule is what keeps that overlap solid.
     The system supplies the tint; the white here is only the untinted source. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:scaleX="${s}"
        android:scaleY="${s}"
        android:translateX="${tx}"
        android:translateY="${ty}">
${one('q-ring', p.ring)}
${one('q-tail', p.tail)}
${one('q-light-core', p.core)}
    </group>
</vector>
`;
}
emit('app-icon/android/res/drawable/ic_launcher_monochrome.xml', vectorDrawable());

const adaptive = round => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
`;
emit('app-icon/android/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive(false));
emit('app-icon/android/res/mipmap-anydpi-v26/ic_launcher_round.xml', adaptive(true));

emit('app-icon/android/res/values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>
<!-- The adaptive background layer. Variant B's ground is a flat colour, so the
     background needs no raster at all and cannot band. It is the exact same
     value as the field baked into the foreground layer, which is what makes the
     opaque foreground safe under parallax. -->
<resources>
    <color name="ic_launcher_background">${A.PAINT.ground}</color>
</resources>
`);

// ---------------------------------------------------------------------------
// 5. iOS asset catalogue index
// ---------------------------------------------------------------------------
emit('app-icon/ios/AppIcon.appiconset/Contents.json', JSON.stringify({
  images: A.IOS_CONTENTS.map(c => ({
    filename: `AppIcon-${c.px}.png`, idiom: c.idiom, scale: c.scale, size: c.size,
  })),
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');

if (require.main === module) {
  console.log('SVG / resource files written:');
  for (const f of written) console.log('  ' + f);
  console.log('\ncanonical framing', JSON.stringify(A.CANONICAL));
  console.log('android  framing', JSON.stringify(A.ANDROID_FRAMING));
}

module.exports = { written, OUT };
