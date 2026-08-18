import { Linking, Platform, Share } from 'react-native';
import { getLocale, type Locale } from './i18n';
import { tryRequire } from './safeNative';

export type QuickSharePlatform =
  | 'whatsapp'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'line'
  | 'wechat'
  | 'xiaohongshu'
  | 'weibo'
  | 'douyin'
  | 'kakaotalk'
  | 'telegram'
  | 'vk'
  | 'zalo';

export type PlatformMeta = {
  label: string;
  bg: string;
  gradient?: [string, string, string];
};

const LOCALE_PLATFORMS: Partial<Record<Locale, QuickSharePlatform[]>> = {
  th: ['line', 'facebook', 'tiktok', 'whatsapp'],
  zh: ['wechat', 'xiaohongshu', 'douyin', 'weibo'],
  ja: ['line', 'x', 'instagram', 'tiktok'],
  ko: ['kakaotalk', 'instagram', 'tiktok', 'x'],
  ru: ['telegram', 'vk', 'whatsapp', 'tiktok'],
  vi: ['zalo', 'facebook', 'tiktok', 'line'],
};

const DEFAULT_PLATFORMS: QuickSharePlatform[] = [
  'whatsapp',
  'instagram',
  'tiktok',
  'facebook',
];

export const PLATFORM_META: Record<QuickSharePlatform, PlatformMeta> = {
  whatsapp: { label: 'WhatsApp', bg: '#25D366' },
  instagram: {
    label: 'Instagram',
    bg: '#833AB4',
    gradient: ['#833AB4', '#FD1D1D', '#FCB045'],
  },
  tiktok: { label: 'TikTok', bg: '#000000' },
  facebook: { label: 'Facebook', bg: '#1877F2' },
  x: { label: 'X', bg: '#000000' },
  line: { label: 'Line', bg: '#06C755' },
  wechat: { label: 'WeChat', bg: '#07C160' },
  xiaohongshu: { label: 'RED', bg: '#FF2442' },
  weibo: { label: 'Weibo', bg: '#E6162D' },
  douyin: { label: 'Douyin', bg: '#000000' },
  kakaotalk: { label: 'KakaoTalk', bg: '#FAE100' },
  telegram: { label: 'Telegram', bg: '#26A5E4' },
  vk: { label: 'VK', bg: '#0077FF' },
  zalo: { label: 'Zalo', bg: '#0068FF' },
};

/** Lazy-loaded — avoids crash when native module is missing. */
const SocialFallback = {
  Whatsapp: 'whatsapp',
  Instagram: 'instagram',
  Facebook: 'facebook',
  Twitter: 'twitter',
  Telegram: 'telegram',
} as const;

type ShareSingleSocial =
  | typeof SocialFallback[keyof typeof SocialFallback]
  | string;

type RNShareLike = {
  open: (opts: Record<string, unknown>) => Promise<unknown>;
  shareSingle: (opts: Record<string, unknown>) => Promise<unknown>;
};

let rnShareMod: RNShareLike | null | undefined;
let rnSocial: typeof SocialFallback | Record<string, string> = SocialFallback;

function loadRNShare(): RNShareLike | null {
  if (rnShareMod !== undefined) return rnShareMod;
  const mod = tryRequire<{ default?: RNShareLike; Social?: Record<string, string> }>('react-native-share');
  if (mod?.default?.open && mod?.default?.shareSingle) {
    rnShareMod = mod.default;
    if (mod.Social) rnSocial = mod.Social;
  } else {
    rnShareMod = null;
  }
  return rnShareMod;
}

function prettyFlightNumber(n: string): string {
  const s = String(n || '').replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : (n || '').trim();
}

