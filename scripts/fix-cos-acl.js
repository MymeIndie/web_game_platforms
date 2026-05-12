/**
 * 기존 업로드된 COS 게임 파일에 public-read ACL 일괄 적용
 * 실행: docker exec -w /app wgp-api-dev node /app/scripts/fix-cos-acl.js
 */
const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const Bucket = process.env.COS_BUCKET;
const Region = process.env.COS_REGION || 'ap-seoul';

async function listAndFixAcl() {
  let marker = '';
  let totalFixed = 0;

  while (true) {
    const result = await new Promise((resolve, reject) =>
      cos.getBucket({ Bucket, Region, Marker: marker, MaxKeys: 100 }, (err, data) =>
        err ? reject(err) : resolve(data)
      )
    );

    const keys = result.Contents.map(c => c.Key);

    for (const key of keys) {
      await new Promise((resolve) =>
        cos.putObjectAcl({ Bucket, Region, Key: key, ACL: 'public-read' }, (err) => {
          if (err) console.warn(`  ⚠ ${key}: ${err.message}`);
          else { console.log(`  ✅ ${key}`); totalFixed++; }
          resolve();
        })
      );
    }

    if (result.IsTruncated === 'false' || !result.NextMarker) break;
    marker = result.NextMarker;
  }

  console.log(`\n✅ 완료: ${totalFixed}개 파일 ACL 수정됨`);
}

listAndFixAcl().catch(console.error);
