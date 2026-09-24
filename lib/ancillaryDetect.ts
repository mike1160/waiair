/**
 * The extras bought alongside a flight — a heavier bag, a wheelchair, a special meal, wifi, an upgrade, the
 * dog in the hold — recognised from a confirmation's own words.
 *
 * Detect only: this says what a mail, a scanned code or a pasted text is about, and nothing more. None of it
 * is imported or attached to a trip, so the app can say "we saw this" without pretending to understand it.
 * One detector serves all three ways in (Gmail scan, scanner, paste), so they can never disagree.
 *
 * Pure — no React Native, no network, no storage — and every rule is unit-tested in ancillaryDetect.test.ts.
 */

export type AncillaryKind =
  | 'extraBaggage'
  | 'specialAssistance'
  | 'mealOrder'
  | 'inflightPurchase'
  | 'cabinUpgrade'
  | 'petReservation';

/** What the confirmation said, as far as it can be read from the subject or the pasted text. */
export type AncillaryFields = {
  /** Hold or cabin, for a bag. */
  bagType?: 'hold' | 'cabin';
  /** The allowance in kilograms, when the text names one. */
  weightKg?: number;
  /** Wheelchair, boarding help, an unaccompanied minor, medical equipment. */
  assistanceType?: string;
  /** The IATA meal code (VGML, KSML, HNML …). */
  mealCode?: string;
  purchaseType?: 'dutyfree' | 'wifi' | 'entertainment' | 'other';
  fromCabin?: 'economy' | 'premium_economy';
  toCabin?: 'premium_economy' | 'business' | 'first';
  petLocation?: 'cabin' | 'cargo';
  /** Dog, cat, and so on — only when the text says. */
  petType?: string;
  /** The flight the extra belongs to, e.g. "TG208". */
  flightRef?: string;
};

export type AncillaryHit = { kind: AncillaryKind; fields: AncillaryFields };

/**
 * Lower case, accents dropped, punctuation flattened to single spaces. Thai, Japanese, Korean, Chinese,
 * Russian and Arabic pass through unchanged, so their keywords match as plain substrings.
 */
export function foldText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/*
 * The words that name each extra, in every language the app ships plus the ones a traveller's airline may
 * write in anyway (French, Italian, Portuguese, Arabic). These are detection strings, not interface text:
 * reading a French confirmation costs nothing, while translating the app into French is a separate decision.
 *
 * Order matters. The first kind whose word appears wins, so the most specific phrases per kind come first,
 * and a bare word that hides inside another ("bag" in "baggage", "pet" in "competition") is never used.
 */