function formatShareDate(iso: string): string {
  if (!iso) return '';
  try {
    const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export function getQuickSharePlatforms(): QuickSharePlatform[] {
  return LOCALE_PLATFORMS[getLocale()] ?? DEFAULT_PLATFORMS;
}

export function buildFlightShareMessage(
  data: {
    flightNumber: string;
    originIata: string;
    destIata: string;
    dateIso: string;
  },
  status?: string,
): string {
  const number = prettyFlightNumber(data.flightNumber);
  const route = `${data.originIata} → ${data.destIata}`;
  const date = formatShareDate(data.dateIso);
  const statusPart = status?.trim() ? ` · ${status.trim()}` : '';
  const datePart = date ? `${date}${statusPart}` : status?.trim() || '';
  const tail = datePart ? `${datePart} · Track at waiair.app` : 'Track at waiair.app';
  return `✈️ ${number} ${route}\n${tail}`;
}

function shareUri(imageUri: string): string {
  if (Platform.OS === 'android' && !imageUri.startsWith('file://')) {
    return `file://${imageUri}`;
  }
  return imageUri;
}

async function openCoreShareSheet(imageUri: string, message: string): Promise<void> {
  const url = shareUri(imageUri);
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { url, message }
        : { message, url },
    );
  } catch {
    await Share.share({ message });
  }
}

async function openNativeShareSheet(imageUri: string, message: string): Promise<void> {
  const share = loadRNShare();
  if (share) {
    try {
      await share.open({
        url: shareUri(imageUri),
        message,
        type: 'image/png',
        failOnCancel: false,
      });
      return;
    } catch { /* fall through to core Share */ }
  }
  await openCoreShareSheet(imageUri, message);
}

async function shareSingleWithImage(
  social: ShareSingleSocial,
  imageUri: string,
  message: string,
): Promise<void> {
  const share = loadRNShare();
  if (share) {
    try {
      await share.shareSingle({
        social,
        url: shareUri(imageUri),
        message,
        type: 'image/png',
      });
      return;
    } catch { /* fall through */ }
  }
  await openCoreShareSheet(imageUri, message);
}

async function openTextScheme(url: string): Promise<void> {
  await Linking.openURL(url);
}

async function tryPlatformShare(
  platform: QuickSharePlatform,
  imageUri: string,
  message: string,
): Promise<boolean> {
  switch (platform) {
    case 'whatsapp':
      await shareSingleWithImage(rnSocial.Whatsapp ?? SocialFallback.Whatsapp, imageUri, message);
      return true;
    case 'instagram':
      await shareSingleWithImage(rnSocial.Instagram ?? SocialFallback.Instagram, imageUri, message);
      return true;
    case 'facebook':
      await shareSingleWithImage(rnSocial.Facebook ?? SocialFallback.Facebook, imageUri, message);
      return true;
    case 'x':
      await shareSingleWithImage(rnSocial.Twitter ?? SocialFallback.Twitter, imageUri, message);
      return true;
    case 'telegram':
      await shareSingleWithImage(rnSocial.Telegram ?? SocialFallback.Telegram, imageUri, message);
      return true;
    case 'line':
      await openTextScheme(`line://msg/text/${encodeURIComponent(message)}`);
      return true;
    case 'tiktok':
      await openTextScheme('tiktok://');
      return true;
    case 'wechat':
      await openTextScheme(`weixin://dl/chat?${encodeURIComponent(message)}`);
      return true;
    case 'xiaohongshu':
      await openTextScheme('xhsdiscover://');
      return true;
    case 'douyin':
      await openTextScheme('snssdk1128://');
      return true;
    case 'weibo':
      await openTextScheme(`sinaweibo://share?content=${encodeURIComponent(message)}`);
      return true;
    case 'kakaotalk':
      await openTextScheme(`kakaotalk://send?text=${encodeURIComponent(message)}`);
      return true;
    case 'vk':
      await openTextScheme(`vk://share?text=${encodeURIComponent(message)}`);
      return true;
    case 'zalo':
      await openTextScheme(`zalo://share?text=${encodeURIComponent(message)}`);
      return true;
    default:
      return false;
  }
}

export async function shareFlightToPlatform(
  platform: QuickSharePlatform,
  imageUri: string,
  message: string,
): Promise<void> {
  try {
    await tryPlatformShare(platform, imageUri, message);
  } catch {
    await openNativeShareSheet(imageUri, message);
  }
}

export async function shareFlightMore(imageUri: string, message: string): Promise<void> {
  await openNativeShareSheet(imageUri, message);
}
