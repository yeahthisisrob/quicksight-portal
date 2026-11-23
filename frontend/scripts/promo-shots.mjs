/**
 * File: promo-shots.mjs
 * Purpose: Film the promo's stills from Storybook: the real pages over the stories' made-up account.
 *
 * Each scene opens a story, takes a still, does what a person would do (a click, a sort, a pick) and takes the next
 * one. Beside each still it records where the pointer goes next (the centre of what is about to be pressed) and any
 * rows to light up, so a video editor can move a pointer and a highlight over stills that are the portal itself.
 *
 *   pnpm --filter @quicksight-portal/frontend run storybook          (in another terminal)
 *   node frontend/scripts/promo-shots.mjs <stills dir> <manifest.json> [scene ids...]
 *
 * STORYBOOK_URL overrides http://localhost:6006. Nothing here reads an account: stories only.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { chromium } from 'playwright';

const [outDir, manifestPath, ...only] = process.argv.slice(2);
if (!outDir || !manifestPath) {
  console.error('usage: node promo-shots.mjs <stills dir> <manifest.json> [scene ids...]');
  process.exit(1);
}
const BASE = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
const VIEW = { width: 1920, height: 1080 };
const SETTLE_MS = 650;

const centre = (box) => ({
  x: Math.round(box.x + box.width / 2),
  y: Math.round(box.y + box.height / 2),
});

/** The scenes, in the order the promo shows them. */
const SCENES = [
  {
    id: 'dashboards',
    run: async ({ page, go, shot, rows, rest }) => {
      await go('pages-assets--dashboards');
      await rows();
      const activity = page.getByRole('columnheader', { name: 'Activity' });
      await shot({ next: activity });
      await activity.click();
      await page.waitForTimeout(600);
      await activity.click();
      await rest();
      const chip = page
        .getByRole('row', { name: /Sales overview/ })
        .first()
        .locator('[data-field="activity"] .MuiChip-root')
        .first();
      await shot({ next: chip });
      await chip.click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(1200);
      await shot();
    },
  },
  {
    id: 'datasets',
    run: async ({ page, go, shot, rows, rest }) => {
      await go('pages-assets--datasets');
      await rows();
      const row = page.getByRole('row', { name: /orders_gold/ }).first();
      const id = await row.getAttribute('data-id');
      const menu = row.locator('[data-field="actions"] button');
      await shot({ next: menu });
      await menu.click();
      const edit = page.getByRole('menuitem', { name: 'Edit Source' });
      await edit.waitFor();
      await shot({ next: edit });
      await edit.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Data source').waitFor();
      await dialog.getByLabel('Data source').click();
      await page.getByRole('option', { name: /Redshift/ }).click();
      const save = dialog.getByRole('button', { name: 'Save' });
      await shot({ next: save });
      await save.click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('.MuiDataGrid-virtualScroller').evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await rest();
      await shot({
        marks: page.locator(`.MuiDataGrid-row[data-id="${id}"] [data-field="sourceType"]`),
      });
    },
  },
  {
    id: 'json',
    run: async ({ page, go, shot, rows }) => {
      await go('pages-assets--dashboards');
      await rows();
      await page
        .getByRole('row', { name: /Sales overview/ })
        .first()
        .locator('[data-field="actions"] button')
        .click();
      const view = page.getByRole('menuitem', { name: 'View JSON' });
      await view.waitFor();
      await shot({ next: view });
      await view.click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(2500);
      await page.getByRole('tab', { name: 'Definition' }).click();
      await page.waitForTimeout(1500);
      await shot();
    },
  },
  {
    id: 'archive',
    run: async ({ page, go, shot, rows, rest }) => {
      await go('pages-assets--dashboards');
      await rows();
      await page.getByRole('columnheader', { name: 'Activity' }).click();
      await rest();
      for (const name of [
        /Holiday promo recap/,
        /Kiosk pilot results/,
        /Regional scorecard \(old\)/,
      ]) {
        await page.getByRole('row', { name }).getByRole('checkbox').check();
      }
      await rest();
      const remove = page.getByRole('button', { name: /Delete/ });
      await shot({ next: remove });
      await remove.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByLabel(/Reason for deletion/).fill('No views in over a year');
      await dialog.getByPlaceholder('Type confirmation text here').fill('DELETE 3 ASSETS');
      const confirm = dialog.getByRole('button', { name: 'Delete Assets' });
      await shot({ next: confirm });
      await confirm.click();
      await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
      await page.waitForTimeout(4000);
      await rest();
      await shot();
      await go('pages-operations--archived-assets');
      await rows();
      await shot();
    },
  },
  {
    id: 'timeline',
    run: async ({ page, go, shot }) => {
      await go('pages-activity--default');
      const json = page.getByRole('button', { name: 'Stored event JSON' }).nth(1);
      await shot({ next: json });
      await json.click();
      await page.getByRole('dialog').waitFor();
      await shot();
    },
  },
  {
    id: 'lineage',
    run: async ({ page, go, shot }) => {
      await go('pages-data-catalog--calculated-field-open');
      const open = page.getByRole('button', { name: 'Open the dependency chain full screen' });
      await shot({ next: open });
      await open.click();
      await page.getByRole('dialog').waitFor();
      await shot();
    },
  },
  {
    id: 'assistant',
    run: async ({ page, go, shot }) => {
      await go('features-author-assistant-chat--wireframe');
      await page.getByRole('dialog').waitFor();
      await shot();
      await go('features-author-assistant-chat--plan');
      await shot({ next: page.getByRole('button', { name: /Looks right, run it/ }).first() });
      await go('features-author-assistant-chat--actions-run');
      await shot();
    },
  },
  {
    id: 'parity',
    run: async ({ page, go, shot }) => {
      await go('pages-aws-parity--default');
      await shot({ marks: page.locator('button[aria-expanded]') });
    },
  },
];

