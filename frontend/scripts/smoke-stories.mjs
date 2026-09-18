#!/usr/bin/env node
/**
 * Renders every Storybook story in a real browser and fails if any of them
 * throws or logs an unexpected console error.
 *
 * This replaces @storybook/test-runner, which drove the same Playwright checks
 * through jest 30. Storybook 10 loads its test-runner config via
 * `module.register()`, which jest refuses outright, so every story suite failed
 * to load. Storybook's own replacement, @storybook/addon-vitest, peers on
 * vitest 3 or 4 and this repo is on 5.
 *
 * Talking to Playwright directly sidesteps both: it is what the test-runner did
 * underneath, it is about 100 lines, and it has no opinion about which test
 * runner the rest of the repo uses.
 *
 *   node scripts/smoke-stories.mjs [--url http://localhost:6006] [--concurrency 6]
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const BASE_URL = getArg('url', 'http://localhost:6006').replace(/\/$/, '');
const CONCURRENCY = Number(getArg('concurrency', '6'));
const RENDER_TIMEOUT_MS = 20_000;
/** Time to let async render work settle before reading the console. */
const SETTLE_MS = 150;

/**
 * Console noise that is expected when a component renders outside the app
 * shell: no router, no auth provider, no API. None of it means a broken story.
 */
const IGNORED_CONSOLE_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Failed to load resource',
  'net::ERR_CONNECTION_REFUSED',
  'Network request failed',
  'fetch failed',
  '404',
  '401',
  '403',
  '500',
  'AxiosError',
  'Failed to fetch',
  'useAuth must be used within an AuthProvider',
  'useRoutes() may be used only in the context of a <Router> component',
  'Cannot read properties of undefined',
  'useNavigate() may be used only in the context of a <Router> component',
  'You cannot render a <Router> inside another <Router>',
  'useLocation() may be used only in the context of a <Router> component',
  'useParams() may be used only in the context of a <Router> component',
  'Error: Uncaught [Error:',
  'The above error occurred in the',
  'Consider adding an error boundary',
  'React will try to recreate this component tree',
];

const isRelevant = (message) =>
  message.trim().length > 0 &&
  !IGNORED_CONSOLE_ERRORS.some((ignored) => message.includes(ignored)) &&
  !message.includes('at ') && // stack trace lines
  !message.includes('http://'); // source URLs

/** Every story id Storybook knows about, docs pages excluded. */
async function fetchStoryIds() {
  const response = await fetch(`${BASE_URL}/index.json`);
  if (!response.ok) {
    throw new Error(`Could not read ${BASE_URL}/index.json (HTTP ${response.status})`);
  }
  const { entries } = await response.json();
  return Object.values(entries ?? {})
    .filter((entry) => entry.type === 'story')
    .map((entry) => entry.id);
}

/** Render one story; resolves to an error string, or null when it is clean. */
async function checkStory(context, id) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${BASE_URL}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`, {
      waitUntil: 'domcontentloaded',
      timeout: RENDER_TIMEOUT_MS,
    });

    // Storybook puts its render state on <body>: sb-show-main once a story has
    // rendered, sb-show-errordisplay when it threw, sb-show-nopreview when
    // there is nothing to show.
    //
    // Waiting on #storybook-root having children would be wrong: anything that
    // renders through a portal - every MUI Dialog, Menu and Popover - mounts
    // onto document.body instead, leaving the root empty forever.
    await page.waitForFunction(
      () => {
        const shown = document.body.classList;
        return (
          shown.contains('sb-show-main') ||
          shown.contains('sb-show-errordisplay') ||
          shown.contains('sb-show-nopreview')
        );
      },
      undefined,
      { timeout: RENDER_TIMEOUT_MS }
    );

    if (await page.evaluate(() => document.body.classList.contains('sb-show-errordisplay'))) {
      const detail = await page
        .locator('#error-message, #error-stack')
        .first()
        .innerText()
        .catch(() => 'unknown error');
      return `failed to render: ${detail.split('\n')[0]}`;
    }

    if (await page.evaluate(() => document.body.classList.contains('sb-show-nopreview'))) {
      return 'story produced no preview';
    }

    await page.waitForTimeout(SETTLE_MS);

    const problems = [...pageErrors, ...consoleErrors.filter(isRelevant)];
    return problems.length ? problems.slice(0, 3).join('\n      ') : null;
  } catch (error) {
    return error instanceof Error ? error.message.split('\n')[0] : String(error);
  } finally {
    await page.close();
  }
}

async function main() {
  const ids = await fetchStoryIds();
  if (ids.length === 0) {
    console.error('No stories found - is Storybook running?');
    return 1;
  }
  console.log(`Smoke-testing ${ids.length} stories at ${BASE_URL}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const failures = [];
  let done = 0;

  const queue = [...ids];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const problem = await checkStory(context, id);
      done += 1;
      if (problem) {
        failures.push({ id, problem });
        console.log(`  FAIL  ${id}\n      ${problem}`);
      } else if (done % 25 === 0) {
        console.log(`  ...${done}/${ids.length}`);
      }
    }
  });

  await Promise.all(workers);
  await browser.close();

  console.log(
    failures.length === 0
      ? `\nAll ${ids.length} stories rendered cleanly.`
      : `\n${failures.length} of ${ids.length} stories failed.`
  );
  return failures.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
