import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCAN_DAYS_DEFAULT,
  brandLabel,
  classifyKind,
  foldSubject,
  filterImported,
  gmailQuery,
  groupItems,
  itemFromMetadata,
  kindFromSenderAddress,
  matchesTravel,
  senderDomain,
  senderName,
  truncateSubject,
  type GmailInboxItem,
} from './gmailInboxScan.ts';

test('gmail query covers the window, the travel senders and the subject keywords', () => {
  const q = gmailQuery(SCAN_DAYS_DEFAULT);
  assert.match(q, /newer_than:90d/);
  assert.match(q, /from:\(.*\bbooking\b.*\bagoda\b.*\)/);
  assert.match(q, /subject:\(.*"booking confirmation".*"pick-up confirmation".*\)/);
  assert.match(gmailQuery(365), /newer_than:365d/);
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
  assert.match(gmailQuery(), /trip\.com/);
  assert.match(gmailQuery(), /ctrip\.com/);
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
  const q = gmailQuery();
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
  const q = gmailQuery();
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
  const q = gmailQuery();
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
  const q = gmailQuery();
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

/* ── Places to sleep that are not a hotel [J/2] ───────────────────────────────────────────────── */

test('hostels are recognised by their sender and in every language [J/2]', () => {
  assert.equal(classifyKind('noreply@hostelworld.com', 'Hostel booking confirmed'), 'hostel');
  assert.equal(classifyKind('x@hostelbookers.com', 'Dorm reservation'), 'hostel');
  assert.equal(classifyKind('x@meininger-hotels.com', 'Your bed is confirmed'), 'hostel');
  // And from a sender nobody knows, on the subject alone.
  for (const subject of [
    'Hostel confirmation', 'Hostelreservering bevestigd', 'ยืนยันการจองโฮสเทล',
    '青年旅舍预订确认', 'ホステル予約確認', '호스텔 예약 확인', 'Hostelreservierung bestätigt',
    'Подтверждение бронирования хостела',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'hostel', subject);
  }
});

test('camping, glamping and a pitch all read as camping [J/2]', () => {
  assert.equal(classifyKind('x@pitchup.com', 'Camping reservation confirmed'), 'camping');
  assert.equal(classifyKind('x@hipcamp.com', 'Your pitch booking confirmed'), 'camping');
  for (const subject of [
    'Glamping confirmed', 'Campingreservering bevestigd', 'Kampeerplaats geboekt',
    'ยืนยันการจองแคมปิ้ง', '露营地预订确认', 'キャンプ場予約確認', '캠핑장 예약 확인',
    'Campingplatz bestätigt', 'Xác nhận đặt chỗ cắm trại',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'camping', subject);
  }
});

test('a boat, a yacht and a houseboat are one kind [J/2]', () => {
  assert.equal(classifyKind('x@clickandboat.com', 'Boat rental confirmed'), 'boatRental');
  assert.equal(classifyKind('x@sailogy.com', 'Sailing charter confirmed'), 'boatRental');
  for (const subject of [
    'Yacht charter confirmed', 'Houseboat booking', 'Bootverhuur bevestigd', 'Woonboot reservering',
    'ยืนยันการเช่าเรือ', '游艇租赁确认', 'ヨットチャーター予約完了', '보트 렌탈 확인',
    'Yachtcharter Buchung', 'Alquiler de barco confirmado',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'boatRental', subject);
  }
});

test('whole homes are their own kind, and the hotel senders keep theirs [J/2]', () => {
  assert.equal(classifyKind('x@vacasa.com', 'Your stay is confirmed'), 'vacationRental');
  assert.equal(classifyKind('x@homeaway.com', 'Vacation rental confirmed'), 'vacationRental');
  for (const subject of [
    'Holiday home confirmed', 'Cottage booking confirmed', 'Vakantiewoning bevestigd',
    'Villa reservering bevestigd', 'ยืนยันการจองวิลล่า', '度假屋预订确认', '別荘予約完了',
    'Ferienwohnung bestätigt', 'Alquiler vacacional confirmado',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'vacationRental', subject);
  }
  // Airbnb, Vrbo and Tripadvisor are left exactly where they were: still hotels.
  assert.equal(classifyKind('x@airbnb.com', 'Reservation confirmed'), 'hotel');
  assert.equal(classifyKind('x@vrbo.com', 'Booking confirmed'), 'hotel');
  assert.equal(classifyKind('x@tripadvisor.com', 'Your booking'), 'hotel');
});

test('a bed and breakfast is not a hotel [J/2]', () => {
  for (const subject of [
    'B&B booking confirmed', 'Bed and breakfast reservation', 'Guesthouse confirmed',
    'Inn booking confirmed', 'Bed en breakfast bevestigd', 'Gastenhuis bevestigd',
    '民宿预订确认', 'B&B予約確認', '게스트하우스 예약 완료', 'Reserva de B&B confirmada',
  ]) {
    assert.equal(classifyKind('someone@unknown.example', subject), 'bandB', subject);
  }
});

test('the existing kinds are untouched by the new ones [J/2]', () => {
  assert.equal(classifyKind('noreply@booking.com', 'Your booking is confirmed'), 'hotel');
  assert.equal(classifyKind('x@agoda.com', 'Booking confirmation'), 'hotel');
  assert.equal(classifyKind('x@thaiairways.com', 'Your e-ticket'), 'flight');
  assert.equal(classifyKind('x@hertz.com', 'Your rental confirmation'), 'carRental');
  assert.equal(classifyKind('x@trainline.com', 'Your train ticket'), 'transport');
  assert.equal(classifyKind('x@getyourguide.com', 'Tour confirmed'), 'excursion');
  assert.equal(classifyKind('x@opentable.com', 'Your reservation'), 'restaurant');
});

test('the new kinds reach the results screen in a sensible order [J/2]', () => {
  const at = (kind: string) => groupItems([
    { id: kind, kind, sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 },
  ] as never)[0]?.kind;
  for (const kind of ['hostel', 'bandB', 'vacationRental', 'camping', 'boatRental']) {
    assert.equal(at(kind), kind, `${kind} is grouped`);
  }
  // The beds sit together, right behind the hotels.
  const all = groupItems([
    { id: 'a', kind: 'boatRental', sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 },
    { id: 'b', kind: 'hotel', sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 },
    { id: 'c', kind: 'carRental', sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 },
    { id: 'd', kind: 'hostel', sender: 's', senderDomain: 'd', subject: 's', dateMs: 1 },
  ] as never).map(g => g.kind);
  assert.deepEqual(all, ['hotel', 'hostel', 'boatRental', 'carRental']);
});

test('the Gmail search asks for the new stays too [J/2]', () => {
  const q = gmailQuery();
  for (const needle of ['hostelworld', 'pitchup', 'clickandboat', 'vacasa', 'hostel booking confirmed']) {
    assert.ok(q.includes(needle), needle);
  }
});