async function film(browser, scene) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const shots = [];
  const go = async (story) => {
    await page.goto(`${BASE}/iframe.html?id=${story}&viewMode=story&globals=theme:dark`, {
      waitUntil: 'networkidle',
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
  };
  /** The table has its rows. */
  const rows = async () => {
    await page.locator('.MuiDataGrid-row').first().waitFor();
    await page.waitForTimeout(SETTLE_MS);
  };
  /** Take the mouse off what it last pressed, so no tooltip is in the still. */
  const rest = async () => {
    await page.mouse.move(VIEW.width * 0.55, VIEW.height - 12);
    await page.waitForTimeout(900);
  };
  const shot = async ({ next, marks } = {}) => {
    await page.waitForTimeout(SETTLE_MS);
    const file = `${scene.id}-${shots.length + 1}.jpg`;
    const entry = { img: `${basename(outDir)}/${file}` };
    if (next) {
      entry.cursor = centre(await next.boundingBox());
    }
    if (marks) {
      const boxes = await marks.evaluateAll((els) =>
        els.map((el) => {
          const r = (el.matches('button') ? (el.parentElement ?? el) : el).getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })
      );
      entry.marks = boxes.map((b) => ({
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.w),
        h: Math.round(b.h),
      }));
    }
    await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 93 });
    shots.push(entry);
    console.log(`  ${file}`);
  };
  try {
    await scene.run({ page, go, shot, rows, rest });
  } finally {
    await context.close();
  }
  return { id: scene.id, shots };
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const scenes = [];
try {
  for (const scene of SCENES) {
    if (only.length && !only.includes(scene.id)) continue;
    console.log(scene.id);
    scenes.push(await film(browser, scene));
  }
} finally {
  await browser.close();
}
await writeFile(manifestPath, `${JSON.stringify({ viewport: VIEW, scenes }, null, 1)}\n`);
console.log(`${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.shots.length, 0)} stills`);
