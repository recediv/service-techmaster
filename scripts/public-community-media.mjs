import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const relative = path.relative(root, file); return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative); };

export async function prepareCommunityMedia({ projectRoot, sourceRoot, rows, manifest }) {
  const sourceReal = await fs.realpath(sourceRoot), entries = Object.values(manifest.assets), bySource = new Map(entries.filter(row => row.communitySourceSha256).map(row => [row.communitySourceSha256, row]));
  const map = new Map(), additions = [], writes = [], issues = [], seen = new Set();
  for (const row of rows) {
    const $ = cheerio.load([row.content, row.introtext].filter(Boolean).join('\n'), null, false);
    for (const element of $('img').toArray()) {
      const src = $(element).attr('src') || '', sourceSha256 = hash(src), owner = Number(row.id);
      if (seen.has(owner + ':' + sourceSha256)) continue; seen.add(owner + ':' + sourceSha256);
      if (bySource.has(sourceSha256)) {
        const existing = bySource.get(sourceSha256);
        if (!/^[a-f0-9]{24}\.(?:jpg|png|gif)$/.test(existing.id) || existing.url !== '/media/' + existing.id) throw new Error('An existing community image has an invalid content-hash identity.');
        map.set(src, existing); continue;
      }
      let bytes;
      try {
        if (/^https?:/i.test(src)) {
          let url; try { url = new URL(src); } catch { issues.push({ resourceId: owner, reason: 'malformed-empty-http-origin' }); continue; }
          // A specifically reviewed public photo was fetched separately without
          // cookies/referrer/credentials. Other remote URLs are never guessed.
          const proof = await fs.readFile(path.join(projectRoot, '.local/public-community-image-' + owner + '.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
          if (!proof || proof.sourceUrlSha256 !== sourceSha256) { issues.push({ resourceId: owner, reason: 'remote-image-not-locally-reviewed', provider: url.hostname }); continue; }
          bytes = await fs.readFile(path.join(projectRoot, '.local/public-community-image-' + owner + '.jpg'));
          if (hash(bytes) !== proof.sha256 || !proof.metadataStripped) throw new Error('The reviewed public image cache changed.');
        } else {
          let decoded; try { decoded = decodeURI(src); } catch { issues.push({ resourceId: owner, reason: 'invalid-image-encoding' }); continue; }
          if (/[\0\\?#]/.test(decoded) || decoded.startsWith('//') || decoded.split('/').some(part => part === '..' || part === '.') || /^(?:core|manager|connectors|api|admin|backup|backups)\//i.test(decoded.replace(/^\//,''))) { issues.push({ resourceId: owner, reason: 'non-public-image-path' }); continue; }
          const file = path.resolve(sourceReal, decoded.replace(/^\//,''));
          if (!inside(sourceReal, file)) { issues.push({ resourceId: owner, reason: 'image-path-outside-source' }); continue; }
          let real; try { real = await fs.realpath(file); } catch (error) { if (error.code === 'ENOENT') { issues.push({ resourceId: owner, reason: 'missing-public-image-file' }); continue; } throw error; }
          if (!inside(sourceReal, real)) { issues.push({ resourceId: owner, reason: 'image-symlink-outside-source' }); continue; }
          if (!/\.(?:jpe?g|png|gif|webp|avif|bmp)$/i.test(real)) { issues.push({ resourceId: owner, reason: 'unsupported-inline-image-format' }); continue; }
          bytes = await fs.readFile(real);
        }
        if (bytes.length > 10 * 1024 * 1024) { issues.push({ resourceId: owner, reason: 'oversized-inline-image' }); continue; }
        const input = sharp(bytes, { animated: true, limitInputPixels: 40000000 }), info = await input.metadata();
        if (!['jpeg','png','gif','webp','avif','heif'].includes(info.format)) { issues.push({ resourceId: owner, reason: 'invalid-inline-image-magic' }); continue; }
        const format = info.pages > 1 ? 'gif' : info.hasAlpha ? 'png' : 'jpg';
        const safe = format === 'gif' ? await input.gif().toBuffer() : format === 'png' ? await input.rotate().png().toBuffer() : await input.rotate().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
        const id = hash(safe).slice(0,24) + '.' + format;
        const asset = { id, url: '/media/' + id, bytes: safe.length, format, height: info.height, width: info.width, communityResourceId: owner, communitySourceSha256: sourceSha256 };
        additions.push(asset); bySource.set(sourceSha256, asset); map.set(src, asset); writes.push({ relative: 'public/media/' + id, bytes: safe });
      } catch (error) {
        if (error.message === 'The reviewed public image cache changed.') throw error;
        issues.push({ resourceId: owner, reason: 'unreadable-or-invalid-inline-image' });
      }
    }
  }
  const next = additions.length ? { ...manifest, assets: Array.isArray(manifest.assets) ? [...manifest.assets, ...additions] : { ...manifest.assets, ...Object.fromEntries(additions.map(row => [row.id,row])) } } : manifest;
  return { map, manifest: next, additions, writes, issues };
}
