/**
 * Every case here is a subject line an airline actually sends, and a mail that must not be mistaken for one.
 * The detector is detect-only, so what matters is the kind it reads and the fields it can honestly fill.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UPGRADE_DOMAINS, ancillaryFirst, detectAncillary, looksLikeTicket } from './ancillaryDetect.ts';
import { parseImportText } from './flightImport.ts';

function kindOf(subject: string, domain?: string): string | null {
  return detectAncillary(subject, domain)?.kind ?? null;
}

// ── extra baggage ────────────────────────────────────────────────────────────

test('extra baggage: recognised from a real confirmation, in several languages', () => {
  assert.equal(kindOf('Your extra baggage is confirmed for TG208'), 'extraBaggage');
  assert.equal(kindOf('Additional baggage purchased — 23kg'), 'extraBaggage');
  assert.equal(kindOf('Bevestiging: extra bagage voor je vlucht'), 'extraBaggage');
  assert.equal(kindOf('สัมภาระเพิ่มเติม ยืนยันแล้ว'), 'extraBaggage');
  assert.equal(kindOf('超過手荷物のお申し込み'), 'extraBaggage');
  assert.equal(kindOf('额外行李已确认'), 'extraBaggage');
  assert.equal(kindOf('추가 수하물 확인'), 'extraBaggage');
  assert.equal(kindOf('Ihr Zusatzgepäck ist bestätigt'), 'extraBaggage');
  assert.equal(kindOf('Дополнительный багаж подтверждён'), 'extraBaggage');
  assert.equal(kindOf('Hành lý thêm đã được xác nhận'), 'extraBaggage');
  assert.equal(kindOf('Bagasi tambahan dikonfirmasi'), 'extraBaggage');
  assert.equal(kindOf('Equipaje adicional confirmado'), 'extraBaggage');
});

test('extra baggage: an ordinary mail is not one, and the fields say what the text said', () => {
  assert.equal(kindOf('Your weekly newsletter from us'), null);
  assert.equal(kindOf('Payment receipt #8891'), null);
  assert.equal(kindOf('Bag a bargain this summer!'), null, '"bag a bargain" is not a baggage confirmation');

  const hold = detectAncillary('Extra baggage confirmed: 32 kg hold luggage on TG 208');
  assert.equal(hold?.fields.bagType, 'hold');
  assert.equal(hold?.fields.weightKg, 32);
  assert.equal(hold?.fields.flightRef, 'TG208');

  const cabin = detectAncillary('Handbagage upgrade bevestigd (7kg) voor KL843');
  assert.equal(cabin?.fields.bagType, 'cabin');
  assert.equal(cabin?.fields.weightKg, 7);
  assert.equal(cabin?.fields.flightRef, 'KL843');

  // No weight in the text, so none is invented.
  assert.equal(detectAncillary('Extra baggage added to your booking')?.fields.weightKg, undefined);
});

// ── special assistance ───────────────────────────────────────────────────────

test('special assistance: wheelchair, minors and medical equipment are recognised', () => {
  assert.equal(kindOf('Your special assistance request is confirmed'), 'specialAssistance');
  assert.equal(kindOf('Wheelchair assistance for your flight BR75'), 'specialAssistance');
  assert.equal(kindOf('Unaccompanied minor booking confirmed'), 'specialAssistance');
  assert.equal(kindOf('Speciale assistentie bevestigd'), 'specialAssistance');
  assert.equal(kindOf('Rollstuhl am Gate bestätigt'), 'specialAssistance');
  assert.equal(kindOf('ความช่วยเหลือพิเศษ ยืนยันแล้ว'), 'specialAssistance');
  assert.equal(kindOf('특별 지원 확인'), 'specialAssistance');
  assert.equal(kindOf('Hỗ trợ đặc biệt đã xác nhận'), 'specialAssistance');
});

test('special assistance: an unrelated mail is not one, and the type is read from the words', () => {
  assert.equal(kindOf('Your subscription renews next month'), null);
  assert.equal(kindOf('Special offer: 20% off hotels'), null, 'a promotion is not a special request');

  assert.equal(detectAncillary('Wheelchair confirmed for TG208')?.fields.assistanceType, 'wheelchair');
  assert.equal(
    detectAncillary('Unaccompanied minor confirmed on KL843')?.fields.assistanceType,
    'unaccompanied_minor',
  );
  assert.equal(
    detectAncillary('Medical equipment approved for your flight')?.fields.assistanceType,
    'medical_equipment',
  );
  assert.equal(detectAncillary('Wheelchair confirmed for TG 208')?.fields.flightRef, 'TG208');
});

// ── meals ────────────────────────────────────────────────────────────────────

test('meal order: a meal preference is recognised in several languages', () => {
  assert.equal(kindOf('Your meal preference is confirmed'), 'mealOrder');
  assert.equal(kindOf('Special meal request confirmed for BR75'), 'mealOrder');
  assert.equal(kindOf('Maaltijdkeuze bevestigd'), 'mealOrder');
  assert.equal(kindOf('特別機内食のリクエスト'), 'mealOrder');
  assert.equal(kindOf('特殊餐食已确认'), 'mealOrder');
  assert.equal(kindOf('อาหารพิเศษ ยืนยันแล้ว'), 'mealOrder');
  assert.equal(kindOf('Ihr Sondermenü ist bestätigt'), 'mealOrder');
  assert.equal(kindOf('특별 기내식 확인'), 'mealOrder');
});

test('meal order: a restaurant mail is not one, and the IATA meal code is picked up', () => {
  assert.equal(kindOf('Your table for two is booked'), null);
  assert.equal(kindOf('Dinner at Riva Surya tonight'), null);

  assert.equal(detectAncillary('Special meal VGML confirmed on TG208')?.fields.mealCode, 'VGML');
  assert.equal(detectAncillary('Meal preference KSML for KL843')?.fields.mealCode, 'KSML');
  assert.equal(detectAncillary('Meal preference confirmed')?.fields.mealCode, undefined);
});

// ── in-flight purchases ──────────────────────────────────────────────────────

test('inflight purchase: duty free, wifi and entertainment are recognised', () => {
  assert.equal(kindOf('Your inflight purchase is confirmed'), 'inflightPurchase');
  assert.equal(kindOf('Duty free order ready for collection'), 'inflightPurchase');
  assert.equal(kindOf('Your onboard wifi voucher'), 'inflightPurchase');
  assert.equal(kindOf('In-flight aankoop bevestigd'), 'inflightPurchase');
  assert.equal(kindOf('機内販売のご注文'), 'inflightPurchase');
  assert.equal(kindOf('机上wifi已开通'), 'inflightPurchase');
});

test('inflight purchase: a webshop order is not one, and the type is read', () => {
  assert.equal(kindOf('Your order has shipped'), null);
  assert.equal(kindOf('Free wifi at our hotel'), null, 'hotel wifi is not an inflight purchase');

  assert.equal(detectAncillary('Onboard wifi voucher for TG208')?.fields.purchaseType, 'wifi');
  assert.equal(detectAncillary('Duty free order confirmed')?.fields.purchaseType, 'dutyfree');
  assert.equal(detectAncillary('Inflight entertainment pass')?.fields.purchaseType, 'entertainment');
  assert.equal(detectAncillary('Inflight purchase confirmed')?.fields.purchaseType, 'other');
});

// ── cabin upgrade ────────────────────────────────────────────────────────────

test('cabin upgrade: airline and bidding-platform wording are both recognised', () => {
  assert.equal(kindOf('Your upgrade is confirmed'), 'cabinUpgrade');
  assert.equal(kindOf('Congratulations on your upgrade to Business Class'), 'cabinUpgrade');
  assert.equal(kindOf('Your upgrade request has been accepted'), 'cabinUpgrade');
  assert.equal(kindOf('Bid upgrade accepted — premium economy'), 'cabinUpgrade');
  assert.equal(kindOf('Upgrade bevestigd naar Business'), 'cabinUpgrade');
  assert.equal(kindOf('升舱确认'), 'cabinUpgrade');
  assert.equal(kindOf('アップグレード確定のお知らせ'), 'cabinUpgrade');
  assert.equal(kindOf('업그레이드 확인'), 'cabinUpgrade');
  assert.equal(kindOf('ยืนยันการอัปเกรด'), 'cabinUpgrade');
  // A bidding platform writes about nothing else, so a vague subject from it is still an upgrade.
  assert.equal(kindOf('Your offer has been reviewed', 'plusgrade.com'), 'cabinUpgrade');
  assert.equal(kindOf('Good news about your flight', 'mail.rpm-upgrades.com'), 'cabinUpgrade');
  assert.deepEqual(UPGRADE_DOMAINS.includes('plusgrade.com'), true);
});

test('cabin upgrade: an app-update mail is not one, and only the named cabin is filled in', () => {
  assert.equal(kindOf('Upgrade your phone plan today'), null, 'an unrelated "upgrade" is not a cabin upgrade');
  assert.equal(kindOf('Software update available'), null);

  const biz = detectAncillary('Upgrade confirmed: Business Class on TG208');
  assert.equal(biz?.fields.toCabin, 'business');
  assert.equal(biz?.fields.flightRef, 'TG208');
  assert.equal(biz?.fields.fromCabin, undefined, 'the mail never said where you came from');

  assert.equal(detectAncillary('Premium economy upgrade confirmed')?.fields.toCabin, 'premium_economy');
  assert.equal(detectAncillary('Upgrade to First Class confirmed')?.fields.toCabin, 'first');
  assert.equal(
    detectAncillary('Upgrade confirmed from economy to business')?.fields.fromCabin,
    'economy',
  );
});

// ── pets ─────────────────────────────────────────────────────────────────────

test('pet reservation: cabin and hold are both recognised', () => {
  assert.equal(kindOf('Your pet reservation is confirmed'), 'petReservation');
  assert.equal(kindOf('Pet in cabin confirmed for TG208'), 'petReservation');
  assert.equal(kindOf('Animal transport confirmed'), 'petReservation');
  assert.equal(kindOf('Huisdier aan boord bevestigd'), 'petReservation');
  assert.equal(kindOf('Haustier im Flugzeug bestätigt'), 'petReservation');
  assert.equal(kindOf('สัตว์เลี้ยงบนเครื่อง ยืนยันแล้ว'), 'petReservation');
  assert.equal(kindOf('반려동물 예약 확인'), 'petReservation');
});

test('pet reservation: a pet shop mail is not one, and location and animal are read when said', () => {
  assert.equal(kindOf('Your dog food subscription'), null);
  assert.equal(kindOf('Win a trip for you and your pet — competition'), null);

  const cabin = detectAncillary('Pet in cabin confirmed: small dog on TG208');
  assert.equal(cabin?.fields.petLocation, 'cabin');
  assert.equal(cabin?.fields.petType, 'dog');
  assert.equal(cabin?.fields.flightRef, 'TG208');

  const cargo = detectAncillary('Pet in cargo confirmed — cat');
  assert.equal(cargo?.fields.petLocation, 'cargo');
  assert.equal(cargo?.fields.petType, 'cat');

  assert.equal(detectAncillary('Pet reservation confirmed')?.fields.petLocation, undefined);
});

// ── the three ways in share one reading ──────────────────────────────────────

test('the same text reads the same whether it was mailed, scanned or pasted', () => {
  const pasted = `Booking reference ABC123
Extra baggage confirmed
23 kg, hold luggage
Flight TG 208 on 27 September`;
  const hit = detectAncillary(pasted);
  assert.equal(hit?.kind, 'extraBaggage');
  assert.equal(hit?.fields.weightKg, 23);
  assert.equal(hit?.fields.flightRef, 'TG208');

  // A scanned code that carries the words reads identically; a bare code says nothing.
  assert.equal(detectAncillary('UPGRADE CONFIRMED BUSINESS TG208')?.kind, 'cabinUpgrade');
  assert.equal(detectAncillary('M1DOE/JOHN      EABC123 BKKAMSTG 0208'), null);
  assert.equal(detectAncillary(''), null);
  assert.equal(detectAncillary('ok'), null);
});

// ── which reading wins when a text is both ───────────────────────────────────

/**
 * These confirmations name the flight they belong to, so reading the flight number first sent every one of
 * them to the flight search and the extra was never mentioned. The six texts below are the ones tried on a
 * phone; three of them carry a flight number the importer recognises.
 */