const KEYWORDS: [AncillaryKind, string[]][] = [
  ['extraBaggage', [
    'extra baggage', 'additional baggage', 'baggage allowance', 'extra bag', 'bag fee', 'hold luggage',
    'excess baggage', 'baggage upgrade', 'extra luggage',
    'extra bagage', 'ruimbagage', 'handbagage upgrade', 'bagage toegevoegd',
    'zusatzgepack', 'zusatzgepäck', 'extra-gepack', 'extra-gepäck', 'ubergepack', 'übergepäck',
    'equipaje adicional', 'equipaje extra',
    'bagasi tambahan',
    '手荷物追加', '超過手荷物', '受託手荷物の追加',
    '추가 수하물', '위탁 수하물 추가',
    '额外行李', '托运行李', '行李额度',
    'สัมภาระเพิ่มเติม', 'น้ำหนักกระเป๋าเพิ่ม',
    'дополнительный багаж', 'сверхнормативный багаж',
    'hành lý thêm', 'hành lý ký gửi thêm',
    'bagage supplementaire', 'bagaglio supplementare', 'bagagem extra',
    'أمتعة إضافية',
  ]],
  ['cabinUpgrade', [
    'upgrade confirmed', 'upgrade is confirmed', 'upgrade has been confirmed', 'upgrade successful',
    'upgrade request has been accepted', 'bid upgrade accepted',
    'congratulations on your upgrade', 'business class upgrade', 'premium economy upgrade',
    'upgrade to business', 'upgrade to first', 'cabin upgrade', 'seat upgrade confirmed',
    'upgrade bevestigd', 'gefeliciteerd met uw upgrade', 'gefeliciteerd met je upgrade',
    'upgrade naar business',
    'upgrade bestatigt', 'upgrade bestätigt', 'business class upgrade bestatigt',
    'mejora confirmada', 'upgrade confirmado',
    'peningkatan kelas dikonfirmasi', 'upgrade kelas',
    'アップグレード確定', 'ビジネスクラスへのアップグレード', 'アップグレードが確定',
    '업그레이드 확인', '업그레이드 확정',
    '升舱确认', '升级成功', '升舱成功',
    'อัปเกรดที่นั่ง', 'ยืนยันการอัปเกรด',
    'повышение класса подтверждено', 'апгрейд подтвержден',
    'nâng hạng được xác nhận', 'xác nhận nâng hạng',
    'surclassement confirme', 'upgrade confermato', 'upgrade confirmada',
    'تمت ترقية',
  ]],
  ['petReservation', [
    'pet reservation', 'pet booking', 'pet in cabin', 'pet in cargo',
    'traveling with pet', 'travelling with pet',
    'animal transport confirmed', 'pet booking confirmed', 'pet travel confirmed',
    'huisdier aan boord', 'huisdier bevestigd', 'reizen met huisdier',
    'haustier im flugzeug', 'tierbeforderung', 'tierbeförderung', 'haustier bestatigt', 'haustier bestätigt',
    'mascota confirmada', 'viajar con mascota',
    'hewan peliharaan dikonfirmasi', 'terbang dengan hewan peliharaan',
    'ペット同伴', 'ペットの予約',
    '반려동물 예약', '반려동물 동반',
    '宠物预订确认', '携带宠物',
    'สัตว์เลี้ยงบนเครื่อง', 'ยืนยันสัตว์เลี้ยง',
    'перевозка животного', 'бронирование питомца',
    'thú cưng được xác nhận', 'mang theo thú cưng',
    'animal de compagnie confirme', 'animale confermato', 'animal de estimacao confirmado',
    'حجز الحيوان',
  ]],
  ['specialAssistance', [
    'special assistance', 'special request confirmed', 'wheelchair', 'unaccompanied minor',
    'medical equipment', 'assistance confirmed', 'boarding assistance',
    'speciale assistentie', 'rolstoel', 'bijzondere hulp', 'begeleiding bevestigd',
    'sonderwunsch', 'rollstuhl', 'besondere hilfe', 'betreuung bestatigt', 'betreuung bestätigt',
    'asistencia especial', 'silla de ruedas',
    'bantuan khusus', 'kursi roda',
    '特別介助', '車椅子', 'お手伝いが必要',
    '특별 지원', '휠체어',
    '特殊协助', '轮椅',
    'ความช่วยเหลือพิเศษ', 'วีลแชร์', 'รถเข็น',
    'специальная помощь', 'инвалидная коляска',
    'hỗ trợ đặc biệt', 'xe lăn',
    'assistance speciale', 'assistenza speciale', 'assistencia especial',
    'مساعدة خاصة',
  ]],
  ['mealOrder', [
    'meal preference', 'special meal', 'meal request confirmed', 'inflight meal', 'in-flight meal',
    'meal confirmed', 'dietary request',
    'maaltijdkeuze', 'speciale maaltijd', 'maaltijd bevestigd',
    'sondermenu', 'sondermenü', 'mahlzeit bestatigt', 'mahlzeit bestätigt', 'bordverpflegung',
    'comida especial', 'menu especial confirmado',
    'makanan khusus', 'pilihan makanan',
    '機内食', '特別機内食', '機内食のリクエスト',
    '기내식', '특별 기내식',
    '特殊餐食', '机内餐', '特别餐',
    'อาหารพิเศษ', 'ยืนยันอาหาร',
    'специальное питание', 'выбор питания',
    'suất ăn đặc biệt', 'bữa ăn đặc biệt',
    'repas special', 'pasto speciale', 'refeicao especial',
    'وجبة خاصة',
  ]],
  ['inflightPurchase', [
    'inflight purchase', 'in-flight purchase', 'duty free order', 'duty-free order', 'wifi voucher',
    'onboard wifi', 'on-board wifi', 'inflight wifi', 'inflight entertainment', 'onboard purchase',
    'in-flight aankoop', 'duty-free bestelling', 'duty free bestelling', 'wifi aan boord',
    'bordkauf', 'wlan an bord', 'duty-free bestellung',
    'compra a bordo', 'wifi a bordo',
    'pembelian dalam penerbangan', 'wifi dalam penerbangan',
    '機内販売', '機内wi-fi', '機内購入',
    '기내 판매', '기내 와이파이',
    '机上购物', '机上wifi', '免税预订',
    'ซื้อสินค้าบนเครื่อง', 'ไวไฟบนเครื่อง',
    'покупка на борту', 'wi-fi на борту',
    'mua sắm trên chuyến bay', 'wifi trên máy bay',
    'achat a bord', 'acquisto a bordo', 'compra a bordo confirmada',
    'شراء على متن',
  ]],
];

