import { StyleSheet } from 'react-native';
import type { QuickThemeColors } from '../lib/quickTheme';

const QUICK_CARD_TRACK_BTN_H = 36;
const QUICK_PAGER_DOTS_H = 34;
const QUICK_SECTION_LABEL_H = 32;
const QUICK_SCANNER_H = 48;
const QUICK_CARD_IDENTITY_H = 44;
const QUICK_CARD_INFO_H = 48;
const QUICK_CARD_MAP_H = 180;
const EMBEDDED_MAP_MIN_H = 120;
const QUICK_CARD_MAP_MIN_H = 120;
const LANDED_PHASE_GREEN = '#00C853';
const RED = '#FF3B30';

export type QuickStyles = ReturnType<typeof createQuickStyles>;

export function createQuickStyles(c: QuickThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bodyFlex: {
    flex: 1,
    minHeight: 0,
  },
  bodySplit: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionDepFill: {
    flex: 1,
    minHeight: 0,
  },
  sectionFill: {
    flex: 1,
    minHeight: 0,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bodyRadar: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    position: 'relative',
  },
  radarFill: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
  radarLookupOverlayHost: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  radarLookupOverlayTop: {
    flex: 0.28,
    minHeight: 72,
  },
  radarLookupOverlayPanel: {
    backgroundColor: c.bgOverlay,
    borderRadius: 12,
    padding: 12,
  },
  radarLookupOverlayBottom: {
    flex: 1,
  },
  section: {
    gap: 0,
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: QUICK_SECTION_LABEL_H,
    paddingRight: 2,
  },
  sectionLabel: {
    color: c.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    height: QUICK_SECTION_LABEL_H,
    lineHeight: QUICK_SECTION_LABEL_H,
  },
  sectionCount: {
    color: c.subtext,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionCapacityHint: {
    color: c.subtext,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionBody: {
    flexGrow: 1,
  },
  sectionBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  sectionBodyEmpty: {
    justifyContent: 'center',
  },
  sectionInputOnly: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  sectionPlaceholder: {
    width: '100%',
    borderWidth: 2,
    borderColor: c.accentBorder,
    borderRadius: 14,
    backgroundColor: c.card,
    paddingVertical: 20,
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'stretch',
  },
  sectionPanelWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: 8,
    borderWidth: 2,
    borderColor: c.accent,
    borderRadius: 14,
    backgroundColor: c.card,
  },
  sectionPanelInput: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.accentBorderFaint,
    gap: 4,
    flexShrink: 0,
  },
  cardSlot: {
    width: '100%',
    position: 'relative',
  },
  cardMapSlide: {
    position: 'relative',
    overflow: 'hidden',
  },
  cardMetaPanel: {
    flexShrink: 0,
    width: '100%',
  },
  pagerRoot: {
    width: '100%',
    flexDirection: 'column',
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  pagerRootFill: {
    flex: 1,
    minHeight: 0,
  },
  pagerMapClip: {
    width: '100%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  pagerMapClipFlex: {
    flex: 1,
    minHeight: QUICK_CARD_MAP_MIN_H,
    maxHeight: QUICK_CARD_MAP_H,
    flexShrink: 0,
  },
  pagerList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  pagerPage: {
    flexGrow: 0,
  },
  pagerDots: {
    height: QUICK_PAGER_DOTS_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
    paddingTop: 4,
    paddingBottom: 4,
  },
  pagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.dotInactive,
  },
  pagerDotFilled: {
    backgroundColor: c.accentDot,
  },
  pagerDotSlot: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.dotSlotBorder,
  },
  pagerDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
    borderWidth: 0,
  },
  placeholderHint: {
    color: c.subtext,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionInputTop: {
    width: '100%',
    marginBottom: 4,
  },
  inputShellEmpty: {
    width: '100%',
    gap: 6,
  },
  scanDivider: {
    height: QUICK_SCANNER_H,
    marginHorizontal: -20,
    marginTop: 2,
    marginBottom: 2,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: c.card,
  },
  scanBottomHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  quickTagline: {
    marginBottom: 12,
    alignItems: 'center',
  },
  quickTagline1: {
    fontSize: 16,
    color: c.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickTagline2: {
    fontSize: 12,
    color: c.subtext,
    fontWeight: '400',
    textAlign: 'center',
  },
  scanDividerBottom: {
    height: QUICK_SCANNER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: c.card,
  },
  scanTearLine: {
    width: 3,
    height: 24,
    backgroundColor: c.accent,
    borderRadius: 1,
  },
  scanCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanDividerTxt: {
    color: c.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footer: {
    alignItems: 'flex-start',
    paddingTop: 8,
    gap: 2,
    backgroundColor: c.background,
  },
  footerCopy: {
    color: c.subtext,
    fontSize: 11,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.accentBorderSoft,
    borderRadius: 10,
    backgroundColor: c.inputBg,
  },
  input: {
    flex: 1,
    backgroundColor: c.inputBg,
    borderWidth: 0,
    borderRadius: 10,
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    height: 36,
  },
  goBtn: {
    backgroundColor: c.accent,
    borderRadius: 10,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  goBtnDisabled: {
    opacity: 0.7,
  },
  goBtnTxt: {
    color: c.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  errorTxt: {
    color: RED,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.accent,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginTop: 8,
  },
  cardCompact: {
    padding: 8,
    marginTop: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  cardEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: 0,
  },
  cardFlowColumn: {
    flexDirection: 'column',
    width: '100%',
    position: 'relative',
  },
  cardIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 2,
    minHeight: QUICK_CARD_IDENTITY_H,
  },
  cardIdentityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardIdentityNumber: {
    color: c.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardIdentityRoute: {
    color: c.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  cardMapFlex: {
    flex: 1,
    minHeight: EMBEDDED_MAP_MIN_H,
    position: 'relative',
    overflow: 'hidden',
  },
  cardMapFixed: {
    width: '100%',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  cardMapTap: {
    ...StyleSheet.absoluteFill,
  },
  cardInfoRow: {
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
    minHeight: QUICK_CARD_INFO_H,
  },
  cardMetaStack: {
    gap: 2,
  },
  cardMetaStackFit: {
    gap: 0,
  },
  cardPhaseTime: {
    fontSize: 18,
    fontWeight: '600',
    color: c.accent,
  },
  cardPhaseTimeBoarding: {
    fontSize: 16,
  },
  cardTrackSlot: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  cardMetaFit: {
    marginTop: 0,
    gap: 0,
  },
  cardFooterEmbedded: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
  },
  cardMeta: {
    gap: 4,
  },
  cardMetaEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDismissEmbedded: {
    top: 4,
    right: 4,
    backgroundColor: c.bgOverlaySoft,
    borderRadius: 14,
  },
  cardPressCompact: {
    flexShrink: 0,
  },
  cardDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMapWrap: {
    marginHorizontal: -4,
    marginTop: 2,
    marginBottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeMapWrapEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: EMBEDDED_MAP_MIN_H,
    backgroundColor: c.background,
    width: '100%',
  },
  routeMapFill: {
    flex: 1,
    minHeight: EMBEDDED_MAP_MIN_H,
    width: '100%',
  },
  statusBlock: {
    marginTop: 4,
    gap: 2,
  },
  statusBlockCompact: {
    marginTop: 2,
    gap: 0,
  },
  statusHero: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusHeroCompact: {
    fontSize: 14,
  },
  statusHeroLarge: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 0,
  },
  statusHeroLargeCompact: {
    fontSize: 17,
  },
  statusSub: {
    color: c.subtext,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  statusSubCompact: {
    fontSize: 11,
  },
  cardNumber: {
    color: c.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardRoute: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  cardGate: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cardGateCompact: {
    fontSize: 12,
    marginTop: 0,
  },
  cardGateEmbedded: {
    flex: 1,
    marginTop: 0,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  statusPillEmbedded: {
    alignSelf: 'auto',
    marginTop: 0,
    flexShrink: 0,
  },
  statusPillTxt: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  trackBtnWrap: {
    width: '100%',
    marginTop: 0,
  },
  trackBtnWrapCompact: {
    marginTop: 4,
  },
  trackBtnWrapEmbedded: {
    marginTop: 0,
    width: '100%',
  },
  trackBtn: {
    width: '100%',
    height: QUICK_CARD_TRACK_BTN_H,
    borderRadius: 10,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBtnCompact: {
    height: QUICK_CARD_TRACK_BTN_H,
    borderRadius: 8,
  },
  trackBtnEmbedded: {
    height: QUICK_CARD_TRACK_BTN_H,
    borderRadius: 8,
  },
  trackBtnDotInline: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderWidth: 2,
    borderColor: c.text,
    backgroundColor: c.background,
  },
  trackBtnDotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 200, 83, 0.45)',
  },
  trackBtnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LANDED_PHASE_GREEN,
  },
  trackBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    width: '100%',
  },
  trackBtnActive: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.accent,
  },
  trackBtnTxt: {
    color: c.onAccent,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  trackBtnTxtCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  trackBtnTxtActive: {
    color: c.accent,
  },
  pickupSubTxt: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  transportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  transportBtn: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  transportBtnTxt: {
    color: c.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  });
}
