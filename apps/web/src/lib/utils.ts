export function getCdnUrl(key: string): string {
  const cdnDomain = process.env.NEXT_PUBLIC_CDN_URL;
  if (cdnDomain) return `${cdnDomain}/${key}`;
  const bucket = process.env.NEXT_PUBLIC_COS_BUCKET;
  const region = process.env.NEXT_PUBLIC_COS_REGION || "ap-seoul";
  if (bucket) return `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
  return `/${key}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
