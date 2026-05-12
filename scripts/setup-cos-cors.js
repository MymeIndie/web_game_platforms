/**
 * 텐센트 COS CORS 자동 설정 스크립트
 * 실행: docker exec -w /app wgp-api-dev node /app/scripts/setup-cos-cors.js
 */
// 환경변수는 Docker container에서 이미 주입됨

const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;

if (!bucket || !region) {
  console.error('❌ COS_BUCKET 또는 COS_REGION 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const corsRules = [
  {
    AllowedOrigin: ['http://localhost:3002', 'http://localhost:3000', 'https://*.pages.dev'],
    AllowedMethod: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedHeader: ['*'],
    ExposeHeader: ['ETag', 'Content-Length'],
    MaxAgeSeconds: '600',
  },
];

cos.putBucketCors(
  {
    Bucket: bucket,
    Region: region,
    CORSRules: corsRules,
  },
  (err, data) => {
    if (err) {
      console.error('❌ CORS 설정 실패:', err.message || err);
      process.exit(1);
    }
    console.log('✅ CORS 설정 완료!');
    console.log('   버킷:', bucket);
    console.log('   리전:', region);
    console.log('   허용 출처:', corsRules[0].AllowedOrigin.join(', '));
    console.log('\n이제 게임 파일 업로드가 가능합니다.');
  }
);
