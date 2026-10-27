import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// This check uses an existing local Puppeteer/Chrome installation. It never
// downloads a browser and blocks every request outside the selected origin.
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:3000');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'QA_ORIGIN must be a loopback URL.');
const base = target.pathname.replace(/\/$/, '');
const toUrl = route => target.origin + base + route;
const representative = process.argv.includes('--representative');
const directory = path.resolve(root, process.env.QA_REPORT_DIR || '.local/qa-navigation');
assert(directory.startsWith(path.join(root, '.local') + path.sep), 'QA_REPORT_DIR must be inside .local/.');
await fs.mkdir(directory, { recursive: true });
const routes = JSON.parse(await fs.readFile(path.join(root, 'data/generated/routes.json'), 'utf8')).routes;
const errors = [], failed = [], external = [], rsc = [], checks = [], blockedProviderFrames = [];
let documentRequests = 0;
let browser;

try {
  const launch = { headless: 'new', args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps'] };
  if (process.env.QA_CHROME) launch.executablePath = process.env.QA_CHROME;
  else if (process.platform === 'win32') launch.executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await puppeteer.launch(launch);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const attach = async (tab, { documents = false } = {}) => {
    await tab.setRequestInterception(true);
    tab.on('request', request => {
      const url = new URL(request.url());
      if (['data:', 'blob:'].includes(url.protocol) || url.origin === target.origin) {
        if (documents && request.isNavigationRequest() && request.frame() === tab.mainFrame()) documentRequests++;
        request.continue();
      } else if (url.origin === 'https://my.livesklad.com' && url.pathname === '/static/widget.html' && request.isNavigationRequest() && request.frame() !== tab.mainFrame()) {
        // Check only the original frame contract here. This loopback-only suite
        // never sends order lookups or project data to the external provider.
        blockedProviderFrames.push('livesklad-public-widget'); request.abort();
      } else { external.push({ origin: url.origin, type: request.resourceType() }); request.abort(); }
    });
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (response.status() >= 400 && !pathname.includes('/__qa-missing-page__/')) failed.push({ path: pathname, status: response.status() });
      if (pathname.endsWith('.txt') && pathname !== base + '/robots.txt') rsc.push({ path: pathname, status: response.status(), contentType: response.headers()['content-type'] });
    });
  };
  await attach(page, { documents: true });
  await page.evaluateOnNewDocument(() => {
    const qa = window.__siteQa = { marker: Math.random().toString(36), ready: [], transitions: 0, activeTransitions: 0, completedTransitions: 0, rejectedTransitions: 0, transitionDurations: [], leaving: 0, entering: 0, shellChecks: 0, motionFrames: 0, violations: [], checkingMotion: false };
    const violation = message => { if (!qa.violations.includes(message)) qa.violations.push(message); };
    const changesOpacityOrTransform = animation => {
      if (!['running', 'pending'].includes(animation.playState) && !animation.pending) return false;
      const frames = animation.effect?.getKeyframes?.() || [];
      return ['opacity', 'transform', 'translate', 'scale', 'rotate'].some(property => {
        const values = frames.filter(frame => property in frame).map(frame => String(frame[property]));
        return values.length > 1 && new Set(values).size > 1;
      });
    };
    qa.motionAnimations = () => {
      const content = document.querySelector('.site-page-content');
      return content ? content.getAnimations().filter(changesOpacityOrTransform) : [];
    };
    qa.checkShell = () => {
      if (!qa.shell) return;
      qa.shellChecks++;
      const { header, footer } = qa.shell;
      if (!header || document.querySelector('header.header') !== header || !header.isConnected) violation('The header DOM node was replaced or removed.');
      if (!footer || document.querySelector('footer.footer') !== footer || !footer.isConnected) violation('The footer DOM node was replaced or removed.');
      const content = document.querySelector('.site-page-content');
      if (content?.contains(header) || content?.contains(footer)) violation('The persistent shell is inside the animated content.');
      if (getComputedStyle(document.documentElement).viewTransitionName !== 'none') violation('The document root still participates in whole-root View Transitions.');
      const targets = new Set();
      for (const shell of [header, footer]) for (let element = shell; element; element = element.parentElement) targets.add(element);
      for (const element of targets) {
        const style = getComputedStyle(element);
        if (Number(style.opacity) !== 1) violation('The shell or its ancestor faded: ' + element.tagName.toLowerCase() + '.' + element.className);
        if ((element === header || element === footer) && style.viewTransitionName !== 'none') violation('A shell node has a View Transition name.');
        // Named content pseudo-elements are attached to html by the browser;
        // they do not animate html itself. The root name check above excludes
        // whole-root snapshots, while computed opacity covers real ancestors.
        for (const animation of element.getAnimations()) {
          if (animation.effect?.target !== element || animation.effect?.pseudoElement || element === document.documentElement && qa.activeTransitions) continue;
          if (changesOpacityOrTransform(animation)) violation('The shell or its ancestor has an opacity/transform animation: ' + element.tagName.toLowerCase() + '.' + element.className);
        }
      }
    };
    addEventListener('site:route-ready', event => {
      qa.ready.push(event.detail);
      qa.shell ||= { header: document.querySelector('header.header'), footer: document.querySelector('footer.footer') };
      qa.checkShell();
    });
    if (document.startViewTransition) {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args) => {
        qa.transitions++; const started = performance.now();
        const transition = original(...args); qa.activeTransitions++;
        transition.ready.then(() => qa.checkShell(), () => {});
        transition.finished.then(() => { qa.completedTransitions++; }, () => { qa.rejectedTransitions++; }).finally(() => {
          qa.activeTransitions--; qa.transitionDurations.push(Math.round(performance.now() - started)); qa.checkShell();
        });
        return transition;
      };
    }
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type !== 'attributes') continue;
        if (record.target.classList.contains('site-route-leaving')) qa.leaving++;
        if (record.target.classList.contains('site-route-entering')) qa.entering++;
      }
    }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
    const frame = () => {
      if (qa.checkingMotion || qa.activeTransitions || document.querySelector('.site-route-leaving,.site-route-entering')) { qa.motionFrames++; qa.checkShell(); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
  await page.goto(toUrl('/'), { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__siteQa.ready.length > 0);
  assert.equal(await page.$eval('.site-page-content', element => getComputedStyle(element).viewTransitionName), 'site-content', 'Native View Transitions must name only the page content.');
  const initial = await page.evaluate(() => ({ marker: window.__siteQa.marker }));
  const initialDocuments = documentRequests;
  assert.equal(rsc.length, 0, 'The initial page must not prefetch every catalog link.');

  async function waitForMotion() {
    // Allow effects queued after React's route-ready effect to start, then wait
    // for native finished promises and actual content animations/classes.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => window.__siteQa.activeTransitions === 0 && !document.querySelector('.site-route-leaving,.site-route-entering') && window.__siteQa.motionAnimations().length === 0, { timeout: 15000, polling: 'raf' });
    const state = await page.evaluate(() => {
      const qa = window.__siteQa; qa.checkShell(); qa.checkingMotion = false;
      const content = document.querySelector('.site-page-content');
      return { violations: qa.violations, contentPresent: !!content, contentOpacity: content && getComputedStyle(content).opacity, contentTransform: content && getComputedStyle(content).transform, rejectedTransitions: qa.rejectedTransitions, transitionDurations: qa.transitionDurations };
    });
    assert(state.contentPresent, 'The animated .site-page-content wrapper is missing.');
    assert.equal(state.contentOpacity, '1', 'The content did not return to full opacity.');
    assert.equal(state.contentTransform, 'none', 'The content retained an animation transform.');
    assert.equal(state.rejectedTransitions, 0, 'A native View Transition was rejected or skipped.');
    assert(state.transitionDurations.every(milliseconds => milliseconds < 2000), 'A local static View Transition stalled for 2 seconds or more: ' + state.transitionDurations.join(', ') + 'ms.');
    assert.deepEqual(state.violations, [], 'Persistent shell animation/replacement: ' + state.violations.join(' '));
  }

  async function clickPath(route) {
    const expected = new URL(toUrl(route)).href;
    const before = await page.evaluate(() => { window.__siteQa.checkingMotion = true; return window.__siteQa.ready.length; });
    const handles = await page.$$('a[href]');
    let clicked = false;
    for (const handle of handles) {
      if (await handle.evaluate((element, href) => element.href === href, expected)) {
        const hit = await handle.evaluate(element => {
          element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
          const top = document.elementFromPoint(x, y);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0' && (top === element || element.contains(top));
        });
        if (hit) {
          await pause(80);
          await handle.click(); clicked = true; break;
        }
      }
    }
    await Promise.all(handles.map(handle => handle.dispose()));
    assert(clicked, 'No visible clickable link to ' + route);
    await page.waitForFunction((href, count) => location.href === href && window.__siteQa.ready.length > count,
      { timeout: 15000 }, expected, before);
    await waitForMotion();
    assert(await page.$('h1,[role="heading"][aria-level="1"],#widget_iframe'), 'No source heading or status widget after navigation to ' + route);
    assert.equal(await page.evaluate(() => !!document.querySelector('.site-route-leaving,.site-route-entering')), false);
    checks.push({ action: 'click', path: route });
  }

  await clickPath('/services/remont-sotovyh/');
  await clickPath('/info/articles/');
  const indexUrl = page.url();
  const detail = representative ? '/info/o-kompanii/' : await page.$eval('.editorial-card__title a[href]', element => new URL(element.href).pathname);
  // Prefix is already supplied by toUrl; use a path from the data for the full
  // check rather than derive slugs from visible article titles.
  const detailPath = base && detail.startsWith(base + '/') ? detail.slice(base.length) : detail;
  await clickPath(detailPath);
  const detailUrl = page.url();
  const beforeBack = await page.evaluate(() => { window.__siteQa.checkingMotion = true; return window.__siteQa.ready.length; });
  await page.goBack();
  await page.waitForFunction((href, before) => location.href === href && window.__siteQa.ready.length > before, { timeout: 15000 }, indexUrl, beforeBack);
  await waitForMotion();
  assert.equal(await page.evaluate(() => window.__siteQa.marker), initial.marker, 'Back reloaded the Document.');
  checks.push({ action: 'back', path: new URL(indexUrl).pathname });
  const beforeForward = await page.evaluate(() => { window.__siteQa.checkingMotion = true; return window.__siteQa.ready.length; });
  await page.goForward();
  await page.waitForFunction((href, before) => location.href === href && window.__siteQa.ready.length > before, { timeout: 15000 }, detailUrl, beforeForward);
  await waitForMotion();
  assert.equal(await page.evaluate(() => window.__siteQa.marker), initial.marker, 'Forward reloaded the Document.');
  checks.push({ action: 'forward', path: new URL(detailUrl).pathname });

  const normalTransitions = await page.evaluate(() => window.__siteQa.transitions);
  assert(normalTransitions >= 3, 'View Transition was not used for normal client navigation.');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const beforeReduced = await page.evaluate(() => ({ transitions: window.__siteQa.transitions, leaving: window.__siteQa.leaving, entering: window.__siteQa.entering }));
  await clickPath('/info/contacts/');
  const reduced = await page.evaluate(() => ({ transitions: window.__siteQa.transitions, leaving: window.__siteQa.leaving, entering: window.__siteQa.entering, bodyTransition: getComputedStyle(document.body).transitionDuration, contentTransition: getComputedStyle(document.querySelector('.site-page-content')).transitionDuration, contentAnimation: getComputedStyle(document.querySelector('.site-page-content')).animationName }));
  assert.equal(reduced.transitions, beforeReduced.transitions, 'Reduced motion still started a View Transition.');
  assert.equal(reduced.leaving, beforeReduced.leaving, 'Reduced motion still faded out the document.');
  assert.equal(reduced.entering, beforeReduced.entering, 'Reduced motion still animated incoming content.');
  assert.equal(reduced.bodyTransition, '0s');
  assert(reduced.contentTransition.split(',').every(value => Number.parseFloat(value) === 0), 'Reduced motion still has a content transition.');
  assert(reduced.contentAnimation.split(',').every(value => value.trim() === 'none'), 'Reduced motion still has a content animation.');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluate(() => { document.startViewTransition = undefined; });
  const beforeFallback = await page.evaluate(() => ({ leaving: window.__siteQa.leaving, entering: window.__siteQa.entering }));
  await clickPath('/');
  assert(await page.evaluate(() => window.__siteQa.leaving) > beforeFallback.leaving, 'Outgoing content fallback was not exercised.');
  assert(await page.evaluate(() => window.__siteQa.entering) > beforeFallback.entering, 'Incoming content fallback was not exercised.');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).opacity), '1');
  const shellMain = await page.evaluate(() => ({ shellChecks: window.__siteQa.shellChecks, motionFrames: window.__siteQa.motionFrames, completedTransitions: window.__siteQa.completedTransitions, rejectedTransitions: window.__siteQa.rejectedTransitions, transitionDurations: window.__siteQa.transitionDurations, violations: window.__siteQa.violations }));
  assert(shellMain.motionFrames > 0 && shellMain.shellChecks > 0, 'Persistent shell was not inspected during animation frames.');
  const clientDocumentRequests = documentRequests - initialDocuments;
  assert.equal(clientDocumentRequests, 0, 'Client clicks or history triggered a Document request.');
  assert.equal(await page.evaluate(() => window.__siteQa.marker), initial.marker);
  await page.screenshot({ path: path.join(directory, 'home-after-client-navigation.png') });

  // Next must preserve a slash after a resource slug containing a dot, rather
  // than interpreting the resource as a downloadable file with an extension.
  const dottedParent = '/services/remont-avtomagnitol/prology/';
  const dottedDetail = dottedParent + 'cdp-8.0-kraken/';
  const parentResponse = await page.goto(toUrl(dottedParent), { waitUntil: 'networkidle0' });
  assert.equal(parentResponse.status(), 200);
  const dottedHref = await page.evaluate((expected) => [...document.querySelectorAll('a[href]')].some(element => element.getAttribute('href') === expected), base + dottedDetail);
  assert(dottedHref, 'A dotted resource slug lost its canonical trailing slash.');
  const dottedMarker = await page.evaluate(() => window.__siteQa.marker);
  const beforeDottedDocuments = documentRequests;
  await clickPath(dottedDetail);
  assert.equal(documentRequests, beforeDottedDocuments, 'A dotted resource link reloaded the Document.');
  assert.equal(await page.evaluate(() => window.__siteQa.marker), dottedMarker);
  assert.equal(new URL(page.url()).pathname, base + dottedDetail);
  const shellDotted = await page.evaluate(() => ({ shellChecks: window.__siteQa.shellChecks, motionFrames: window.__siteQa.motionFrames, completedTransitions: window.__siteQa.completedTransitions, rejectedTransitions: window.__siteQa.rejectedTransitions, transitionDurations: window.__siteQa.transitionDurations, violations: window.__siteQa.violations }));

  const noJs = await browser.newPage();
  await noJs.setJavaScriptEnabled(false);
  await noJs.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await attach(noJs);
  const encodedPaths = routes.filter(route => route.path.includes(',') || [...route.path].some(character => character.charCodeAt(0) > 127)).map(route => route.path);
  const directPaths = [...new Set([...new Set(routes.map(route => route.type))].map(type => routes.find(route => route.type === type).path).concat('/info/articles/page-2/', dottedDetail, ...encodedPaths))];
  for (const route of directPaths) {
    const response = await noJs.goto(toUrl(route), { waitUntil: 'networkidle0' });
    assert.equal(response.status(), 200, 'Direct URL failed: ' + route);
    assert.equal(await noJs.$('.site-not-found'), null, 'Canonical URL contains a not-found fallback: ' + route);
    const visible = await noJs.$eval('h1,[role="heading"][aria-level="1"],#widget_iframe', element => {
      const rect = element.getBoundingClientRect();
      const content = element.closest('.site-page-content');
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(document.body).opacity === '1' && content && getComputedStyle(content).opacity === '1' && getComputedStyle(content).visibility !== 'hidden';
    });
    assert(visible, 'Initial HTML is hidden without JS: ' + route);
    checks.push({ action: 'direct-no-js', path: route });
  }
  const missing = await noJs.goto(toUrl('/__qa-missing-page__/'), { waitUntil: 'networkidle0' });
  assert.equal(missing.status(), 404, 'Unknown URL returned a soft 404.');
  assert(await noJs.$('h1'));
  checks.push({ action: '404', path: '/__qa-missing-page__/' });
  assert.equal(errors.length, 0, 'Browser exceptions: ' + JSON.stringify(errors));
  assert.equal(failed.length, 0, 'Failed resources: ' + JSON.stringify(failed));
  assert.equal(external.length, 0, 'The site attempted external requests: ' + JSON.stringify(external));
  assert(rsc.length > 0 && rsc.every(item => item.status === 200 && item.contentType?.startsWith('text/plain')), 'RSC navigation did not receive text/plain static data.');
  const result = { origin: target.origin + base, representative, success: true, checks, newDocumentRequests: clientDocumentRequests, dottedSlugDocumentRequests: documentRequests - beforeDottedDocuments, windowPreserved: true, normalViewTransitions: normalTransitions, reducedMotion: reduced, fallbackCrossfade: true, persistentShell: { headerSameNode: true, footerSameNode: true, wholeRootViewTransition: false, main: shellMain, dotted: shellDotted }, rscRequests: rsc.length, errors, failed, external };
  await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify({ origin: target.origin + base, representative, success: false, checks, errors, failed, external, error: error.message }, null, 2));
  console.error(error.stack);
  process.exitCode = 1;
} finally { await browser?.close(); }
