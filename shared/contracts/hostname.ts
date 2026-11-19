export const maxHiddenHosts = 200;

// URL 전체를 받지 않는다. IDN과 IP 주소는 Chrome의 URL 정규화 결과를 사용한다.
export function normalizeHostname(input: unknown): string | null {
  if (typeof input !== 'string' || !input || input.length > 1024 ||
      /[\s\p{Cc}\\/?#@%*]/u.test(input) || (input.includes(':') && !/^\[[\da-f:.]+\]$/i.test(input))) return null;
  try {
    const host = new URL('https://' + input).hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host.length > 253) return null;
    if (host.startsWith('[')) return host;
    return host.split('.').every(label => label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))
      ? host : null;
  } catch {
    return null;
  }
}