/**
 * Senders that only ever write about one of these things. Upgrade bidding platforms are the case that needs
 * it: their mails say "your offer was accepted" without naming a cabin at all.
 */
export const UPGRADE_DOMAINS = ['plusgrade.com', 'rpm-upgrades.com', 'tripauditor.com'];

/** The flight the extra hangs off, e.g. "TG208" or "G9 687". Airline codes may carry a digit (G9, 6E). */
function flightRefIn(text: string): string | undefined {
  const m = String(text || '')
    .toUpperCase()
    .match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]|\d[A-Z])\s?(\d{1,4}[A-Z]?)(?=$|[^A-Z0-9])/);
  return m ? `${m[1]}${m[2]}` : undefined;
}

function baggageFields(folded: string, raw: string): AncillaryFields {
  const cabin = /handbagage|cabin bag|carry-on|carry on|hand luggage|手荷物|기내 수하물|随身行李/.test(folded);
  const kg = folded.match(/(\d{1,3})\s?(?:kg|kilo|กก|キロ|킬로|公斤)/);
  const weight = kg ? Number(kg[1]) : NaN;
  return {
    bagType: cabin && !/hold|ruimbagage|checked|托运|受託|위탁/.test(folded) ? 'cabin' : 'hold',
    weightKg: Number.isFinite(weight) && weight > 0 && weight <= 200 ? weight : undefined,
    flightRef: flightRefIn(raw),
  };
}

function assistanceFields(folded: string, raw: string): AncillaryFields {
  const type = /wheelchair|rolstoel|rollstuhl|silla de ruedas|kursi roda|車椅子|휠체어|轮椅|วีลแชร์|รถเข็น|коляска|xe lăn/.test(folded)
    ? 'wheelchair'
    : /unaccompanied minor|begeleiding|minor/.test(folded)
      ? 'unaccompanied_minor'
      : /medical|medisch|medizin|медицин|医療|의료|医疗/.test(folded)
        ? 'medical_equipment'
        : 'assistance';
  return { assistanceType: type, flightRef: flightRefIn(raw) };
}

/** IATA special-meal codes are four letters ending in ML: VGML, KSML, HNML, AVML … */
function mealFields(raw: string): AncillaryFields {
  const m = String(raw || '').toUpperCase().match(/\b([A-Z]{2}ML)\b/);
  return { mealCode: m ? m[1] : undefined, flightRef: flightRefIn(raw) };
}

function purchaseFields(folded: string, raw: string): AncillaryFields {
  const type: AncillaryFields['purchaseType'] =
    /wifi|wi-fi|wlan|ไวไฟ|와이파이/.test(folded) ? 'wifi'
      : /duty[- ]?free|免税|duty-free/.test(folded) ? 'dutyfree'
        : /entertainment|entertainment|映画|엔터테인먼트|娱乐/.test(folded) ? 'entertainment'
          : 'other';
  return { purchaseType: type, flightRef: flightRefIn(raw) };
}

