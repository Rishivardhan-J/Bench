// Fails on UI rules that Tailwind would otherwise silently ignore or that the design forbids.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SPACING = new Set([0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48, 56, 64, 80, 96, 120, 128, 160, 200, 256, 320]);
const SPACING_RE = /(?<![\w-])(?:-?)(?:p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy]|w|h|size|min-h|max-w|max-h|top|right|bottom|left|inset(?:-[xy])?)-(\d+(?:\.\d+)?)(?![\w%/.-])/g;
const RULES = [
  { name: 'shadow', re: /(?<![\w-])shadow(?:-[a-z0-9]+)?(?![\w-])/g },
  { name: 'gradient', re: /(?<![\w-])(?:bg-gradient-|from-|via-|to-(?!\w*(?:\[|\/)))[a-z0-9-]+/g },
  { name: 'default palette colour', re: /(?<![\w-])(?:text|bg|border|ring|fill|stroke)-(?:red|green|amber|yellow|orange|emerald|lime|rose|blue|sky|slate|gray|zinc|neutral|stone)-\d{2,3}/g },
  { name: 'arbitrary value', re: /(?<![\w-])(?:[a-z-]+:)*(?!has-\[)(?!content-\[)[a-z-]+-\[[^\]]+\]/g },
];
// Utilities that legitimately take numbers outside the spacing scale.
const SKIP_SPACING_PREFIX = /^(?:w|h|size|min-h|max-w|max-h|top|right|bottom|left|inset)-(?:1|2|3|4|5|6)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) yield p;
  }
}

const problems = [];
for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(import|\/\/)/.test(line)) return;
    for (const m of line.matchAll(SPACING_RE)) {
      const n = Number(m[1]);
      if (!SPACING.has(n) && !SKIP_SPACING_PREFIX.test(m[0].replace(/^-/, ''))) problems.push(`${file}:${i + 1} spacing "${m[0]}" is not on the scale`);
    }
    for (const rule of RULES) for (const m of line.matchAll(rule.re)) problems.push(`${file}:${i + 1} ${rule.name} "${m[0]}"`);
  });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} UI audit problem(s).`);
  process.exit(1);
}
console.log('UI audit passed.');
