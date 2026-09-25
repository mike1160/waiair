import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCAN_DAYS_DEFAULT,
  brandLabel,
  classifyKind,
  foldSubject,
  filterImported,
  gmailQueries,
  listOutcome,
  mergeListPages,
  QUERY_MAX_CHARS,
  QUERY_MAX_ENCODED,
  packQueries,
  SUBJECT_KEYWORDS,
  TRAVEL_DOMAINS,
  groupItems,
  itemFromMetadata,
  kindFromSenderAddress,
  matchesTravel,
  senderDomain,
  senderName,
  truncateSubject,
  type GmailInboxItem,
} from './gmailInboxScan.ts';

/** The searches of one scan, as one string — what the scan asks Gmail for, all batches together. */
function searched(days = SCAN_DAYS_DEFAULT): string {
  return gmailQueries(days).join(' ');
}

test('the searches cover the window, the travel senders and the subject keywords', () => {
  const qs = gmailQueries(SCAN_DAYS_DEFAULT);
  assert.ok(qs.length > 1, 'the search is batched, not one enormous query');
  for (const q of qs) assert.match(q, /^newer_than:90d (from|subject):\(/);
  assert.ok(qs.some(q => /from:\(.*\bbooking\b/.test(q)));
  assert.ok(qs.some(q => /from:\(.*\bagoda\b/.test(q)));
  assert.ok(qs.some(q => q.includes('"booking confirmation"')));
  assert.ok(qs.some(q => q.includes('"pick-up confirmation"')));
  for (const q of gmailQueries(365)) assert.match(q, /newer_than:365d/);
});

test('no single search is big enough to break the request URL', () => {
  // The search travels in the URL of a GET, so its encoded length is what counts. One query holding every
  // sender and phrase reached 8,200 characters — about 17,000 encoded, since a Thai character costs nine.
  const URL_CEILING = 8192;
  const qs = gmailQueries(SCAN_DAYS_DEFAULT);
  for (const q of qs) {
    assert.ok(q.length <= QUERY_MAX_CHARS, `query too long (${q.length}): ${q.slice(0, 80)}…`);
    const encoded = encodeURIComponent(q).length;
    assert.ok(encoded <= QUERY_MAX_ENCODED, `encoded query over budget: ${encoded}`);
    // Room to spare under the ceiling a request URL has to live within.
    assert.ok(encoded + 120 < URL_CEILING, `request URL would reach ${encoded + 120} bytes`);
  }
  assert.equal(QUERY_MAX_CHARS, 1200);
  assert.equal(QUERY_MAX_ENCODED, 6000);
});

test('a batch of nothing but Thai still fits in a URL', () => {
  // The raw budget alone would let this through at roughly ten thousand encoded bytes; the encoded budget
  // is what keeps it honest, and the lists are only going to grow.
  const thai = Array.from({ length: 200 }, (_, i) => `"ยืนยันการจองโฮสเทลและที่พักกลางแจ้ง ${i}"`);
  const batches = packQueries('newer_than:90d', 'subject', thai);
  assert.ok(batches.length > 1, 'it really did have to split');
  for (const q of batches) {
    assert.ok(encodeURIComponent(q).length <= QUERY_MAX_ENCODED, 'a Thai batch stays inside the budget');
  }
});

test('batching loses nothing: every sender and phrase is still searched', () => {
  const all = searched();
  for (const keyword of SUBJECT_KEYWORDS) {
    assert.ok(all.includes(`"${keyword}"`), `subject phrase dropped: ${keyword}`);
  }
  for (const domain of TRAVEL_DOMAINS) {
    const byBrand = new RegExp(`(^| |\\()${brandLabel(domain)}( |\\)|$)`).test(all);
    assert.ok(all.includes(domain) || byBrand, `sender dropped: ${domain}`);
  }
});

test('sender header → domain and display name', () => {
  assert.equal(senderDomain('"Booking.com" <noreply@booking.com>'), 'booking.com');
  assert.equal(senderDomain('mail@news.klm.com'), 'klm.com', 'subdomains map to the known domain');
  assert.equal(senderName('"Agoda" <no-reply@agoda.co.th>'), 'Agoda');
  assert.equal(senderName('no-reply@hertz.com'), 'hertz.com', 'no display name: the domain');
  assert.equal(senderDomain('broken'), '');
});

test('travel mail is recognised by sender domain or subject keyword', () => {
  assert.equal(matchesTravel('x@booking.com', 'Anything'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Your booking confirmation'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Bevestiging van je reis'), true);
  assert.equal(matchesTravel('x@unknown.org', 'Weekly newsletter'), false);
});

test('kind comes from the sender, else from a subject keyword', () => {
  assert.equal(classifyKind('x@thaiairways.com', 'Anything'), 'flight');
  assert.equal(classifyKind('x@agoda.com', 'Anything'), 'hotel');
  assert.equal(classifyKind('x@sixt.com', 'Anything'), 'carRental');
  assert.equal(classifyKind('x@unknown.org', 'Your e-ticket for TG922'), 'flight');
  assert.equal(classifyKind('x@unknown.org', 'Hotel confirmation'), 'hotel');
  assert.equal(classifyKind('x@unknown.org', 'Your rental in Phuket'), 'carRental');
  assert.equal(classifyKind('x@unknown.org', 'Reservation confirmed'), '', 'travel, but the kind is unknown');
});

test('metadata headers become one results item; non-travel and unknown-kind mail is dropped', () => {
  const item = itemFromMetadata('m1', [
    { name: 'From', value: '"Thai Airways" <no-reply@thaiairways.com>' },
    { name: 'Subject', value: 'Your e-ticket TG922 BKK-FRA' },
    { name: 'Date', value: 'Wed, 16 Sep 2026 08:00:00 +0700' },
  ], '1789000000000');
  assert.deepEqual(
    [item?.id, item?.kind, item?.sender, item?.senderDomain, item?.dateMs],
    ['m1', 'flight', 'Thai Airways', 'thaiairways.com', 1789000000000],
  );
  // internalDate missing: the Date header is used.
  const fallback = itemFromMetadata('m2', [
    { name: 'From', value: 'x@booking.com' },
    { name: 'Subject', value: 'Booking confirmation' },
    { name: 'Date', value: 'Wed, 16 Sep 2026 08:00:00 +0000' },
  ], null);
  assert.equal(fallback?.dateMs, Date.parse('Wed, 16 Sep 2026 08:00:00 +0000'));
  assert.equal(itemFromMetadata('m3', [{ name: 'From', value: 'x@unknown.org' }, { name: 'Subject', value: 'Hi' }], '1'), null);
  assert.equal(itemFromMetadata('', [{ name: 'From', value: 'x@booking.com' }], '1'), null);
});

test('imported ids are filtered out, groups are ordered and newest first', () => {
  const mk = (id: string, kind: GmailInboxItem['kind'], dateMs: number): GmailInboxItem =>
    ({ id, kind, sender: 's', senderDomain: 'd', subject: 's', dateMs });
  const items = [mk('a', 'hotel', 2), mk('b', 'flight', 1), mk('c', 'flight', 3), mk('d', 'carRental', 4)];
  assert.deepEqual(filterImported(items, ['a']).map(i => i.id), ['b', 'c', 'd']);
  assert.deepEqual(filterImported(items, new Set(['b', 'c'])).map(i => i.id), ['a', 'd']);
  assert.deepEqual(groupItems(items).map(g => [g.kind, g.items.map(i => i.id)]), [
    ['flight', ['c', 'b']],
    ['hotel', ['a']],
    ['carRental', ['d']],
  ]);
  assert.deepEqual(groupItems([mk('a', 'hotel', 1)]).map(g => g.kind), ['hotel'], 'empty groups are left out');
});

test('subject lines are truncated for the results row', () => {
  assert.equal(truncateSubject('short subject'), 'short subject');
  const long = 'Your booking confirmation for Bangkok, Thailand — 4 nights';
  assert.ok(truncateSubject(long).length <= 40, truncateSubject(long));
  assert.ok(truncateSubject(long).length >= 38, 'trailing spaces trimmed, not a short cut');
  assert.match(truncateSubject(long), /…$/);
});

test('Trip.com: the product in the sender address decides, so a hotel mail is not read as a flight', () => {
  assert.equal(classifyKind('Trip.com <NL_HTL_NoReply@trip.com>', 'Bevestigd: Holiday Inn Bangkok'), 'hotel');
  assert.equal(classifyKind('Trip.com <NL_FLT_NoReply@trip.com>', 'Je e-ticket'), 'flight');
  assert.equal(classifyKind('Ctrip <hotel_noreply@ctrip.com>', 'Booking confirmation'), 'hotel');
  assert.equal(kindFromSenderAddress('NL_HTL_NoReply@trip.com'), 'hotel');
  assert.equal(kindFromSenderAddress('noreply@booking.com'), '');
  // Without a hint the domain still decides.
  assert.equal(classifyKind('Trip.com <noreply@trip.com>', 'Bevestiging van je boeking'), 'hotel');
});

test('Trip.com counts as travel and is in the search query', () => {
  assert.equal(senderDomain('Trip.com <NL_HTL_NoReply@trip.com>'), 'trip.com');
  assert.equal(matchesTravel('Trip.com <NL_HTL_NoReply@trip.com>', 'Bevestigd: Holiday Inn Bangkok'), true);
  assert.match(searched(), /trip\.com/);
  assert.match(searched(), /ctrip\.com/);
});

test('Dutch subjects say which kind it is, also from a sender we do not know', () => {
  assert.equal(classifyKind('Onbekend <x@example.org>', 'Hotelbevestiging voor je verblijf'), 'hotel');
  assert.equal(classifyKind('Onbekend <x@example.org>', 'Je huurauto is bevestigd'), 'carRental');
  assert.equal(classifyKind('Onbekend <x@example.org>', 'Je vlucht van morgen'), 'flight');
  assert.equal(classifyKind('Onbekend <x@example.org>', 'Nieuwsbrief met deals'), '');
});

test('subjects match whatever the accents and the case look like', () => {
  assert.equal(foldSubject('Buchungsbestätigung'), 'buchungsbestatigung');
  assert.equal(foldSubject('CONFIRMACIÓN de Reserva'), 'confirmacion de reserva');
  assert.equal(foldSubject('Carte d’embarquement'), "carte d'embarquement");
  // A sender that drops the accents is still recognised.
  assert.equal(classifyKind('x@unknown.org', 'Buchungsbestatigung fur Ihre Unterkunft'), 'hotel');
});

test('German, French, Spanish and Thai subjects say which kind it is', () => {
  const kind = (subject: string) => classifyKind('Reise <x@unknown.org>', subject);
  assert.equal(kind('Ihre Buchungsbestätigung'), 'hotel');
  assert.equal(kind('Ihre Reservierung im Hotel Adlon'), 'hotel');
  assert.equal(kind('Ihr Mietwagen in Bangkok'), 'carRental');
  assert.equal(kind('Ihre Bordkarte'), 'flight');
  assert.equal(kind('Confirmation de réservation'), 'hotel');
  assert.equal(kind('Votre séjour à Bangkok'), 'hotel');
  assert.equal(kind('Votre location de voiture'), 'carRental');
  assert.equal(kind('Confirmación de reserva'), 'hotel');
  assert.equal(kind('Tu vuelo a Bangkok'), 'flight');
  assert.equal(kind('Tarjeta de embarque'), 'flight');
  assert.equal(kind('Alquiler de coche confirmado'), 'carRental');
  assert.equal(kind('ยืนยันการจองโรงแรม'), 'hotel');
  assert.equal(kind('ตั๋วเครื่องบินของคุณ'), 'flight');
  assert.equal(kind('ยืนยันการเช่ารถ'), 'carRental');
});

test('a word that can only mean one product beats a general confirmation phrase', () => {
  // The German confirmation phrase usually means a hotel, but not when the subject also says "Flug".
  assert.equal(classifyKind('x@unknown.org', 'Buchungsbestätigung für Ihren Flug nach Bangkok'), 'flight');
  // Dutch "inchecken" is hotel check-in as well as flight check-in.
  assert.equal(classifyKind('x@unknown.org', 'Online inchecken voor je vlucht'), 'flight');
  assert.equal(classifyKind('x@unknown.org', 'Inchecken vanaf 14:00 uur'), 'hotel');
});

test('the scan asks Gmail for the foreign subjects too, spelled as the senders write them', () => {
  // Gmail search is case-insensitive; the accents are what matter here.
  const q = searched();
  assert.match(q, /buchungsbestätigung/);
  assert.match(q, /confirmation de réservation/);
  assert.match(q, /confirmación de reserva/);
  assert.match(q, /ยืนยันการจอง/);
});

test('a foreign newsletter is still not travel', () => {
  assert.equal(matchesTravel('x@example.org', 'Newsletter: Angebote für den Sommer'), false);
  assert.equal(matchesTravel('x@example.org', 'Boletín de ofertas'), false);
  // ... but a real confirmation is, even from a sender we do not know.
  assert.equal(matchesTravel('x@example.org', 'Ihre Buchungsbestätigung'), true);
  assert.equal(matchesTravel('x@example.org', 'ยืนยันการจองของคุณ'), true);
});

test('the brand in a host name, whatever country it wrote from', () => {
  assert.equal(brandLabel('mail.expedia.co.uk'), 'expedia');
  assert.equal(brandLabel('expedia.nl'), 'expedia');
  assert.equal(brandLabel('secure.booking.com'), 'booking');
  assert.equal(brandLabel('agoda.com.sg'), 'agoda');
  assert.equal(brandLabel('localhost'), '');
});

test('the hotel platforms of the Expedia group, Booking Holdings and the wholesalers are recognised', () => {
  for (const sender of [
    'x@vrbo.com', 'x@orbitz.com', 'x@travelocity.com', 'x@wotif.com',
    'x@priceline.com', 'x@kayak.com', 'x@hotelbeds.com', 'x@bedsonline.com',
    'x@hopper.com', 'x@tripadvisor.com',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'hotel', sender);
  }
  // A country domain of a brand we know, which is not in the domain list.
  assert.equal(classifyKind('Expedia <noreply@expedia.nl>', 'Je boeking'), 'hotel');
  assert.equal(matchesTravel('noreply@mail.expedia.co.uk', 'Anything'), true);
  // Expedia sells flights too, and says so in its own address.
  assert.equal(classifyKind('Expedia <flight-noreply@expedia.nl>', 'Je boeking'), 'flight');
  // A brand-shaped host that is not a travel brand stays out.
  assert.equal(matchesTravel('info@kayak.org', 'Paddling weekend'), false);
});

test('the search query reaches the country domains through the brand names', () => {
  const q = searched();
  // "expedia" as a bare word is what finds expedia.com, expedia.nl and expedia.co.uk alike, so the brand
  // replaces its own domains instead of being listed next to them.
  assert.match(q, /\bexpedia\b/);
  assert.match(q, /\bvrbo\b/);
  assert.match(q, /\bpriceline\b/);
  assert.ok(!q.includes('expedia.com'), 'the brand already covers its own domain');
  // KLM is a brand now, so the bare word replaces klm.com just like expedia replaces expedia.com.
  assert.match(q, /\bklm\b/);
  assert.ok(!q.includes('klm.com'), 'the brand already covers its own domain');
  // Senders whose brand is not in the brand list keep their exact domain.
  assert.match(q, /hotels\.com/);
});

test('the car rental companies of Enterprise Mobility, Hertz Group and the car-sharing apps', () => {
  for (const sender of [
    'x@enterprise.com', 'x@alamo.com', 'x@nationalcar.com', 'x@dollar.com', 'x@thrifty.com',
    'x@goldcar.es', 'x@centauro.net', 'x@okmobility.com', 'x@turo.com', 'x@zipcar.com',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'carRental', sender);
  }
  // Country domains of the rental brands.
  assert.equal(classifyKind('Sixt <noreply@sixt.nl>', 'Je huurauto'), 'carRental');
  assert.equal(classifyKind('Alamo <noreply@alamo.co.uk>', 'Your booking'), 'carRental');
  // Brands whose name is an ordinary word, or that another business owns, stay on their exact domain:
  // centauro.com.br is a sports shop, and "dollar" or "enterprise" say nothing about cars.
  assert.equal(matchesTravel('info@centauro.com.br', 'Ofertas de tênis'), false);
  assert.equal(matchesTravel('billing@enterprise.software', 'Invoice'), false);
});

test('the excursion platforms are recognised, and only they land in that group', () => {
  for (const sender of [
    'x@getyourguide.com', 'x@viator.com', 'x@klook.com',
    'x@musement.com', 'x@civitatis.com', 'x@tiqets.com',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'excursion', sender);
  }
  // Country domains of those brands — which the search query has to reach as bare brand words.
  assert.equal(classifyKind('GetYourGuide <no-reply@getyourguide.nl>', 'Je boeking'), 'excursion');
  const q = searched();
  assert.match(q, /\bgetyourguide\b/);
  assert.match(q, /\bklook\b/);
  assert.match(q, /\btiqets\b/);
  // An OTA that sells everything: the product in its own address decides.
  assert.equal(classifyKind('Expedia <activity-noreply@expedia.com>', 'Your booking'), 'excursion');
});

test('excursion subjects are recognised from a sender we do not know, in several languages', () => {
  const kind = (subject: string) => classifyKind('Tours <x@unknown.org>', subject);
  assert.equal(kind('Activity confirmation'), 'excursion');
  assert.equal(kind('Your guided tour in Bangkok'), 'excursion');
  assert.equal(kind('Je excursie is bevestigd'), 'excursion');
  assert.equal(kind('Ihr Ausflug ist bestätigt'), 'excursion');
  assert.equal(kind('Confirmación de tu actividad'), 'excursion');
  assert.equal(kind('Votre activité est confirmée'), 'excursion');
  assert.equal(kind('ยืนยันทัวร์ของคุณ'), 'excursion');
  // A flight mail that happens to mention a tour is still a flight: flight words come first.
  assert.equal(kind('Your flight and a guided tour in Bangkok'), 'flight');
  // "tour" alone must not fire — it hides inside ordinary words.
  assert.equal(kind('Tourist information for your trip'), '');
  assert.equal(kind('Tournament tickets'), '');
});

test('excursions are grouped last, after the kinds that can be imported', () => {
  const at = (ms: number, kind: GmailInboxItem['kind']): GmailInboxItem => ({
    id: `${kind}-${ms}`, kind, sender: 's', senderDomain: 'd', subject: 'x', dateMs: ms,
  });
  const groups = groupItems([at(3, 'excursion'), at(2, 'carRental'), at(1, 'flight')]);
  assert.deepEqual(groups.map(g => g.kind), ['flight', 'carRental', 'excursion']);
});

test('the ground-transport platforms are recognised, country domains included', () => {
  for (const sender of [
    'x@trainline.com', 'x@thetrainline.com', 'x@flixbus.com', 'x@omio.com', 'x@12go.asia',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'transport', sender);
  }
  assert.equal(classifyKind('FlixBus <info@flixbus.de>', 'Ihre Buchung'), 'transport');
  assert.equal(classifyKind('Omio <no-reply@omio.co.uk>', 'Your booking'), 'transport');
  const q = searched();
  assert.match(q, /\bflixbus\b/);
  assert.match(q, /\bomio\b/);
  assert.match(q, /12go/);
});

test('train, bus and ferry subjects are recognised from a sender we do not know', () => {
  const kind = (subject: string) => classifyKind('Reizen <x@unknown.org>', subject);
  assert.equal(kind('Your train ticket to Amsterdam'), 'transport');
  assert.equal(kind('Your bus ticket'), 'transport');
  assert.equal(kind('Je treinticket is klaar'), 'transport');
  assert.equal(kind('Ihr Zugticket'), 'transport');
  assert.equal(kind('Billet de train confirmé'), 'transport');
  assert.equal(kind('Billete de tren'), 'transport');
  assert.equal(kind('ตั๋วรถไฟของคุณ'), 'transport');
  // A coach in Thai contains the word for a tour: it is transport, not an excursion.
  assert.equal(kind('ตั๋วรถทัวร์ไปเชียงใหม่'), 'transport');
  // Words that merely contain a transport word are not bookings.
  assert.equal(kind('Business update'), '');
  assert.equal(kind('Autobahn roadworks'), '');
});

test('excursions and transport are both detected but stay after the importable kinds', () => {
  const at = (ms: number, kind: GmailInboxItem['kind']): GmailInboxItem => ({
    id: `${kind}-${ms}`, kind, sender: 's', senderDomain: 'd', subject: 'x', dateMs: ms,
  });
  const groups = groupItems([at(4, 'transport'), at(3, 'excursion'), at(2, 'hotel'), at(1, 'flight')]);
  assert.deepEqual(groups.map(g => g.kind), ['flight', 'hotel', 'excursion', 'transport']);
});

test('travel insurance is detected, but an ordinary policy from the same group is not', () => {
  for (const sender of [
    'x@allianz-assistance.com', 'x@allianztravelinsurance.com', 'x@axa-assistance.com', 'x@axapartners.com',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'insurance', sender);
  }
  // Allianz and AXA also sell car, home and life cover: those mails must stay out of the travel scan.
  assert.equal(matchesTravel('service@allianz.de', 'Ihre Kfz-Versicherung wird verlängert'), false);
  assert.equal(matchesTravel('info@axa.fr', 'Votre assurance habitation'), false);
});

test('insurance subjects are recognised in several languages', () => {
  const kind = (subject: string) => classifyKind('Verzekering <x@unknown.org>', subject);
  assert.equal(kind('Your travel insurance is confirmed'), 'insurance');
  assert.equal(kind('Je reisverzekering'), 'insurance');
  assert.equal(kind('Ihre Reiseversicherung'), 'insurance');
  assert.equal(kind('Votre assurance voyage'), 'insurance');
  assert.equal(kind('Tu seguro de viaje'), 'insurance');
  assert.equal(kind('ประกันการเดินทางของคุณ'), 'insurance');
  // A policy word alone is not travel at all, so it never reaches the scan.
  assert.equal(matchesTravel('x@unknown.org', 'Insurance policy renewal'), false);
});

test('every kind has its place in the results screen, importable ones first', () => {
  const at = (kind: GmailInboxItem['kind']): GmailInboxItem => ({
    id: kind, kind, sender: 's', senderDomain: 'd', subject: 'x', dateMs: 1,
  });
  const groups = groupItems(['insurance', 'transport', 'excursion', 'carRental', 'hotel', 'flight'].map(
    k => at(k as GmailInboxItem['kind']),
  ));
  assert.deepEqual(groups.map(g => g.kind), ['flight', 'hotel', 'carRental', 'excursion', 'transport', 'insurance']);
});

// ── the extras bought on top of a flight (detect-only) ───────────────────────

test('an extra from the airline is its own kind, not another flight mail', () => {
  const air = 'AirAsia <noreply@airasia.com>';
  assert.equal(classifyKind(air, 'Your extra baggage is confirmed'), 'extraBaggage');
  assert.equal(classifyKind(air, 'Special meal request confirmed'), 'mealOrder');
  assert.equal(classifyKind(air, 'Wheelchair assistance confirmed'), 'specialAssistance');
  assert.equal(classifyKind(air, 'Onboard wifi voucher'), 'inflightPurchase');
  assert.equal(classifyKind(air, 'Pet in cabin confirmed'), 'petReservation');
  assert.equal(classifyKind('Plusgrade <no-reply@plusgrade.com>', 'Your offer was accepted'), 'cabinUpgrade');
  // An unknown sender is still recognised, because the subject alone says what it is.
  assert.equal(classifyKind('Airline <mail@some-airline.example>', 'Extra bagage bevestigd'), 'extraBaggage');
});

test('the ticket itself stays a flight, and an ordinary mail is still nothing', () => {
  const air = 'Thai Airways <checkin@thaiairways.com>';
  // The words of the ticket win, even when the subject also mentions the baggage allowance.
  assert.equal(classifyKind(air, 'Your e-ticket TG208 — baggage allowance included'), 'flight');
  assert.equal(classifyKind(air, 'Your boarding pass for TG208'), 'flight');
  assert.equal(classifyKind(air, 'Your flight is confirmed'), 'flight');
  // Nothing about travel at all.
  assert.equal(classifyKind('Shop <news@shop.example>', 'Upgrade your phone plan'), '');
  assert.equal(classifyKind('Vet <mail@vet.example>', 'Your dog food subscription'), '');
});

test('an upgrade platform counts as a travel sender, so its mail is scanned at all', () => {
  assert.equal(matchesTravel('Plusgrade <no-reply@plusgrade.com>', 'Your offer was accepted'), true);
  assert.equal(matchesTravel('Shop <news@shop.example>', 'Weekly deals'), false);
});

/* ── The new categories, in every language the brief lists [J/2 + J/3] ────────────────────────── */

/**
 * One row per category: the senders that should name it, and a subject in each language.
 *
 * Written out in full on purpose. Three keyword typos in these scripts (즈 as 즐, 휴 as 해, a Russian word
 * cut short) got through code review and were only caught by running real phrases through the classifier.
 */
const CATEGORY_CASES: { kind: string; senders: string[]; subjects: string[] }[] = [
  {
    kind: 'hostel',
    senders: ['noreply@hostelworld.com', 'x@hostelbookers.com', 'x@generator.com', 'x@meininger-hotels.com'],
    subjects: [
      'Hostel booking confirmed', 'Dorm reservation', 'Bed confirmed', 'Hostel confirmation',
      'Hostelreservering bevestigd', 'Slaapzaal geboekt',
      'ยืนยันการจองโฮสเทล', 'ยืนยันที่พักโฮสเทล',
      '青年旅舍预订确认', '宿舍床位确认',
      'ホステル予約確認', 'ドミトリー予約完了',
      '호스텔 예약 확인', '도미토리 예약 완료',
      'Hostelreservierung bestätigt',
      'Подтверждение бронирования хостела',
      'Xác nhận đặt phòng hostel',
      'Konfirmasi pemesanan hostel',
      'Reserva de hostel confirmada',
    ],
  },
  {
    kind: 'camping',
    senders: ['x@pitchup.com', 'x@campspace.com', 'x@hipcamp.com', 'x@coolcamping.com', 'x@glamping.com', 'x@campsited.com'],
    subjects: [
      'Camping reservation confirmed', 'Campsite booking', 'Glamping confirmed',
      'Pitch booking confirmed', 'Campervan site confirmed',
      'Campingreservering bevestigd', 'Kampeerplaats geboekt', 'Glamping bevestigd',
      'ยืนยันการจองแคมปิ้ง', 'ยืนยันที่พักกลางแจ้ง',
      '露营地预订确认', '豪华露营预订',
      'キャンプ場予約確認', 'グランピング予約完了',
      '캠핑장 예약 확인', '글램핑 예약 완료',
      'Campingplatz bestätigt', 'Glamping Buchung',
      'Подтверждение бронирования кемпинга',
      'Xác nhận đặt chỗ cắm trại',
      'Konfirmasi pemesanan camping',
      'Reserva de camping confirmada',
    ],
  },
  {
    kind: 'boatRental',
    senders: ['x@clickandboat.com', 'x@boataround.com', 'x@samboat.com', 'x@nautal.com', 'x@sailogy.com'],
    subjects: [
      'Boat rental confirmed', 'Yacht charter confirmed', 'Houseboat booking',
      'Sailing charter confirmed', 'Boat hire confirmation',
      'Bootverhuur bevestigd', 'Jachtcharter geboekt', 'Woonboot reservering',
      'ยืนยันการเช่าเรือ', 'ยืนยันการเช่ายอร์ช',
      '租船确认', '游艇租赁确认',
      'ボートレンタル確認', 'ヨットチャーター予約完了',
      '보트 렌탈 확인', '요트 차터 예약 완료',
      'Bootsverleih bestätigt', 'Yachtcharter Buchung',
      'Подтверждение аренды лодки',
      'Xác nhận thuê thuyền',
      'Konfirmasi sewa perahu',
      'Alquiler de barco confirmado',
    ],
  },
  {
    kind: 'vacationRental',
    senders: ['x@homeaway.com', 'x@wimdu.com', 'x@9flats.com', 'x@vacasa.com', 'x@evolve.com'],
    subjects: [
      'Vacation rental confirmed', 'Apartment booking', 'Villa confirmed',
      'Cottage booking confirmed', 'Holiday home confirmed', 'Condo rental confirmed',
      'Vakantiewoning bevestigd', 'Appartement geboekt', 'Villa reservering bevestigd',
      'ยืนยันการจองบ้านพักตากอากาศ', 'ยืนยันการจองวิลล่า',
      '度假屋预订确认', '公寓预订确认', '别墅预订确认',
      'バケーションレンタル予約確認', '別荘予約完了',
      '휴가용 임대 예약 확인', '빌라 예약 완료',
      'Ferienwohnung bestätigt', 'Appartement Buchung',
      'Подтверждение аренды жилья',
      'Xác nhận đặt nhà nghỉ dưỡng',
      'Konfirmasi pemesanan villa',
      'Alquiler vacacional confirmado',
    ],
  },
  {
    kind: 'bandB',
    senders: [],
    subjects: [
      'B&B booking confirmed', 'Bed and breakfast reservation', 'Guesthouse confirmed',
      'Inn booking confirmed',
      'Bed en breakfast bevestigd', 'Gastenhuis bevestigd',
      'ยืนยันการจองเบดแอนด์เบรกฟาสต์',
      '民宿预订确认', '早餐旅馆预订',
      'B&B予約確認', '民宿予約完了',
      'B&B 예약 확인', '게스트하우스 예약 완료',
      'B&B Buchung',
      'Подтверждение бронирования B&B',
      'Xác nhận đặt phòng B&B',
      'Konfirmasi pemesanan B&B',
      'Reserva de B&B confirmada',
    ],
  },
  {
    kind: 'ferry',
    senders: ['x@stenaline.com', 'x@dfds.com', 'x@brittany-ferries.com', 'x@irishferries.com', 'x@directferries.com', 'x@gophuket.com'],
    subjects: [
      'Ferry booking confirmed', 'Ferry ticket', 'Crossing confirmed', 'Ferry reservation',
      'Veerboot bevestigd', 'Overtocht geboekt',
      'ยืนยันตั๋วเรือเฟอร์รี่', 'ยืนยันการข้ามฟาก',
      '渡轮预订确认', '轮渡票确认',
      'フェリー予約確認', '乗船券確認',
      '페리 예약 확인', '도선 티켓 확인',
      'Fährticket bestätigt', 'Fährbuchung',
      'Подтверждение бронирования парома',
      'Xác nhận đặt vé phà',
      'Konfirmasi tiket feri',
      'Reserva de ferry confirmada',
    ],
  },
  {
    kind: 'cruise',
    senders: ['x@msccruises.com', 'x@royalcaribbean.com', 'x@carnival.com', 'x@costacruises.com', 'x@ncl.com', 'x@cunard.com', 'x@viking.com', 'x@princess.com', 'x@hollandamerica.com'],
    subjects: [
      'Cruise booking confirmed', 'Cruise reservation', 'Cruise ticket', 'Embarkation confirmed',
      'Cruise bevestigd', 'Cruiseboeking bevestigd', 'Inscheping bevestigd',
      'ยืนยันการจองเรือสำราญ',
      '邮轮预订确认', '游轮票确认',
      'クルーズ予約確認', '乗船確認',
      '크루즈 예약 확인', '승선 확인',
      'Kreuzfahrt bestätigt', 'Kreuzfahrtbuchung',
      'Подтверждение бронирования круиза',
      'Xác nhận đặt tour du thuyền',
      'Konfirmasi pemesanan cruise',
      'Reserva de crucero confirmada',
    ],
  },
  {
    kind: 'transfer',
    senders: ['x@kiwitaxi.com', 'x@hoppa.com', 'x@jayride.com', 'x@welcomepickups.com', 'x@mozio.com', 'x@transferz.com', 'x@airportshuttles.com'],
    subjects: [
      'Transfer confirmed', 'Airport transfer booking', 'Private transfer confirmed',
      'Taxi booking confirmed', 'Shuttle confirmed', 'Minibus transfer confirmed',
      'Transfer bevestigd', 'Luchthaventransfer geboekt', 'Taxi reservering bevestigd',
      'ยืนยันการจองรถรับส่ง',
      '接送服务确认', '机场接送确认',
      '送迎確認', '空港転送予約完了',
      '공항 픽업 확인', '셔틀 예약 완료',
      'Transfer bestätigt', 'Flughafentransfer Buchung',
      'Подтверждение трансфера',
      'Xác nhận đặt xe đưa đón',
      'Konfirmasi pemesanan transfer',
      'Traslado confirmado',
    ],
  },
  {
    kind: 'parking',
    senders: ['x@parkvia.com', 'x@holidayextras.com', 'x@parkos.com', 'x@skyparksecure.com', 'x@valet.com', 'x@airparks.co.uk', 'x@purpleparkingusa.com'],
    subjects: [
      'Parking confirmed', 'Airport parking booking', 'Car park reservation confirmed',
      'Parking reservation', 'Valet parking confirmed', 'Valet service booking',
      'Valet reservation confirmed', 'Meet and greet parking',
      'Parkeren bevestigd', 'Luchthavenparkeren geboekt', 'Valet parkeren bevestigd',
      'Parkeerplaats bevestigd',
      'ยืนยันการจองที่จอดรถ', 'ยืนยันบริการวาเลต์',
      '停车预订确认', '代客泊车确认',
      '駐車場予約確認', 'バレーパーキング確認',
      '주차 예약 확인', '발레 파킹 확인',
      'Parkplatz bestätigt', 'Valet Parken bestätigt', 'Flughafenparken Buchung',
      'Подтверждение парковки',
      'Xác nhận đặt chỗ đậu xe',
      'Konfirmasi pemesanan parkir',
      'Reserva de aparcamiento confirmada',
    ],
  },
  {
    kind: 'restaurant',
    senders: ['x@opentable.com', 'x@resy.com', 'x@thefork.com', 'x@quandoo.com', 'x@tock.com',
      'x@sevenrooms.com', 'x@eatigo.com'],
    subjects: [
      'Restaurant reservation confirmed', 'Table booking', 'Dining reservation confirmed',
      'Your table is booked',
      'Restaurantreservering bevestigd', 'Tafel geboekt',
      'ยืนยันการจองร้านอาหาร', 'ยืนยันโต๊ะอาหาร',
      '餐厅预订确认', '餐桌预订确认',
      'レストラン予約確認', 'お席の予約完了',
      '레스토랑 예약 확인', '식당 예약 완료',
      'Tischreservierung bestätigt',
      'Подтверждение бронирования ресторана',
      'Xác nhận đặt bàn nhà hàng',
      'Konfirmasi reservasi restoran',
      'Reserva de restaurante confirmada',
    ],
  },
  {
    kind: 'event',
    senders: ['x@ticketmaster.com', 'x@eventbrite.com', 'x@stubhub.com', 'x@viagogo.com', 'x@fever.com',
      'x@dice.fm'],
    subjects: [
      'Your ticket', 'Event confirmation', 'Ticket confirmed', 'Concert ticket', 'Museum ticket',
      'Show ticket', 'Entry ticket confirmed', 'Festival ticket',
      'Je ticket', 'Evenement bevestigd', 'Concertticket', 'Museumticket bevestigd', 'Festivalticket',
      'ยืนยันตั๋วงาน', 'ยืนยันตั๋วคอนเสิร์ต', 'ยืนยันตั๋วพิพิธภัณฑ์',
      '活动票确认', '演唱会票确认', '博物馆票确认',
      'チケット確認', 'コンサートチケット予約完了', 'イベントチケット確認',
      '티켓 확인', '콘서트 티켓 예약 완료', '박물관 티켓 확인',
      'Ticket bestätigt', 'Konzertticket', 'Veranstaltungsticket',
      'Подтверждение билета на мероприятие',
      'Xác nhận vé sự kiện',
      'Konfirmasi tiket acara',
      'Entrada confirmada',
    ],
  },
  {
    kind: 'course',
    senders: ['x@berlitz.com', 'x@cookly.com', 'x@bookretreats.com'],
    subjects: [
      'Course booking confirmed', 'Workshop confirmed', 'Lesson booking', 'Class confirmed',
      'Dive course', 'Language course confirmed', 'Cooking class confirmed', 'Surf lesson confirmed',
      'Yoga retreat confirmed', 'Photography workshop confirmed',
      'Cursus bevestigd', 'Workshop geboekt', 'Duikcursus bevestigd', 'Kookworkshop bevestigd',
      'Les bevestigd',
      'ยืนยันการจองคอร์ส', 'ยืนยันการเรียน', 'ยืนยันคลาสดำน้ำ', 'ยืนยันคลาสทำอาหาร',
      '课程预订确认', '工作坊确认', '潜水课程确认', '烹饪课确认',
      'コース予約確認', 'ワークショップ予約完了', 'ダイビングコース確認', '料理教室確認',
      '강좌 예약 확인', '워크숍 예약 완료', '다이빙 코스 확인', '요리 수업 확인',
      'Kurs bestätigt', 'Workshop Buchung', 'Tauchkurs bestätigt', 'Kochkurs bestätigt',
      'Подтверждение записи на курс',
      'Xác nhận đặt khóa học',
      'Konfirmasi pemesanan kursus',
      'Reserva de curso confirmada',
    ],
  },
  {
    kind: 'visa',
    senders: ['noreply@esta.cbp.dhs.gov', 'x@eta.immi.gov.au', 'x@vfsglobal.com', 'x@tlscontact.com',
      'x@ivisa.com', 'x@visahq.com'],
    subjects: [
      'Visa approved', 'ESTA approved', 'ETA confirmed', 'Travel authorization approved',
      'Visa confirmation', 'Entry permit confirmed', 'eVisa approved',
      'Visum goedgekeurd', 'ESTA bevestigd', 'Reistoestemming goedgekeurd',
      'วีซ่าอนุมัติแล้ว', 'ยืนยัน ESTA', 'ใบอนุญาตเข้าประเทศ',
      '签证批准', 'ESTA确认', '入境许可确认',
      'ビザ承認', 'ESTA承認', '入国許可確認',
      '비자 승인', 'ESTA 승인', '입국 허가 확인',
      'Visum genehmigt', 'Einreisegenehmigung bestätigt',
      'Виза одобрена', 'Подтверждение ESTA',
      'Visa được chấp thuận', 'Xác nhận ESTA',
      'Visa disetujui', 'Konfirmasi ESTA',
      'Visado aprobado', 'ESTA confirmado',
    ],
  },
  {
    kind: 'lounge',
    senders: ['x@prioritypass.com', 'x@loungekey.com', 'x@collinson.com', 'x@dragonpass.com',
      'x@loungereview.com'],
    subjects: [
      'Lounge access confirmed', 'Lounge pass', 'Airport lounge booking', 'Priority pass booking',
      'Lounge reservation confirmed',
      'Loungetoegang bevestigd', 'Loungereservering bevestigd',
      'ยืนยันการเข้าใช้เลานจ์', 'บัตรเข้าเลานจ์',
      '贵宾室预订确认', '机场贵宾厅确认',
      'ラウンジ予約確認', '空港ラウンジ利用確認',
      '라운지 예약 확인', '공항 라운지 이용 확인',
      'Lounge Zugang bestätigt', 'Lounge Buchung',
      'Подтверждение доступа в лаунж',
      'Xác nhận đặt phòng chờ sân bay',
      'Konfirmasi akses lounge bandara',
      'Acceso a sala VIP confirmado',
    ],
  },
  {
    kind: 'diving',
    senders: ['x@padi.com', 'x@ssi.com', 'x@divebooker.com', 'x@divinginternational.com'],
    subjects: [
      'Dive trip confirmed', 'Scuba confirmed', 'Dive booking', 'Snorkel trip',
      'Duiktrip bevestigd', 'Snorkeltrip geboekt',
      'ยืนยันทริปดำน้ำ', 'ยืนยันการดำน้ำตื้น',
      '潜水行程确认', '浮潜行程确认',
      'ダイビングツアー確認', 'シュノーケリング予約完了',
      '다이빙 투어 확인', '스노클링 예약 완료',
      'Tauchausflug bestätigt', 'Schnorcheltour',
      'Подтверждение дайв-тура',
      'Xác nhận chuyến lặn',
      'Konfirmasi trip diving',
      'Excursión de buceo confirmada',
    ],
  },
  {
    kind: 'bikeRental',
    senders: ['x@bikesbooking.com', 'x@spinlister.com', 'x@donkeyrepublic.com', 'x@tokyobike.com'],
    subjects: [
      'Bike rental confirmed', 'Bicycle hire confirmed', 'E-bike rental confirmed',
      'Fietshuur bevestigd', 'Fietstour geboekt', 'E-bike huur bevestigd',
      'ยืนยันการเช่าจักรยาน',
      '自行车租赁确认', '电动自行车预订',
      '自転車レンタル確認', 'サイクリングツアー予約完了',
      '자전거 렌탈 확인', '사이클링 투어 예약 완료',
      'Fahrradverleih bestätigt', 'Fahrradtour gebucht',
      'Подтверждение аренды велосипеда',
      'Xác nhận thuê xe đạp',
      'Konfirmasi sewa sepeda',
      'Alquiler de bicicleta confirmado',
    ],
  },
  {
    kind: 'adventure',
    senders: [],
    subjects: [
      'Skydiving confirmed', 'Parachute jump booking', 'Bungee jump confirmed', 'Paragliding confirmed',
      'Hot air balloon confirmed', 'Zip line confirmed', 'Go-kart booking confirmed',
      'Buggy rental confirmed', 'Quad bike confirmed', 'ATV rental confirmed',
      'Skydiven bevestigd', 'Ballonvaart geboekt', 'Kartbaan bevestigd', 'Bungeejumpen bevestigd',
      'Quad verhuur bevestigd',
      'ยืนยันการกระโดดร่ม', 'ยืนยันการล่องบอลลูน', 'ยืนยันการขับรถโกคาร์ต',
      '跳伞确认', '热气球预订确认', '卡丁车预订确认',
      'スカイダイビング確認', '熱気球予約完了', 'ゴーカート予約確認',
      '스카이다이빙 확인', '열기구 예약 완료', '고카트 예약 확인',
      'Fallschirmspringen bestätigt', 'Heißluftballon gebucht',
      'Подтверждение прыжка с парашютом',
      'Xác nhận nhảy dù',
      'Konfirmasi skydiving',
      'Paracaidismo confirmado',
    ],
  },
  {
    kind: 'experience',
    senders: [],
    subjects: [
      'Horse riding confirmed', 'Camel ride booking', 'Safari confirmed', 'Rickshaw tour',
      'Elephant sanctuary confirmed', 'Whale watching confirmed',
      'Paardrijden bevestigd', 'Safaritour geboekt', 'Olifantensafari bevestigd',
      'Huifkartocht bevestigd', 'Walvissen spotten bevestigd',
      'ยืนยันการขี่ม้า', 'ยืนยันซาฟารี', 'ยืนยันล่องเรือชมวาฬ',
      '骑马确认', '骆驼骑行确认', '大象营地确认', '观鲸确认',
      '乗馬確認', 'サファリツアー予約完了', '象使い体験確認', 'ホエールウォッチング確認',
      '승마 확인', '사파리 투어 예약 완료', '코끼리 트레킹 확인', '고래 관찰 확인',
      'Reiten bestätigt', 'Safariausflug gebucht', 'Elefantensafari bestätigt',
      'Подтверждение конной прогулки',
      'Xác nhận cưỡi ngựa',
      'Konfirmasi safari',
      'Paseo a caballo confirmado',
    ],
  },
  {
    kind: 'wellness',
    senders: ['x@spafinder.com', 'x@booksy.com', 'x@treatwell.com', 'x@vagaro.com'],
    subjects: [
      'Spa booking confirmed', 'Massage appointment', 'Wellness reservation confirmed',
      'Treatment booking', 'Spa day confirmed',
      'Spa bevestigd', 'Massage afspraak bevestigd', 'Wellnessreservering bevestigd',
      'ยืนยันการนวด', 'ยืนยันการจองสปา',
      '水疗预订确认', '按摩预约确认',
      'スパ予約確認', 'マッサージ予約完了',
      '스파 예약 확인', '마사지 예약 완료',
      'Spa Buchung bestätigt', 'Massage Termin',
      'Подтверждение спа-процедуры',
      'Xác nhận đặt spa',
      'Konfirmasi pemesanan spa',
      'Reserva de spa confirmada',
    ],
  },
  {
    kind: 'sport',
    senders: [],
    subjects: [
      'Golf tee time confirmed', 'Golf booking', 'Tennis court confirmed',
      'Sports facility booking', 'Golf round confirmed',
      'Golftijd bevestigd', 'Tennisbaan geboekt', 'Sportfaciliteit bevestigd',
      'ยืนยันการจองกอล์ฟ', 'ยืนยันสนามเทนนิส',
      '高尔夫预订确认', '网球场预订确认',
      'ゴルフ予約確認', 'テニスコート予約完了',
      '골프 예약 확인', '테니스 코트 예약 완료',
      'Golf Buchung bestätigt', 'Tennisplatz gebucht',
      'Подтверждение игры в гольф',
      'Xác nhận đặt sân golf',
      'Konfirmasi pemesanan golf',
      'Reserva de golf confirmada',
    ],
  },
];

for (const row of CATEGORY_CASES) {
  test(`${row.kind}: every sender and every language the brief lists`, () => {
    for (const from of row.senders) {
      assert.equal(classifyKind(from, 'Booking confirmed'), row.kind, `${row.kind} from ${from}`);
    }
    for (const subject of row.subjects) {
      assert.equal(classifyKind('someone@unknown.example', subject), row.kind, `${row.kind}: ${subject}`);
    }
  });
}

test('the kinds that already existed are untouched by J/2 and J/3', () => {
  assert.equal(classifyKind('noreply@booking.com', 'Your booking is confirmed'), 'hotel');
  assert.equal(classifyKind('x@agoda.com', 'Booking confirmation'), 'hotel');
  // Airbnb, Vrbo and Tripadvisor stay hotels: moving a sender that already works would change what the
  // app has been telling people about bookings they can already see.
  assert.equal(classifyKind('x@airbnb.com', 'Reservation confirmed'), 'hotel');
  assert.equal(classifyKind('x@vrbo.com', 'Booking confirmed'), 'hotel');
  assert.equal(classifyKind('x@tripadvisor.com', 'Your booking'), 'hotel');
  assert.equal(classifyKind('x@thaiairways.com', 'Your e-ticket'), 'flight');
  assert.equal(classifyKind('x@getyourguide.com', 'Tour confirmed'), 'excursion');
  assert.equal(classifyKind('x@opentable.com', 'Your reservation'), 'restaurant');
  // Trains and buses, including the seller that does trains, buses and boats at once.
  assert.equal(classifyKind('x@trainline.com', 'Your train ticket'), 'transport');
  assert.equal(classifyKind('x@flixbus.com', 'Bus ticket'), 'transport');
  assert.equal(classifyKind('x@12go.asia', 'Your ticket'), 'transport');
  for (const subject of ['Train ticket', 'Rail ticket', 'Coach ticket', 'Trein', 'Zugticket', 'ตั๋วรถไฟ']) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'transport', subject);
  }
});

test('car hire keeps every sender it had, and a camper joins it [J/3]', () => {
  for (const from of ['x@hertz.com', 'x@sixt.com', 'x@avis.com', 'x@rentalcars.com', 'x@europcar.com',
    'x@budget.com', 'x@enterprise.com', 'x@alamo.com', 'x@nationalcar.com', 'x@dollar.com', 'x@thrifty.com']) {
    assert.equal(classifyKind(from, 'Your rental confirmation'), 'carRental', from);
  }
  for (const from of ['x@goldcar.com', 'x@keddy.com', 'x@campanda.com', 'x@yescapa.com', 'x@mcrent.com',
    'x@motorhome-republic.com']) {
    assert.equal(classifyKind(from, 'Your rental'), 'carRental', from);
  }
  for (const subject of [
    'Campervan rental confirmed', 'Motorhome booking', 'RV rental confirmed', 'Camper hire confirmed',
    'Camper huren bevestigd', 'Campervan geboekt', 'ยืนยันการเช่าแคมเปอร์แวน',
    '房车租赁确认', '露营车预订', 'キャンピングカーレンタル確認', '캠핑카 렌탈 확인',
    'Wohnmobil bestätigt', 'Camper Buchung',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'carRental', subject);
  }
});

test('a car firm named after an ordinary word needs the subject to agree [J/3]', () => {
  assert.equal(classifyKind('x@fox.com', 'Your car rental confirmation'), 'carRental');
  assert.equal(classifyKind('x@firefly.com', 'Car hire confirmation'), 'carRental');
  assert.equal(classifyKind('x@fox.com', 'Breaking news tonight'), '');
  assert.equal(classifyKind('x@record.com', 'New album out now'), '');
  // And they are never searched, so a scan cannot pull their newsletters in.
  const q = searched();
  for (const needle of ['fox.com', 'record.com', 'firefly.com', 'routes.com']) {
    assert.equal(q.includes(needle), false, needle);
  }
});

test('the new kinds are grouped, and the beds sit behind the hotels [J/2 + J/3]', () => {
  const item = (kind: string) => ({ id: kind, kind, sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 });
  const kinds = ['hostel', 'bandB', 'vacationRental', 'camping', 'boatRental', 'ferry', 'cruise', 'transfer', 'parking'];
  for (const kind of kinds) {
    assert.equal(groupItems([item(kind)] as never)[0]?.kind, kind, `${kind} is grouped`);
  }
  assert.deepEqual(
    groupItems([item('boatRental'), item('hotel'), item('carRental'), item('hostel'), item('ferry')] as never)
      .map(g => g.kind),
    ['hotel', 'hostel', 'boatRental', 'carRental', 'ferry'],
  );
});

test('the Gmail search asks for the new senders and phrases [J/2 + J/3]', () => {
  const q = searched();
  for (const needle of [
    'hostelworld', 'pitchup', 'clickandboat', 'vacasa', 'stenaline', 'msccruises', 'kiwitaxi', 'parkvia',
    'campanda', 'hostel booking confirmed', 'ferry booking confirmed', 'airport parking booking',
  ]) {
    assert.ok(q.includes(needle), needle);
  }
});

test('the ticket guard holds: an e-ticket is still a flight [J/4]', () => {
  // "event" now claims "your ticket" and "ticket confirmed", so the flight wordings are checked here.
  for (const subject of [
    'Your e-ticket', 'Your e-ticket TG922 on 21 Sep 2026', 'eTicket confirmation',
    'Your itinerary', 'Boarding pass', 'Instapkaart', 'Reisschema',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'flight', subject);
  }
  // From an airline, whatever the subject says about tickets.
  for (const from of ['x@thaiairways.com', 'x@klm.com', 'x@emirates.com']) {
    assert.equal(classifyKind(from, 'Your ticket is confirmed'), 'flight', from);
    assert.equal(classifyKind(from, 'Ticket confirmed'), 'flight', from);
  }
  // A flight extra bought on top of a ticket still wins over the ticket itself (ancillaryFirst).
  assert.equal(classifyKind('x@klm.com', 'Extra baggage confirmed'), 'extraBaggage');
});

test('the excursion category is left alone, tour wording included [J/4b]', () => {
  // Sellers of excursions keep every mail they had.
  for (const from of ['x@getyourguide.com', 'x@viator.com', 'x@klook.com', 'x@tiqets.com', 'x@musement.com',
    'x@civitatis.com']) {
    assert.equal(classifyKind(from, 'Booking confirmed'), 'excursion', from);
  }
  /*
   * "tour confirmed", "ausflug", "ทัวร์" and "excursion" have meant an excursion since long before these
   * categories existed, so a tour-worded booking stays one. Only a more specific compound of the same word
   * moves — a Tauchausflug is a dive trip.
   */
  for (const subject of [
    'Jeep tour confirmed', 'Cycling tour confirmed', 'Mountain bike tour confirmed',
    'Snorkeling tour confirmed', 'Tuk-tuk tour confirmed', 'Guided tour', 'Day tour',
    'Ausflug bestätigt', 'ยืนยันทัวร์จักรยาน', 'ยืนยันทัวร์ช้าง',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'excursion', subject);
  }
  assert.equal(classifyKind('someone@unknown.example', 'Tauchausflug bestätigt'), 'diving');
  assert.equal(classifyKind('someone@unknown.example', 'Safariausflug gebucht'), 'experience');
  assert.equal(classifyKind('someone@unknown.example', 'Excursión de buceo confirmada'), 'diving');
});

test('a sender whose mail is mostly not a booking needs the subject to agree [J/4]', () => {
  // Yelp reviews restaurants far more often than it books them; Udemy and Coursera teach at a desk.
  assert.equal(classifyKind('x@yelp.com', 'Your table booking'), 'restaurant');
  assert.equal(classifyKind('x@yelp.com', 'New reviews near you'), '');
  assert.equal(classifyKind('x@udemy.com', 'Your course booking confirmed'), 'course');
  assert.equal(classifyKind('x@udemy.com', '50% off this weekend'), '');
  const q = searched();
  for (const needle of ['yelp.com', 'udemy.com', 'coursera.com']) {
    assert.equal(q.includes(needle), false, needle);
  }
});

test('PADI sells courses and trips, and its mail reads as diving [J/4 + J/4b]', () => {
  // The brief lists padi.com under both. The sender says diving; a subject that names a course still does.
  assert.equal(classifyKind('x@padi.com', 'Your booking'), 'diving');
  assert.equal(classifyKind('someone@unknown.example', 'Dive course confirmed'), 'course');
});

test('the Gmail search asks for the new things to do [J/4 + J/4b]', () => {
  const q = searched();
  for (const needle of [
    'ticketmaster', 'eventbrite', 'vfsglobal', 'prioritypass', 'divebooker', 'bikesbooking', 'spafinder',
    'visa approved', 'lounge access confirmed', 'spa booking confirmed', 'golf tee time confirmed',
  ]) {
    assert.ok(q.includes(needle), needle);
  }
});

test('the batches share the page of results out, one id each in turn', () => {
  // Three batches; a busy one cannot take the whole page.
  assert.deepEqual(
    mergeListPages([['a1', 'a2', 'a3', 'a4'], ['b1', 'b2'], ['c1']], 5),
    ['a1', 'b1', 'c1', 'a2', 'b2'],
  );
  // A mail that matched both a sender batch and a subject batch is read once.
  assert.deepEqual(mergeListPages([['x', 'y'], ['x', 'z']], 10), ['x', 'y', 'z']);
  // The cap is what keeps the header reads — and the time budget — where they were.
  assert.equal(mergeListPages([Array.from({ length: 200 }, (_, i) => `m${i}`)], 50).length, 50);
  // Nothing to merge, and nothing asked for.
  assert.deepEqual(mergeListPages([], 50), []);
  assert.deepEqual(mergeListPages([['a']], 0), []);
  assert.deepEqual(mergeListPages([[], ['b'], []], 5), ['b']);
});

test('one batch failing is not the scan failing', () => {
  // The regression this guards: batching the searches turned a single dropped request into "your inbox
  // could not be scanned". Anything that came back carries the scan.
  assert.equal(listOutcome([{ ids: ['a'] }, { ids: [], failed: true, offline: true }]), 'ok');
  assert.equal(listOutcome([{ ids: [] }, { ids: [], failed: true }]), 'ok', 'an empty answer is an answer');
  assert.equal(listOutcome([{ ids: ['a'] }, { ids: [], denied: true }]), 'ok');
});

test('a scan only fails when every batch did, and says which wall it hit', () => {
  assert.equal(listOutcome([{ ids: [], denied: true }, { ids: [], denied: true }]), 'not_connected');
  assert.equal(listOutcome([{ ids: [], failed: true, offline: true }]), 'offline');
  assert.equal(listOutcome([{ ids: [], failed: true }, { ids: [], failed: true }]), 'error');
  // A dead network explains a refusal better than a refusal explains a dead network.
  assert.equal(listOutcome([{ ids: [], denied: true }, { ids: [], failed: true, offline: true }]), 'offline');
  assert.equal(listOutcome([{ ids: [], denied: true }, { ids: [], failed: true }]), 'not_connected');
  // Nothing to report on is not a scan that worked.
  assert.equal(listOutcome([]), 'error');
});

test('a scan reads no more headers than before the split', () => {
  // 25 searches, each allowed its own small page, still come down to one page of work.
  const queries = gmailQueries(SCAN_DAYS_DEFAULT);
  const perQuery = Math.max(5, Math.ceil(50 / queries.length) * 2);
  const pages = queries.map((_, q) => Array.from({ length: perQuery }, (_, i) => `q${q}-m${i}`));
  assert.equal(mergeListPages(pages, 50).length, 50, 'capped at one page');
  assert.ok(queries.length * perQuery > 50, 'the batches really do offer more than fits');
});