function upgradeFields(folded: string, raw: string): AncillaryFields {
  const to: AncillaryFields['toCabin'] =
    /first class|first-class|ファースト|일등석|头等舱|premiere classe/.test(folded) ? 'first'
      : /premium economy|premium-economy|プレミアムエコノミー|프리미엄 이코노미|超级经济舱/.test(folded) ? 'premium_economy'
        : /business/.test(folded) ? 'business'
          : undefined;
  // Only the honest half: a mail that says where you are going rarely says where you came from, and
  // "from economy" is an assumption. It is filled in only when the text actually says so.
  const from: AncillaryFields['fromCabin'] =
    /from premium economy|van premium economy/.test(folded) ? 'premium_economy'
      : /from economy|van economy|aus der economy/.test(folded) ? 'economy'
        : undefined;
  return { fromCabin: from, toCabin: to, flightRef: flightRefIn(raw) };
}

function petFields(folded: string, raw: string): AncillaryFields {
  const location: AncillaryFields['petLocation'] =
    /in cargo|in the hold|cargo|vrachtruim|frachtraum|貨物|화물|货舱/.test(folded) ? 'cargo'
      : /in cabin|in the cabin|aan boord|in der kabine|機内|기내|客舱/.test(folded) ? 'cabin'
        : undefined;
  const type = /dog|hond|hund|perro|anjing|犬|개|狗|สุนัข|собак|chó/.test(folded)
    ? 'dog'
    : /cat|kat|katze|gato|kucing|猫|고양이|แมว|кошк|mèo/.test(folded)
      ? 'cat'
      : undefined;
  return { petLocation: location, petType: type, flightRef: flightRefIn(raw) };
}

/**
 * What this text is about, or null when it says nothing about any of these extras.
 *
 * `senderDomain` is optional and only strengthens the reading: an upgrade platform's mail is an upgrade even
 * when its subject is vague.
 */
export function detectAncillary(text: string, senderDomain?: string): AncillaryHit | null {
  const raw = String(text || '');
  const folded = foldText(raw);
  if (folded.length < 3) return null;

  const domain = String(senderDomain || '').toLowerCase();
  const fromUpgradePlatform = !!domain && UPGRADE_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`));

  for (const [kind, words] of KEYWORDS) {
    if (!words.some(w => folded.includes(foldText(w)))) continue;
    switch (kind) {
      case 'extraBaggage': return { kind, fields: baggageFields(folded, raw) };
      case 'specialAssistance': return { kind, fields: assistanceFields(folded, raw) };
      case 'mealOrder': return { kind, fields: mealFields(raw) };
      case 'inflightPurchase': return { kind, fields: purchaseFields(folded, raw) };
      case 'cabinUpgrade': return { kind, fields: upgradeFields(folded, raw) };
      default: return { kind, fields: petFields(folded, raw) };
    }
  }

  // The platform only ever writes about upgrades, so its mail is one even when the words are not there.
  if (fromUpgradePlatform) return { kind: 'cabinUpgrade', fields: upgradeFields(folded, raw) };
  return null;
}

/**
 * What to call each kind on screen. The label lives here so the mail list, the scanner and the paste sheet
 * all say the same word for the same thing.
 */
export function ancillaryLabel(kind: AncillaryKind, copy: Record<string, unknown>): string {
  const pick = (key: string) => String(copy?.[key] ?? '');
  switch (kind) {
    case 'extraBaggage': return pick('gmailExtraBaggage');
    case 'specialAssistance': return pick('gmailSpecialAssistance');
    case 'mealOrder': return pick('gmailMealOrder');
    case 'inflightPurchase': return pick('gmailInflightPurchase');
    case 'cabinUpgrade': return pick('gmailCabineUpgrade');
    default: return pick('gmailPetReservation');
  }
}