test('an extra that names its flight is read as the extra, not as a flight search', () => {
  const pasted = 'Extra baggage confirmed 23kg TG208';
  // The importer does see a flight in this text — which is exactly why the order matters.
  assert.equal(parseImportText(pasted).length, 1);
  assert.equal(parseImportText(pasted)[0].flightNumber, 'TG208');
  // And yet what the user is told is the baggage.
  const hit = ancillaryFirst(pasted);
  assert.equal(hit?.kind, 'extraBaggage');
  assert.equal(hit?.fields.weightKg, 23);
  assert.equal(hit?.fields.flightRef, 'TG208');
});

test('all six confirmations take the extras route, whether or not they name a flight', () => {
  const cases: [string, string][] = [
    ['Extra baggage confirmed. 23kg hold baggage added to your booking. Flight TG208, 27 Sep.', 'extraBaggage'],
    ['Special assistance confirmed. Wheelchair requested for flight BR75 on 29 Sep.', 'specialAssistance'],
    ['Your special meal request (VGML) has been confirmed for flight TG208.', 'mealOrder'],
    ['Your inflight wifi purchase is confirmed for flight BR75.', 'inflightPurchase'],
    ['Congratulations, your upgrade to Business Class has been accepted for flight BR75.', 'cabinUpgrade'],
    ['Pet reservation confirmed. Your dog will travel in cabin on flight TG208, 27 Sep.', 'petReservation'],
  ];
  for (const [text, kind] of cases) assert.equal(ancillaryFirst(text)?.kind, kind, text);
});

test('the ticket itself still goes to the flight importer', () => {
  const ticket = 'Your e-ticket TG208 on 27 Sep. Baggage allowance 23kg included.';
  assert.equal(looksLikeTicket(ticket), true);
  assert.equal(ancillaryFirst(ticket), null, 'an itinerary is a flight, whatever else it mentions');
  assert.equal(parseImportText(ticket)[0]?.flightNumber, 'TG208');

  // A plain booking with no extra in it is unaffected.
  const plain = 'Booking confirmed: TG208 BKK-AMS on 27 Sep 2026';
  assert.equal(ancillaryFirst(plain), null);
  assert.equal(parseImportText(plain)[0]?.flightNumber, 'TG208');
});
