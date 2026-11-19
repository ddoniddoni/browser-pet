import korean from './locales/ko.json';

type Message = keyof typeof korean;
type WithValue = { [K in Message]: typeof korean[K] extends { placeholders: unknown } ? K : never }[Message];

interface ExtensionI18n {
  getMessage(key: string, value?: string): string;
  getUILanguage(): string;
}
const api = (globalThis as typeof globalThis & { chrome?: { i18n?: ExtensionI18n } }).chrome?.i18n;
const cache = new Map<Message, string>();

// Chrome이 지역 코드와 기본 언어를 처리한다. 확장 밖의 정적 견본은 한국어 원문을 쓴다.
export function t(key: Exclude<Message, WithValue>): string;
export function t(key: WithValue, value: string | number): string;
export function t(key: Message, value?: string | number) {
  if (value === undefined && cache.has(key)) return cache.get(key)!;
  const arg = value === undefined ? undefined : String(value);
  let result: string | undefined;
  try { result = arg === undefined ? api?.getMessage(key) : api?.getMessage(key, arg); } catch { /* 확장을 다시 로드한 직후의 옛 문서 */ }
  result ||= korean[key].message.replace(/\$value\$/g, () => arg ?? '');
  if (value === undefined) cache.set(key, result);
  return result;
}

// 지원하지 않는 Chrome 언어에서는 레이블과 시간 표기를 모두 기본 언어(영어)로 맞춘다.
export const uiLanguage = t('uiLanguage');
const chromeLocale = api?.getUILanguage().replace(/_/g, '-');
export const formatLocale = chromeLocale?.split('-')[0] === uiLanguage ? chromeLocale : uiLanguage;
