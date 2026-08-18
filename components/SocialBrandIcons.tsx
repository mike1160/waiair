import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { QuickSharePlatform } from '../lib/flightQuickShare';

type IconProps = { size?: number };

function WhatsAppIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.15 2 11.07c0 1.78.52 3.45 1.42 4.88L2 22l6.28-1.35A9.93 9.93 0 0 0 12 20.14C17.52 20.14 22 16 22 11.07 22 6.15 17.52 2 12 2Zm0 17.5a8.1 8.1 0 0 1-4.12-1.12l-.3-.18-3.73.8.79-3.63-.19-.31A8.08 8.08 0 0 1 3.9 11.07C3.9 7.2 7.5 4.1 12 4.1s8.1 3.1 8.1 6.97-3.6 8.43-8.1 8.43Z"
        fill="#fff"
      />
      <Path
        d="M16.6 13.9c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.18-1.38-1.32-1.62-.14-.24-.02-.36.1-.48.1-.1.24-.26.36-.4.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
        fill="#fff"
      />
    </Svg>
  );
}

function InstagramIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="2" />
      <Circle cx="12" cy="12" r="4.2" stroke="#fff" strokeWidth="2" />
      <Circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
    </Svg>
  );
}

function TikTokIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.6 5.2c.7 1.4 1.8 2.4 3.2 2.8v2.8c-1.2-.04-2.3-.4-3.2-1V14c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.3 0 .6 0 .9.1v3a2.1 2.1 0 0 0-.9-.2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2V5.2h2Z"
        fill="#fff"
      />
      <Path
        d="M17.8 6.8c-.4-.1-.8-.3-1.1-.6V8c.7.3 1.3.8 1.8 1.4V6.8Z"
        fill="#FE2C55"
      />
      <Path
        d="M18.5 10.2c-.5-.3-1-.5-1.6-.6v2.4c0 2.2-1.8 4-4 4-.7 0-1.3-.2-1.9-.5"
        stroke="#25F4EE"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function FacebookIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 8.5H17V5.5h-2.5C11.8 5.5 10 7.4 10 10v2H7.5v3H10v7h3.5v-7h2.8l.5-3H13.5v-1.8c0-.9.2-1.2 1-1.2Z"
        fill="#fff"
      />
    </Svg>
  );
}

function XIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4l16 16M20 4 4 20"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LineIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgText x="3.5" y="16" fill="#fff" fontSize="8.5" fontWeight="800" letterSpacing="0.5">
        LINE
      </SvgText>
    </Svg>
  );
}

function WeChatIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 5C5.5 5 3 6.9 3 9.2c0 1.3.7 2.5 1.8 3.3L4 15l2.8-.9c.7.2 1.5.3 2.3.3 3 0 5.5-1.9 5.5-4.2S11.5 5 8.5 5Z"
        fill="#fff"
      />
      <Path
        d="M16 9.5c2.8 0 5 1.8 5 4.1 0 1.2-.7 2.3-1.8 3l.7 2.3-2.4-.8c-.6.2-1.3.3-2 .3-2.8 0-5-1.8-5-4.1s2.2-4.1 5-4.1Z"
        fill="#fff"
        opacity={0.92}
      />
    </Svg>
  );
}

function XiaohongshuIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="16" height="16" rx="4" fill="#fff" />
      <SvgText x="6.2" y="15.2" fill="#FF2442" fontSize="7" fontWeight="800">
        小红书
      </SvgText>
    </Svg>
  );
}

function WeiboIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.5 8.5c-2.8.4-5 2.4-4.9 4.5.1 1.6 1.5 2.8 3.5 3.1-2.2.6-3.8 2-3.4 3.6.5 2 3.4 2.8 6.5 1.9 3-.9 4.9-3.1 4.4-5.1-.4-1.5-2-2.6-4.1-2.9 1.9-.8 3.1-2.2 2.8-3.6-.4-1.8-2.6-3-5.8-2.5Z"
        fill="#fff"
      />
      <Circle cx="17.5" cy="7" r="2.2" fill="#fff" />
      <Circle cx="17.5" cy="7" r="1" fill="#E6162D" />
    </Svg>
  );
}

function DouyinIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.8 5.5c.8 1.2 2 2 3.4 2.2v2.4c-1-.04-1.9-.3-2.6-.8v5.2c0 2.6-2.1 4.7-4.7 4.7S7.2 17 7.2 14.4s2.1-4.7 4.7-4.7c.4 0 .8 0 1.1.1v2.6a2.2 2.2 0 0 0-1-.2c-1.2 0-2.1 1-2.1 2.2s1 2.2 2.1 2.2 2.1-1 2.1-2.2V5.5h2.7Z"
        fill="#fff"
      />
      <Path d="M16.8 7.2c-.3-.2-.6-.4-1-.5v1.4c.6.2 1.1.6 1.5 1V7.2Z" fill="#FE2C55" />
      <Path
        d="M17.2 10.8c-.4-.2-.8-.4-1.3-.5"
        stroke="#25F4EE"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function KakaoTalkIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4C7.6 4 4 6.8 4 10.3c0 2.1 1.4 4 3.5 5.1L6.8 18l2.6-.9c.8.2 1.6.3 2.6.3 4.4 0 8-2.8 8-6.3S16.4 4 12 4Z"
        fill="#3C1E1E"
      />
      <SvgText x="8.8" y="13.2" fill="#3C1E1E" fontSize="6.5" fontWeight="800">
        TALK
      </SvgText>
    </Svg>
  );
}

function TelegramIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 4.2 4.8 11c-.9.4-.9 1.6.1 1.9l3.9 1.2 1.5 4.7c.3.9 1.5 1 2 .2l2.2-3.2 4.5 3.3c.8.6 2 .1 2.2-.9L22 5.8c.2-1-.7-1.8-1.5-1.6Z"
        fill="#fff"
      />
      <Path d="M9.5 13.2 17.8 7.5" stroke="#26A5E4" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

function VkIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.8 16.8h1.4c.3 0 .5-.1.6-.4.6-1.9 2.6-3.5 4.5-3.2.3 0 .5-.2.5-.5l-.1-2.1c0-.3-.2-.5-.5-.5-1.8-.1-3.3.9-4.4 2.3-.2.3-.5.3-.7 0-.8-1.2-2-2-3.5-2-2.6 0-4.7 2.1-4.7 4.7v.3c0 .3.2.5.5.5h1.8c.3 0 .5-.2.6-.5.3-1 .9-1.7 1.8-1.7.5 0 .8.3.8.9v2.4c0 .3.2.5.5.5h2.3Z"
        fill="#fff"
      />
    </Svg>
  );
}

function ZaloIcon({ size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4C7.6 4 4 6.9 4 10.5c0 2 1.5 3.8 3.7 4.8L6.8 18l3-.8c.7.1 1.4.2 2.2.2 4.4 0 8-2.9 8-6.5S16.4 4 12 4Z"
        fill="#fff"
      />
      <SvgText x="9.2" y="13.5" fill="#0068FF" fontSize="7" fontWeight="800">
        Z
      </SvgText>
    </Svg>
  );
}

export function SocialBrandIcon({
  platform,
  size = 22,
}: {
  platform: QuickSharePlatform;
  size?: number;
}) {
  switch (platform) {
    case 'whatsapp':
      return <WhatsAppIcon size={size} />;
    case 'instagram':
      return <InstagramIcon size={size} />;
    case 'tiktok':
      return <TikTokIcon size={size} />;
    case 'facebook':
      return <FacebookIcon size={size} />;
    case 'x':
      return <XIcon size={size} />;
    case 'line':
      return <LineIcon size={size} />;
    case 'wechat':
      return <WeChatIcon size={size} />;
    case 'xiaohongshu':
      return <XiaohongshuIcon size={size} />;
    case 'weibo':
      return <WeiboIcon size={size} />;
    case 'douyin':
      return <DouyinIcon size={size} />;
    case 'kakaotalk':
      return <KakaoTalkIcon size={size} />;
    case 'telegram':
      return <TelegramIcon size={size} />;
    case 'vk':
      return <VkIcon size={size} />;
    case 'zalo':
      return <ZaloIcon size={size} />;
    default:
      return null;
  }
}

export function InstagramGradientBg({ size = 44 }: { size?: number }) {
  const id = 'igGrad';
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#833AB4" />
          <Stop offset="0.5" stopColor="#FD1D1D" />
          <Stop offset="1" stopColor="#FCB045" />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
