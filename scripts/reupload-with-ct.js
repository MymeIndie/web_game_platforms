/**
 * COS 파일을 getObject → putObject 방식으로 Content-Type 재설정
 * 실행: docker exec -w /app wgp-api-dev node /app/scripts/reupload-with-ct.js
 */
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const Bucket = process.env.COS_BUCKET;
const Region = process.env.COS_REGION || 'ap-seoul';

const CT_MAP = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.json':        'application/json',
  '.wasm':        'application/wasm',
  '.data':        'application/octet-stream',
  '.unityweb':    'application/octet-stream',
  '.png':         'image/png',
  '.jpg':         'image/jpeg',
  '.jpeg':        'image/jpeg',
  '.ico':         'image/x-icon',
  '.svg':         'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.manifest':    'application/manifest+json',
};

function getCT(key) {
  const ext = path.extname(key).toLowerCase();
  return CT_MAP[ext] || 'application/octet-stream';
}

function getObject(key) {
  return new Promise((resolve, reject) =>
    cos.getObject({
      Bucket, Region, Key: key,
    }, (err, data) => {
      if (err) return reject(err);
      resolve(Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body));
    })
  );
}

function putObject(key, body, contentType) {
  return new Promise((resolve, reject) =>
    cos.putObject({
      Bucket, Region, Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    }, (err) => err ? reject(err) : resolve())
  );
}

async function run() {
  const list = await new Promise((resolve, reject) =>
    cos.getBucket({ Bucket, Region, MaxKeys: 200 }, (err, data) =>
      err ? reject(err) : resolve(data.Contents)
    )
  );

  for (const obj of list) {
    const key = obj.Key;
    const ct = getCT(key);
    try {
      const body = await getObject(key);
      await putObject(key, body, ct);
      console.log(`✅ ${key}\n   → ${ct}`);
    } catch (e) {
      console.warn(`⚠ ${key}: ${e.message}`);
    }
  }
  console.log('\n✅ 모든 파일 Content-Type 재설정 완료');
}

run().catch(console.error);
