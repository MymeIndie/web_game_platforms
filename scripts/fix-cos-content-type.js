/**
 * 기존 COS 파일의 Content-Type을 올바르게 재설정
 * 실행: docker exec -w /app wgp-api-dev node /app/scripts/fix-cos-content-type.js
 */
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const Bucket = process.env.COS_BUCKET;
const Region = process.env.COS_REGION || 'ap-seoul';

const CONTENT_TYPE_MAP = {
  '.html':      'text/html',
  '.js':        'application/javascript',
  '.css':       'text/css',
  '.json':      'application/json',
  '.png':       'image/png',
  '.jpg':       'image/jpeg',
  '.jpeg':      'image/jpeg',
  '.gif':       'image/gif',
  '.webp':      'image/webp',
  '.svg':       'image/svg+xml',
  '.wasm':      'application/wasm',
  '.woff':      'font/woff',
  '.woff2':     'font/woff2',
  '.ttf':       'font/ttf',
  '.mp3':       'audio/mpeg',
  '.ogg':       'audio/ogg',
  '.wav':       'audio/wav',
  '.mp4':       'video/mp4',
  '.webm':      'video/webm',
  '.data':      'application/octet-stream',
  '.unityweb':  'application/octet-stream',
  '.ico':       'image/x-icon',
  '.manifest':  'application/manifest+json',
  '.webmanifest': 'application/manifest+json',
};

function getContentType(key) {
  const ext = path.extname(key).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

async function fixContentTypes() {
  let marker = '';
  let totalFixed = 0;

  while (true) {
    const result = await new Promise((resolve, reject) =>
      cos.getBucket({ Bucket, Region, Marker: marker, MaxKeys: 100 }, (err, data) =>
        err ? reject(err) : resolve(data)
      )
    );

    for (const obj of result.Contents) {
      const key = obj.Key;
      const contentType = getContentType(key);

      // COS copy trick: copy object over itself to change metadata
      await new Promise((resolve) =>
        cos.putObjectCopy({
          Bucket,
          Region,
          Key: key,
          CopySource: `${Bucket}.cos.${Region}.myqcloud.com/${key}`,
          MetadataDirective: 'Replaced',
          ContentType: contentType,
          ACL: 'public-read',
        }, (err) => {
          if (err) console.warn(`  ⚠ ${key}: ${err.message}`);
          else { console.log(`  ✅ ${key} → ${contentType}`); totalFixed++; }
          resolve();
        })
      );
    }

    if (result.IsTruncated === 'false' || !result.NextMarker) break;
    marker = result.NextMarker;
  }

  console.log(`\n✅ 완료: ${totalFixed}개 파일 Content-Type 수정됨`);
}

fixContentTypes().catch(console.error);
