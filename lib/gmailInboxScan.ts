/**
 * Gmail inbox scan for the opening screen: metadata only (sender, subject, date, message id).
 * No email body is read and nothing leaves the device — the results screen works from these fields alone.
 */

import { UPGRADE_DOMAINS, ancillaryFirst } from './ancillaryDetect.ts';

/**
 * 'excursion', 'transport' (trains, buses, ferries), 'insurance' and the six flight extras below are
 * detect-only: those mails are found and shown, but nothing parses them yet, so they cannot be imported
 * (see DETECT_ONLY_KINDS in screens/GmailImportScreen.tsx).
 */
export type GmailItemKind =
  'flight' | 'hotel' | 'carRental' | 'excursion' | 'transport' | 'insurance' | 'restaurant'
  /* The extras bought on top of a flight (lib/ancillaryDetect.ts). Detect-only, like transport above. */
  | 'extraBaggage' | 'specialAssistance' | 'mealOrder' | 'inflightPurchase' | 'cabinUpgrade'
  | 'petReservation'
  /* Places to sleep that are not a hotel. Detect-only: found and shown, never imported [J/2]. */
  | 'hostel' | 'camping' | 'boatRental' | 'vacationRental' | 'bandB'
  /* Ways of getting there and parking the car once you are. Detect-only [J/3]. */
  | 'ferry' | 'cruise' | 'transfer' | 'parking'
  /* What you booked for while you are there, and the paperwork to get in. Detect-only [J/4]. */
  | 'event' | 'course' | 'visa' | 'lounge'
  /* Out in the open, on a bike, in the water, or being looked after. Detect-only [J/4b]. */
  | 'diving' | 'bikeRental' | 'adventure' | 'experience' | 'wellness' | 'sport';

export type GmailInboxItem = {
  /** Gmail message id; also the dedupe key in gmail_imported_ids. */
  id: string;
  kind: GmailItemKind;
  sender: string;
  senderDomain: string;
  subject: string;
  dateMs: number;
};

export const SCAN_DAYS_DEFAULT = 90;
export const SCAN_DAYS_EXTENDED = 365;
export const SCAN_TIMEOUT_MS = 10_000;
export const SUBJECT_MAX = 40;

export const FLIGHT_DOMAINS = [
  'thaiairways.com', 'airasia.com', 'lionairthai.com', 'bangkokairways.com', 'nokair.com',
  'klm.com', 'emirates.com', 'singaporeair.com', 'cathaypacific.com',
  // Carriers whose brand label is an ordinary word or does not match their host, so the exact domain
  // decides: "ana", "jal" and "peach" as bare words would pull in unrelated senders, and Peach
  // Aviation writes from flypeach.com.
  'ana.co.jp', 'jal.co.jp', 'flypeach.com',
];
const HOTEL_DOMAINS = [
  'booking.com', 'agoda.com', 'agoda.co.th', 'hotels.com', 'airbnb.com', 'expedia.com', 'trip.com', 'ctrip.com',
  // Expedia Group
  'vrbo.com', 'orbitz.com', 'travelocity.com', 'wotif.com',
  // Booking Holdings
  'priceline.com', 'kayak.com',
  // Wholesaler and mobile-first OTAs whose mails reach the traveller directly
  'hotelbeds.com', 'bedsonline.com', 'hopper.com', 'tripadvisor.com',
];
const TRANSPORT_DOMAINS = [
  // Trainline sends from both of its domains; Omio and 12Go sell trains, buses and ferries.
  'trainline.com', 'thetrainline.com', 'flixbus.com', 'omio.com', '12go.asia',
];
/*
 * Travel insurance only. The bare brands "allianz" and "axa" are deliberately absent: those groups also sell
 * car, home and life insurance, and a policy renewal for your house is not a travel mail.
 */
const INSURANCE_DOMAINS = [
  'allianz-assistance.com', 'allianztravelinsurance.com', 'axa-assistance.com', 'axapartners.com',
];
const RESTAURANT_DOMAINS = [
  'opentable.com', 'thefork.com', 'iens.nl',
  'lafourchette.com', 'resy.com', 'quandoo.com',
  'bookatable.com', 'zomato.com',
  // [J/4] Table bookers that write only about tables.
  'tock.com', 'sevenrooms.com', 'eatigo.com',
];
const EXCURSION_DOMAINS = [
  'getyourguide.com', 'viator.com', 'klook.com', 'musement.com', 'civitatis.com', 'tiqets.com',
];
const CAR_DOMAINS = [
  'rentalcars.com', 'hertz.com', 'sixt.com', 'avis.com', 'budget.com', 'europcar.com',
  // Enterprise Mobility
  'enterprise.com', 'alamo.com', 'nationalcar.com',
  // Hertz Group
  'dollar.com', 'thrifty.com',
  // Europe and the Mediterranean
  'goldcar.es', 'goldcar.com', 'centauro.net', 'okmobility.com', 'keddy.com',
  // Car sharing, which rents you a car all the same
  'turo.com', 'zipcar.com',
];

/*
 * Places to sleep that are not a hotel [J/2]. The hotel lists above are left exactly as they were: Airbnb,
 * Vrbo and Tripadvisor keep reading as 'hotel', because moving a sender that already works into a new
 * category would change what the app has been telling people about their existing bookings.
 */
const HOSTEL_DOMAINS = [
  'hostelworld.com', 'hostelbookers.com', 'generator.com', 'meininger-hotels.com',
];
const CAMPING_DOMAINS = [
  'pitchup.com', 'campspace.com', 'hipcamp.com', 'coolcamping.com', 'glamping.com', 'campsited.com',
];
const BOAT_DOMAINS = [
  'clickandboat.com', 'boataround.com', 'samboat.com', 'nautal.com', 'sailogy.com',
];
/** Whole-home rentals. Only the senders the hotel lists do not already carry. */
const VACATION_DOMAINS = [
  'homeaway.com', 'wimdu.com', '9flats.com', 'vacasa.com', 'evolve.com',
];

/*
 * Getting there over water, and the car park you leave the car in [J/3].
 *
 * 12go.asia stays with the trains and buses: it sells all three, so its domain cannot say which. The cruise
 * lines below are listed by their exact domain and deliberately not as brands — "carnival", "princess" and
 * "viking" are ordinary words, and a brand is searched as a bare word.
 */
const FERRY_DOMAINS = [
  'stenaline.com', 'dfds.com', 'brittany-ferries.com', 'irishferries.com', 'directferries.com',
  'gophuket.com',
];
const CRUISE_DOMAINS = [
  'msccruises.com', 'royalcaribbean.com', 'carnival.com', 'costacruises.com', 'ncl.com',
  'cunard.com', 'viking.com', 'princess.com', 'hollandamerica.com',
];
const TRANSFER_DOMAINS = [
  'kiwitaxi.com', 'hoppa.com', 'jayride.com', 'welcomepickups.com', 'mozio.com', 'transferz.com',
  'airportshuttles.com',
];
const PARKING_DOMAINS = [
  'parkvia.com', 'holidayextras.com', 'parkos.com', 'skyparksecure.com', 'valet.com',
  'airparks.co.uk', 'purpleparkingusa.com',
];
/** Campers and motorhomes: a rental car with a bed in it, so they join the car kind [J/3]. */
const CAMPER_DOMAINS = [
  'campanda.com', 'yescapa.com', 'mcrent.com', 'motorhome-republic.com',
];
/**
 * Car hire firms whose domain is an ordinary word with a much larger company behind it — Fox, Record,
 * Firefly, Routes. They are never searched (that would pull every Fox newsletter into the scan) and only
 * name a car rental when the subject says so as well.
 */
const CAR_DOMAINS_WEAK = ['fox.com', 'record.com', 'firefly.com', 'routes.com'];
const CAR_SUBJECT_WORDS = ['rental', 'rent a car', 'car hire', 'huurauto', 'autohuur', 'mietwagen'];

/*
 * Things to do, paperwork, and being looked after [J/4 + J/4b].
 *
 * GetYourGuide, Viator, Klook, Tiqets and Musement are deliberately absent: they already name their mails
 * 'excursion', and moving them would change a category that works. PADI and SSI sell dive courses and dive
 * trips both; their mails read as diving, and a subject that says "course" still says so.
 */
const EVENT_DOMAINS = [
  'ticketmaster.com', 'eventbrite.com', 'stubhub.com', 'viagogo.com', 'fever.com', 'dice.fm',
];
const COURSE_DOMAINS = ['berlitz.com', 'cookly.com', 'bookretreats.com'];
const VISA_DOMAINS = [
  'esta.cbp.dhs.gov', 'eta.immi.gov.au', 'vfsglobal.com', 'tlscontact.com', 'ivisa.com', 'visahq.com',
];
const LOUNGE_DOMAINS = [
  'prioritypass.com', 'loungekey.com', 'collinson.com', 'dragonpass.com', 'loungereview.com',
];
const DIVING_DOMAINS = ['padi.com', 'ssi.com', 'divebooker.com', 'divinginternational.com'];
const BIKE_DOMAINS = ['bikesbooking.com', 'spinlister.com', 'donkeyrepublic.com', 'tokyobike.com'];
const WELLNESS_DOMAINS = ['spafinder.com', 'booksy.com', 'treatwell.com', 'vagaro.com'];
/**
 * Senders whose mail is mostly not a booking: Yelp is a review site, Udemy and Coursera sell lessons at a
 * desk. Never searched, and they only name a category when the subject confirms something.
 */
const RESTAURANT_DOMAINS_WEAK = ['yelp.com'];
const RESTAURANT_SUBJECT_WORDS = ['reservation', 'table', 'booking', 'reservering', 'tafel'];
const COURSE_DOMAINS_WEAK = ['udemy.com', 'coursera.com', 'airbnbexperiences.com'];
const COURSE_SUBJECT_WORDS = ['course', 'workshop', 'class', 'lesson', 'cursus', 'les ', 'kurs'];

export const TRAVEL_DOMAINS = [
  ...HOTEL_DOMAINS, ...FLIGHT_DOMAINS, ...CAR_DOMAINS, ...EXCURSION_DOMAINS, ...TRANSPORT_DOMAINS,
  ...INSURANCE_DOMAINS, ...RESTAURANT_DOMAINS,
  ...HOSTEL_DOMAINS, ...CAMPING_DOMAINS, ...BOAT_DOMAINS, ...VACATION_DOMAINS,
  ...FERRY_DOMAINS, ...CRUISE_DOMAINS, ...TRANSFER_DOMAINS, ...PARKING_DOMAINS, ...CAMPER_DOMAINS,
  ...EVENT_DOMAINS, ...COURSE_DOMAINS, ...VISA_DOMAINS, ...LOUNGE_DOMAINS,
  ...DIVING_DOMAINS, ...BIKE_DOMAINS, ...WELLNESS_DOMAINS,
  // Upgrade bidding platforms write about one thing only, and it is a flight extra.
  ...UPGRADE_DOMAINS,
];

/**
 * Suffixes that carry a country's second level, so the brand sits one label further left:
 * expedia.co.uk and agoda.com.sg are the brand "expedia" / "agoda", not "co" / "com".
 */
const CC_SUFFIXES = [
  'co.uk', 'co.th', 'co.jp', 'co.kr', 'co.nz', 'co.id', 'co.in', 'co.za', 'co.il',
  'com.au', 'com.br', 'com.mx', 'com.sg', 'com.hk', 'com.tr', 'com.cn', 'com.vn', 'com.my',
  'com.ph', 'com.ar', 'com.co', 'com.tw',
];

/** The brand in a host name: mail.expedia.co.uk → expedia, secure.booking.com → booking. */
export function brandLabel(host: string): string {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return '';
  const suffix = parts.slice(-2).join('.');
  const at = CC_SUFFIXES.includes(suffix) ? parts.length - 3 : parts.length - 2;
  return at >= 0 ? parts[at] : '';
}

/**
 * The same OTA mails you from expedia.com, expedia.nl or expedia.co.uk depending on where you booked, so the
 * brand decides rather than the exact domain. Only brands whose name is not a normal word are listed here:
 * "kayak" and "hotels" stay in the domain lists above, where kayak.org (a canoe club) cannot match.
 */
const HOTEL_BRANDS = [
  'booking', 'agoda', 'airbnb', 'expedia', 'vrbo', 'orbitz', 'travelocity', 'wotif',
  'priceline', 'hotelbeds', 'bedsonline', 'tripadvisor',
];
export const FLIGHT_BRANDS = [
  'thaiairways', 'airasia', 'bangkokairways', 'nokair', 'lionair',
  'batikair', 'scoot', 'tigerair', 'malindoair', 'airdo',
  'emirates', 'etihad', 'flydubai', 'airarabia', 'omanair',
  'singaporeair', 'cathaypacific', 'koreanair', 'asiana', 'jejuair',
  'jetstar', 'qantas', 'virginaustralia',
  'garuda', 'citilink',
  'klm', 'lufthansa', 'airfrance', 'britishairways', 'iberia',
  'turkishairlines', 'wizzair', 'ryanair', 'easyjet',
];
const CAR_BRANDS = [
  'rentalcars', 'europcar', 'hertz', 'sixt', 'alamo', 'nationalcar', 'thrifty', 'goldcar',
  'turo', 'zipcar', 'okmobility',
];

/*
 * [J/2] Brands for the new places to sleep. "generator", "glamping" and "evolve" are deliberately absent:
 * they are ordinary words, and a brand is searched as a bare word — those three stay in their domain lists.
 */
const EVENT_BRANDS = ['ticketmaster', 'eventbrite', 'stubhub', 'viagogo'];
const COURSE_BRANDS = ['berlitz', 'cookly', 'bookretreats'];
const VISA_BRANDS = ['vfsglobal', 'tlscontact', 'ivisa', 'visahq'];
const LOUNGE_BRANDS = ['prioritypass', 'loungekey', 'dragonpass', 'loungereview'];
const DIVING_BRANDS = ['divebooker', 'divinginternational'];
const BIKE_BRANDS = ['bikesbooking', 'spinlister', 'donkeyrepublic', 'tokyobike'];
const WELLNESS_BRANDS = ['spafinder', 'treatwell', 'vagaro'];

const FERRY_BRANDS = ['stenaline', 'dfds', 'brittany-ferries', 'irishferries', 'directferries', 'gophuket'];
const CRUISE_BRANDS = ['msccruises', 'royalcaribbean', 'costacruises', 'cunard', 'hollandamerica'];
const TRANSFER_BRANDS = ['kiwitaxi', 'jayride', 'welcomepickups', 'mozio', 'transferz'];
const PARKING_BRANDS = ['parkvia', 'holidayextras', 'parkos', 'skyparksecure', 'airparks'];
const CAMPER_BRANDS = ['campanda', 'yescapa', 'mcrent', 'motorhome-republic'];

const HOSTEL_BRANDS = ['hostelworld', 'hostelbookers', 'meininger-hotels'];
const CAMPING_BRANDS = ['pitchup', 'campspace', 'hipcamp', 'coolcamping', 'campsited'];
const BOAT_BRANDS = ['clickandboat', 'boataround', 'samboat', 'nautal', 'sailogy'];
const VACATION_BRANDS = ['homeaway', 'wimdu', 'vacasa'];

const EXCURSION_BRANDS = ['getyourguide', 'viator', 'klook', 'musement', 'civitatis', 'tiqets'];
// FlixBus writes from flixbus.de and flixbus.nl as well as .com, so the brand covers the country domains.
const TRANSPORT_BRANDS = ['trainline', 'thetrainline', 'flixbus', 'omio', '12go'];
// Zomato is left out on purpose: it is a food-delivery brand far more often than a table booking.
const RESTAURANT_BRANDS = [
  'opentable', 'thefork', 'iens', 'lafourchette',
  'resy', 'quandoo', 'bookatable',
];

const BRAND_KIND: [string[], GmailItemKind][] = [
  [HOTEL_BRANDS, 'hotel'],
  [HOSTEL_BRANDS, 'hostel'],
  [CAMPING_BRANDS, 'camping'],
  [BOAT_BRANDS, 'boatRental'],
  [VACATION_BRANDS, 'vacationRental'],
  [FERRY_BRANDS, 'ferry'],
  [CRUISE_BRANDS, 'cruise'],
  [TRANSFER_BRANDS, 'transfer'],
  [PARKING_BRANDS, 'parking'],
  [CAMPER_BRANDS, 'carRental'],
  [EVENT_BRANDS, 'event'],
  [COURSE_BRANDS, 'course'],
  [VISA_BRANDS, 'visa'],
  [LOUNGE_BRANDS, 'lounge'],
  [DIVING_BRANDS, 'diving'],
  [BIKE_BRANDS, 'bikeRental'],
  [WELLNESS_BRANDS, 'wellness'],
  [FLIGHT_BRANDS, 'flight'],
  [CAR_BRANDS, 'carRental'],
  [EXCURSION_BRANDS, 'excursion'],
  [TRANSPORT_BRANDS, 'transport'],
  [RESTAURANT_BRANDS, 'restaurant'],
];

/** Flight, hotel or car rental from the sender's brand, whatever country domain it wrote from. */
export function kindFromBrand(from: string): GmailItemKind | '' {
  const brand = brandLabel(String(from || '').match(/@([A-Za-z0-9.-]+)/)?.[1] || '');
  if (!brand) return '';
  for (const [brands, kind] of BRAND_KIND) if (brands.includes(brand)) return kind;
  return '';
}

/**
 * Subjects are compared folded: lower case, without accents and with the typographic apostrophe flattened,
 * so "Buchungsbestätigung", "BUCHUNGSBESTATIGUNG" and "réservation" all match the same keyword. Thai and the
 * other non-Latin scripts pass through unchanged. The keyword lists stay readable (written with accents) and
 * are folded once below; the Gmail query keeps the accented spelling, which is what the senders write.
 */
export function foldSubject(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    .replace(/ß/g, 'ss')
    .replace(/[’‘`´]/g, "'");
}

/** Subject phrases that make a mail travel-related even from a sender we do not know. */
export const SUBJECT_KEYWORDS = [
  /*
   * The extras bought on top of a flight. Only the strongest phrase per kind is listed: this list is also
   * the Gmail search itself, so every entry lengthens the query every scan sends. The full wording lives in
   * lib/ancillaryDetect.ts, which reads whatever the search brings back.
   */
  'extra baggage', 'additional baggage', 'special assistance', 'special meal', 'meal preference',
  'inflight purchase', 'duty free order', 'upgrade confirmed', 'pet reservation', 'pet in cabin',
  'extra bagage', 'speciale assistentie', 'speciale maaltijd', 'upgrade bevestigd', 'huisdier aan boord',
  /*
   * Places to sleep that are not a hotel [J/2]. Only the strongest phrase per kind, and only in the
   * languages these confirmations mostly arrive in here — every entry lengthens the query of every scan.
   * The full wording per language lives in KIND_KEYWORDS below, which reads whatever the search brings back.
   */
  'hostel booking confirmed', 'hostelreservering bevestigd', 'ยืนยันการจองโฮสเทล',
  'camping reservation confirmed', 'campingreservering bevestigd', 'ยืนยันการจองแคมปิ้ง',
  'boat rental confirmed', 'bootverhuur bevestigd', 'ยืนยันการเช่าเรือ',
  'vacation rental confirmed', 'vakantiewoning bevestigd', 'ยืนยันการจองวิลล่า',
  'bed and breakfast reservation', 'bed en breakfast bevestigd',
  /* Over water, transfers and parking [J/3], same rule: the strongest phrase only. */
  'ferry booking confirmed', 'veerboot bevestigd', 'ยืนยันตั๋วเรือเฟอร์รี่',
  'cruise booking confirmed', 'cruise bevestigd',
  'airport transfer booking', 'luchthaventransfer geboekt', 'ยืนยันการจองรถรับส่ง',
  'airport parking booking', 'luchthavenparkeren geboekt', 'valet parking confirmed',
  'campervan rental confirmed', 'camper huren bevestigd',
  /* Things to do, paperwork and looking after yourself [J/4 + J/4b], strongest phrase only. */
  'restaurant reservation confirmed', 'restaurantreservering bevestigd', 'ยืนยันการจองร้านอาหาร',
  'event confirmation', 'evenement bevestigd', 'ยืนยันตั๋วงาน',
  'course booking confirmed', 'cursus bevestigd', 'ยืนยันการจองคอร์ส',
  'visa approved', 'esta approved', 'visum goedgekeurd',
  'lounge access confirmed', 'loungetoegang bevestigd',
  'dive trip confirmed', 'duiktrip bevestigd', 'ยืนยันทริปดำน้ำ',
  'bike rental confirmed', 'fietshuur bevestigd',
  'skydiving confirmed', 'hot air balloon confirmed', 'ballonvaart geboekt',
  'safari confirmed', 'whale watching confirmed', 'paardrijden bevestigd',
  'spa booking confirmed', 'spa bevestigd', 'ยืนยันการจองสปา',
  'golf tee time confirmed', 'golftijd bevestigd',
  // ── English ──────────────────────────────────────────────
  'booking confirmed', 'booking confirmation', 'reservation confirmed',
  'flight confirmed', 'flight confirmation', 'your flight booking',
  'your flight is confirmed', 'travel confirmation',
  'your itinerary', 'travel itinerary', 'e-ticket', 'eticket',
  'ticket confirmation', 'ticket issued',
  'your booking', 'you\'re booked', 'you are booked',
  'your reservation', 'hotel confirmation', 'your rental',
  'pick-up confirmation', 'check-in', 'your rental confirmation',
  'car rental confirmation', 'activity confirmation', 'tour confirmed',
  'your tickets', 'excursion', 'train ticket', 'bus ticket',
  'travel insurance', 'your transfer', 'driver details',
  'pickup confirmation',

  // ── Dutch ─────────────────────────────────────────────────
  'boekingsbevestiging', 'vluchtbevestiging', 'je vlucht is bevestigd',
  'je boeking', 'uw boeking', 'bevestiging', 'reisbevestiging',
  'vliegticket', 'vertrekbevestiging', 'je vluchtbevestiging',
  'hotelbevestiging', 'huurauto', 'autohuurbevestiging',
  'activiteit', 'treinticket', 'busticket', 'reisverzekering',
  'transferbevestiging',

  // ── German ────────────────────────────────────────────────
  'buchungsbestätigung', 'flugbestätigung', 'flugbuchung',
  'ihre buchung', 'ihre reservierung', 'reisebestätigung',
  'ihr flug', 'reiseunterlagen', 'ticketbestätigung',
  'hotelbestätigung', 'hotelbuchung', 'mietwagenbestätigung',
  'zugticket', 'bahnticket', 'reiseversicherung',
  'transferbestätigung',

  // ── French ────────────────────────────────────────────────
  'confirmation de réservation', 'confirmation de vol',
  'votre réservation', 'votre vol', 'votre billet',
  'billet électronique', 'votre séjour', 'votre location de voiture',
  'confirmation d\'activité', 'billet de train', 'assurance voyage',
  'confirmation de transfert',

  // ── Spanish ───────────────────────────────────────────────
  'confirmación de reserva', 'confirmación de vuelo',
  'tu reserva', 'su reserva', 'tu vuelo', 'billete de avión',
  'tu estancia', 'alquiler de coche', 'excursión',
  'billete de tren', 'seguro de viaje', 'confirmación de traslado',

  // ── Portuguese ────────────────────────────────────────────
  'confirmação de reserva', 'confirmação de voo',
  'seu voo', 'bilhete electrónico', 'sua reserva',
  'aluguel de carro', 'seguro de viagem',

  // ── Italian ───────────────────────────────────────────────
  'conferma prenotazione', 'conferma volo', 'il tuo volo',
  'biglietto aereo', 'il tuo soggiorno', 'noleggio auto',

  // ── Thai ──────────────────────────────────────────────────
  'ยืนยันการจอง', 'การจองของคุณ', 'ยืนยันเที่ยวบิน',
  'ตั๋วเครื่องบินของคุณ', 'ตั๋วของคุณ', 'ยืนยันการจองโรงแรม',
  'ยืนยันการเช่ารถ', 'ประกันการเดินทาง', 'ทัวร์', 'ตั๋วรถไฟ',

  // ── Japanese ──────────────────────────────────────────────
  'ご予約確認', '航空券のご確認', '搭乗のご案内', 'ご搭乗案内',
  'フライト予約確認', '航空券確認', 'ご宿泊確認', 'ご予約内容',
  'レンタカー予約確認', 'ご旅行の確認',

  // ── Chinese (Simplified) ──────────────────────────────────
  '机票确认', '您的航班', '行程确认', '预订确认',
  '酒店预订确认', '您的住宿', '租车确认', '旅游行程',

  // ── Chinese (Traditional) ─────────────────────────────────
  '機票確認', '行程確認', '訂單確認',
  '飯店預訂確認', '租車確認',

  // ── Korean ────────────────────────────────────────────────
  '항공권 예약 확인', '탑승 안내', '예약 확인',
  '호텔 예약 확인', '렌터카 예약 확인', '여행 일정 확인',

  // ── Arabic ────────────────────────────────────────────────
  'تأكيد الحجز', 'تذكرة الطيران', 'تأكيد رحلتك',
  'تأكيد الحجز في الفندق', 'تأكيد حجز السيارة',
  'تفاصيل رحلتك', 'تأكيد النقل',

  // ── Indonesian / Malay ────────────────────────────────────
  'konfirmasi penerbangan', 'tiket pesawat', 'pesanan anda dikonfirmasi',
  'konfirmasi hotel', 'reservasi hotel', 'konfirmasi sewa mobil',
  'pengesahan penerbangan', 'tiket anda',

  // ── Excursions & attractions (all languages) ──────────────
  'guided tour',
  'your tour', 'day tour', 'excursie', 'ausflug',
  'aktivität', 'activité', 'actividad',
  'กิจกรรม', 'アクティビティ確認', '活动确认', '액티비티 예약',
  'konfirmasi tur',

  // ── Restaurants ───────────────────────────────────────────
  'your table is confirmed', 'dining reservation',
  'restaurant reservation', 'tafelreservering bevestigd',
  'restaurantreservering', 'tischreservierung',
  'réservation restaurant', 'reserva de restaurante',
  'prenotazione ristorante', 'ご予約確認（レストラン）',
  'レストラン予約', '餐厅预订确认', '식당 예약 확인',

  // ── Transport (trains, buses, ferries) ───────────────────
  'veerboot',
  'fernbus',
  'billet de bus',
  'billete de autobús',
  'รถทัวร์', 'รถบัส',
  '電車チケット', '列車予約', '火车票确认', '버스 티켓',
  'tiket kereta', 'tiket bus',

  // ── Travel insurance ──────────────────────────────────────
  '旅行保険', '旅行保险', '여행 보험',
];

/**
 * Keywords that also say which kind it is. Words that can only mean one product come first and win: a German
 * mail saying "Buchungsbestätigung für Ihren Flug" is a flight, even though the confirmation phrase alone
 * usually means a hotel. Short words that hide inside unrelated ones (French "vol") are left out on purpose —
 * these are matched as plain substrings, which is what makes German compounds ("Flugticket") work.
 */
const KIND_KEYWORDS: [string, GmailItemKind][] = [
  ['e-ticket', 'flight'],
  ['eticket', 'flight'],
  ['your flight', 'flight'],
  ['your itinerary', 'flight'],
  ['boarding pass', 'flight'],
  ['your rental', 'carRental'],
  ['pick-up confirmation', 'carRental'],
  // Dutch
  ['vlucht', 'flight'],
  ['instapkaart', 'flight'],
  ['reisschema', 'flight'],
  ['huurauto', 'carRental'],
  ['autohuur', 'carRental'],
  ['hotelbevestiging', 'hotel'],
  ['verblijf bevestigd', 'hotel'],
  ['boeking bij', 'hotel'],
  // Travel insurance. Only reached once the mail is already travel (a known sender or a travel subject),
  // so the plain policy words below cannot pull in a car or home policy on their own.
  ['travel insurance', 'insurance'],
  ['insurance policy', 'insurance'],
  ['reisverzekering', 'insurance'],
  ['verzekeringspolis', 'insurance'],
  ['reiseversicherung', 'insurance'],
  ['versicherungsschein', 'insurance'],
  ['assurance voyage', 'insurance'],
  ['seguro de viaje', 'insurance'],
  ['ประกันการเดินทาง', 'insurance'],
  /*
   * ── Over water [J/3] ─────────────────────────────────────────────────────────────────────────
   * Before the train and bus block, which is otherwise untouched: "ferry ticket" and "veerboot" used to
   * read as a generic transport mail and now name the boat they are about. Bare "fähre" stays out, as it
   * always was — it hides inside Fahrer.
   */
  ['ferry ticket', 'ferry'],
  ['ferry booking', 'ferry'],
  ['ferry reservation', 'ferry'],
  ['crossing confirmed', 'ferry'],
  ['veerboot', 'ferry'],
  ['overtocht', 'ferry'],
  ['เรือเฟอร์รี่', 'ferry'],
  ['ข้ามฟาก', 'ferry'],
  ['渡轮', 'ferry'],
  ['轮渡票', 'ferry'],
  ['フェリー', 'ferry'],
  ['乗船券', 'ferry'],
  ['페리', 'ferry'],
  ['도선', 'ferry'],
  ['fahrticket', 'ferry'],
  ['fahrbuchung', 'ferry'],
  ['fährticket', 'ferry'],
  ['fährbuchung', 'ferry'],
  ['паром', 'ferry'],
  ['vé phà', 'ferry'],
  ['tiket feri', 'ferry'],
  ['reserva de ferry', 'ferry'],

  ['cruise booking', 'cruise'],
  ['cruise reservation', 'cruise'],
  ['cruise ticket', 'cruise'],
  ['embarkation', 'cruise'],
  ['cruisebooking', 'cruise'],
  ['cruiseboeking', 'cruise'],
  ['cruise bevestigd', 'cruise'],
  ['cruise confirmed', 'cruise'],
  ['inscheping', 'cruise'],
  ['เรือสำราญ', 'cruise'],
  ['邮轮', 'cruise'],
  ['游轮票', 'cruise'],
  ['クルーズ', 'cruise'],
  ['乗船確認', 'cruise'],
  ['크루즈', 'cruise'],
  ['승선 확인', 'cruise'],
  ['kreuzfahrt', 'cruise'],
  ['круиз', 'cruise'],
  ['du thuyền', 'cruise'],
  ['pemesanan cruise', 'cruise'],
  ['crucero', 'cruise'],

  /* ── Picked up, dropped off, parked [J/3] ──────────────────────────────────────────────────── */
  ['airport transfer', 'transfer'],
  ['private transfer', 'transfer'],
  ['transfer confirmed', 'transfer'],
  ['taxi booking', 'transfer'],
  ['shuttle confirmed', 'transfer'],
  ['minibus transfer', 'transfer'],
  ['luchthaventransfer', 'transfer'],
  ['transfer bevestigd', 'transfer'],
  ['taxi reservering', 'transfer'],
  ['รถรับส่ง', 'transfer'],
  ['接送服务', 'transfer'],
  ['机场接送', 'transfer'],
  ['送迎', 'transfer'],
  ['空港転送', 'transfer'],
  ['공항 픽업', 'transfer'],
  ['셔틀 예약', 'transfer'],
  ['flughafentransfer', 'transfer'],
  ['transfer bestatigt', 'transfer'],
  ['трансфер', 'transfer'],
  ['xe đưa đón', 'transfer'],
  ['pemesanan transfer', 'transfer'],
  ['traslado', 'transfer'],

  ['airport parking', 'parking'],
  ['car park reservation', 'parking'],
  ['parking confirmed', 'parking'],
  ['parking reservation', 'parking'],
  ['valet parking', 'parking'],
  ['valet service', 'parking'],
  ['valet reservation', 'parking'],
  ['meet and greet parking', 'parking'],
  ['parkeren bevestigd', 'parking'],
  ['luchthavenparkeren', 'parking'],
  ['parkeerplaats bevestigd', 'parking'],
  ['ที่จอดรถ', 'parking'],
  ['วาเลต์', 'parking'],
  ['停车预订', 'parking'],
  ['代客泊车', 'parking'],
  ['駐車場予約', 'parking'],
  ['バレーパーキング', 'parking'],
  ['주차 예약', 'parking'],
  ['발레 파킹', 'parking'],
  ['parkplatz bestatigt', 'parking'],
  ['flughafenparken', 'parking'],
  ['valet parken', 'parking'],
  ['парковк', 'parking'],
  ['đậu xe', 'parking'],
  ['pemesanan parkir', 'parking'],
  ['aparcamiento', 'parking'],

  /* Campers and motorhomes are a rental car with a bed in it [J/3]. */
  // Specific on purpose: a bare "campervan" also matches a camping pitch for one ("campervan site").
  ['campervan rental', 'carRental'],
  ['campervan hire', 'carRental'],
  ['campervan geboekt', 'carRental'],
  ['motorhome', 'carRental'],
  ['rv rental', 'carRental'],
  ['camper hire', 'carRental'],
  ['camper huren', 'carRental'],
  ['camper buchung', 'carRental'],
  ['แคมเปอร์แวน', 'carRental'],
  ['房车租赁', 'carRental'],
  ['露营车预订', 'carRental'],
  ['キャンピングカー', 'carRental'],
  ['캠핑카', 'carRental'],
  ['wohnmobil', 'carRental'],

  // Trains, buses and ferries. Before the excursion block: the Thai word for a coach (รถทัวร์) contains the
  // word for a tour (ทัวร์). Bare "bahn", "bus" and "fähre" are left out — they hide inside Autobahn,
  // Business and Fahrer.
  ['train ticket', 'transport'],
  ['rail ticket', 'transport'],
  ['your train', 'transport'],
  ['bus ticket', 'transport'],
  ['coach ticket', 'transport'],
  ['your bus', 'transport'],
  ['trein', 'transport'],
  ['busticket', 'transport'],
  ['zugticket', 'transport'],
  ['bahnticket', 'transport'],
  ['fernbus', 'transport'],
  ['billet de train', 'transport'],
  ['billet de bus', 'transport'],
  ['billete de tren', 'transport'],
  ['billete de autobús', 'transport'],
  ['ตั๋วรถไฟ', 'transport'],
  ['รถทัวร์', 'transport'],
  ['รถบัส', 'transport'],
  // Excursions, tours and attraction tickets. These come before the German flight words on purpose:
  // "Ausflug" (an excursion) contains "Flug" (a flight). "tour" on its own is left out — it hides inside
  // tourist, tournament and Tourismus.
  /*
   * A Tauchausflug is a dive trip and a Safariausflug is a safari; both contain "Ausflug" [J/4b]. The more
   * specific compound is read first, and a plain "Ausflug" still means an excursion, as it always has.
   */
  ['tauchausflug', 'diving'],
  ['excursion de buceo', 'diving'],
  ['safariausflug', 'experience'],
  ['excursion', 'excursion'],
  ['excursie', 'excursion'],
  ['ausflug', 'excursion'],
  ['activity confirmation', 'excursion'],
  ['tour confirmed', 'excursion'],
  ['guided tour', 'excursion'],
  ['your tour', 'excursion'],
  ['day tour', 'excursion'],
  ['activiteit', 'excursion'],
  ['aktivität', 'excursion'],
  ['activité', 'excursion'],
  ['actividad', 'excursion'],
  ['ทัวร์', 'excursion'],
  ['กิจกรรม', 'excursion'],
  // German — "flug" also covers Abflug, Flugticket and Flughafen.
  ['flug', 'flight'],
  ['bordkarte', 'flight'],
  ['mietwagen', 'carRental'],
  ['autovermietung', 'carRental'],
  ['hotelbuchung', 'hotel'],
  ['unterkunft', 'hotel'],
  // French — "embarquement" also covers the Spanish "tarjeta de embarque".
  ['embarque', 'flight'],
  ['billet électronique', 'flight'],
  ['location de voiture', 'carRental'],
  ['votre séjour', 'hotel'],
  // Spanish
  ['vuelo', 'flight'],
  ['alquiler de coche', 'carRental'],
  ['alquiler de auto', 'carRental'],
  ['reserva de hotel', 'hotel'],
  ['estancia', 'hotel'],
  // Thai: flight, e-ticket, car rental, hotel booking.
  ['เที่ยวบิน', 'flight'],
  ['ตั๋วเครื่องบิน', 'flight'],
  ['เช่ารถ', 'carRental'],
  ['จองโรงแรม', 'hotel'],
  // Japanese — product words only. "ご予約確認" is just "reservation confirmed" and says nothing about the
  // product, so it sits in WEAK_KIND_KEYWORDS below.
  ['航空券', 'flight'],
  ['搭乗', 'flight'],
  ['フライト', 'flight'],
  ['ご宿泊確認', 'hotel'],
  ['レンタカー', 'carRental'],
  ['アクティビティ確認', 'excursion'],
  ['電車チケット', 'transport'],
  ['列車予約', 'transport'],
  ['旅行保険', 'insurance'],

  // Chinese Simplified — "行程确认" (itinerary confirmed) is deliberately absent from both keyword lists:
  // Chinese carriers use it for flights and hotels alike. It stays a subject keyword, so the mail is found
  // by the scan but left without a kind rather than guessed wrong.
  ['机票确认', 'flight'],
  ['您的航班', 'flight'],
  ['酒店预订确认', 'hotel'],
  ['您的住宿', 'hotel'],
  ['租车确认', 'carRental'],
  ['活动确认', 'excursion'],
  ['火车票确认', 'transport'],
  ['旅行保险', 'insurance'],

  // Chinese Traditional — "行程確認" is left out for the same reason.
  ['機票確認', 'flight'],
  ['飯店預訂確認', 'hotel'],
  ['租車確認', 'carRental'],

  // Korean
  ['항공권 예약 확인', 'flight'],
  ['탑승 안내', 'flight'],
  ['호텔 예약 확인', 'hotel'],
  ['렌터카 예약 확인', 'carRental'],
  ['액티비티 예약', 'excursion'],
  ['버스 티켓', 'transport'],
  ['여행 보험', 'insurance'],

  // Arabic — "تأكيد الحجز" (booking confirmed) is the opening of the hotel phrase, so the longer and more
  // specific entries have to be matched first or every hotel mail would be read as a flight.
  ['تأكيد الحجز في الفندق', 'hotel'],
  ['تأكيد حجز السيارة', 'carRental'],
  ['تذكرة الطيران', 'flight'],
  ['تأكيد رحلتك', 'flight'],
  ['تأكيد النقل', 'transport'],
  ['تأكيد الحجز', 'flight'],

  // Indonesian / Malay
  ['konfirmasi penerbangan', 'flight'],
  ['tiket pesawat', 'flight'],
  ['pengesahan penerbangan', 'flight'],
  ['konfirmasi hotel', 'hotel'],
  ['reservasi hotel', 'hotel'],
  ['konfirmasi sewa mobil', 'carRental'],
  ['konfirmasi tur', 'excursion'],
  ['tiket kereta', 'transport'],
  ['tiket bus', 'transport'],

  // Portuguese
  ['confirmação de voo', 'flight'],
  ['bilhete electrónico', 'flight'],
  ['confirmação de reserva', 'hotel'],
  ['aluguel de carro', 'carRental'],

  // Italian
  ['conferma volo', 'flight'],
  ['biglietto aereo', 'flight'],
  ['conferma prenotazione', 'hotel'],
  ['noleggio auto', 'carRental'],

  // Restaurants: the subject phrases in SUBJECT_KEYWORDS mark a restaurant booking, but there is no
  // 'restaurant' kind yet, so they are deliberately left out here — adding that kind is a separate task.

  /*
   * ── Places to sleep that are not a hotel [J/2] ────────────────────────────────────────────────
   * Appended on purpose: the list is read in order and the first match wins, so everything above keeps
   * classifying exactly as it did. "hostel" is safe to match bare — it cannot hide inside "hotel".
   */
  ['hostel', 'hostel'],
  ['dorm reservation', 'hostel'],
  ['bed confirmed', 'hostel'],
  ['slaapzaal', 'hostel'],
  ['โฮสเทล', 'hostel'],
  ['青年旅舍', 'hostel'],
  ['宿舍床位', 'hostel'],
  ['ホステル', 'hostel'],
  ['ドミトリー', 'hostel'],
  ['호스텔', 'hostel'],
  ['도미토리', 'hostel'],
  ['hostelreservierung', 'hostel'],
  ['хостел', 'hostel'],

  ['camping reservation', 'camping'],
  ['campsite', 'camping'],
  ['glamping', 'camping'],
  ['pitch booking', 'camping'],
  ['campervan site', 'camping'],
  ['campingreservering', 'camping'],
  ['kampeerplaats', 'camping'],
  ['แคมปิ้ง', 'camping'],
  ['ที่พักกลางแจ้ง', 'camping'],
  ['露营地', 'camping'],
  ['豪华露营', 'camping'],
  ['キャンプ場', 'camping'],
  ['グランピング', 'camping'],
  ['캠핑장', 'camping'],
  ['글램핑', 'camping'],
  ['campingplatz', 'camping'],
  ['pemesanan camping', 'camping'],
  ['reserva de camping', 'camping'],
  ['кемпинг', 'camping'],
  ['cắm trại', 'camping'],

  ['boat rental', 'boatRental'],
  ['boat hire', 'boatRental'],
  ['yacht charter', 'boatRental'],
  ['houseboat', 'boatRental'],
  ['sailing charter', 'boatRental'],
  ['bootverhuur', 'boatRental'],
  ['jachtcharter', 'boatRental'],
  ['woonboot', 'boatRental'],
  ['เช่าเรือ', 'boatRental'],
  ['เช่ายอร์ช', 'boatRental'],
  ['租船', 'boatRental'],
  ['游艇租赁', 'boatRental'],
  ['ボートレンタル', 'boatRental'],
  ['ヨットチャーター', 'boatRental'],
  ['보트 렌탈', 'boatRental'],
  ['요트 차터', 'boatRental'],
  ['bootsverleih', 'boatRental'],
  ['yachtcharter', 'boatRental'],
  ['аренды лодки', 'boatRental'],
  ['thuê thuyền', 'boatRental'],
  ['sewa perahu', 'boatRental'],
  ['alquiler de barco', 'boatRental'],

  ['vacation rental', 'vacationRental'],
  ['holiday home', 'vacationRental'],
  ['cottage booking', 'vacationRental'],
  ['condo rental', 'vacationRental'],
  ['vakantiewoning', 'vacationRental'],
  ['villa confirmed', 'vacationRental'],
  ['villa reservering', 'vacationRental'],
  ['apartment booking', 'vacationRental'],
  ['appartement geboekt', 'vacationRental'],
  ['appartement buchung', 'vacationRental'],
  ['pemesanan villa', 'vacationRental'],
  ['公寓预订', 'vacationRental'],
  ['บ้านพักตากอากาศ', 'vacationRental'],
  ['วิลล่า', 'vacationRental'],
  ['度假屋', 'vacationRental'],
  ['别墅预订', 'vacationRental'],
  ['バケーションレンタル', 'vacationRental'],
  ['別荘', 'vacationRental'],
  ['휴가용 임대', 'vacationRental'],
  ['빌라', 'vacationRental'],
  ['ferienwohnung', 'vacationRental'],
  ['аренды жилья', 'vacationRental'],
  ['nhà nghỉ dưỡng', 'vacationRental'],
  ['alquiler vacacional', 'vacationRental'],

  ['b&b booking', 'bandB'],
  ['bed and breakfast', 'bandB'],
  ['guesthouse', 'bandB'],
  ['inn booking', 'bandB'],
  ['bed en breakfast', 'bandB'],
  ['gastenhuis', 'bandB'],
  ['เบดแอนด์เบรกฟาสต์', 'bandB'],
  ['民宿预订', 'bandB'],
  ['早餐旅馆', 'bandB'],
  ['b&b予約', 'bandB'],
  ['b&b 예약', 'bandB'],
  ['b&b buchung', 'bandB'],
  ['pemesanan b&b', 'bandB'],
  ['phòng b&b', 'bandB'],
  ['民宿予約', 'bandB'],
  ['게스트하우스', 'bandB'],
  ['бронирования b&b', 'bandB'],
  ['phòng b&b', 'bandB'],
  ['reserva de b&b', 'bandB'],

  /*
   * ── What you booked for while you are there [J/4 + J/4b] ─────────────────────────────────────
   * Last in the list on purpose. Anything the excursion, flight or transport words already claim keeps
   * its kind: "jeep tour confirmed" and "cycling tour confirmed" stay excursions, because "tour confirmed"
   * has meant that since long before these categories existed.
   */
  ['restaurant reservation', 'restaurant'],
  ['table booking', 'restaurant'],
  ['dining reservation', 'restaurant'],
  ['your table is booked', 'restaurant'],
  ['restaurantreservering', 'restaurant'],
  ['tafel geboekt', 'restaurant'],
  ['ยืนยันการจองร้านอาหาร', 'restaurant'],
  ['ยืนยันโต๊ะอาหาร', 'restaurant'],
  ['餐厅预订', 'restaurant'],
  ['餐桌预订', 'restaurant'],
  ['レストラン予約', 'restaurant'],
  ['お席の予約', 'restaurant'],
  ['레스토랑 예약', 'restaurant'],
  ['식당 예약', 'restaurant'],
  ['tischreservierung', 'restaurant'],
  ['бронирования ресторана', 'restaurant'],
  ['đặt bàn nhà hàng', 'restaurant'],
  ['reservasi restoran', 'restaurant'],
  ['reserva de restaurante', 'restaurant'],

  ['event confirmation', 'event'],
  ['event confirmed', 'event'],
  ['ticket confirmed', 'event'],
  ['concert ticket', 'event'],
  ['museum ticket', 'event'],
  ['show ticket', 'event'],
  ['entry ticket', 'event'],
  ['festival ticket', 'event'],
  ['your ticket', 'event'],
  ['je ticket', 'event'],
  ['evenement bevestigd', 'event'],
  ['concertticket', 'event'],
  ['museumticket', 'event'],
  ['festivalticket', 'event'],
  ['ยืนยันตั๋วงาน', 'event'],
  ['ยืนยันตั๋วคอนเสิร์ต', 'event'],
  ['ยืนยันตั๋วพิพิธภัณฑ์', 'event'],
  ['活动票', 'event'],
  ['演唱会票', 'event'],
  ['博物馆票', 'event'],
  ['チケット確認', 'event'],
  ['コンサートチケット', 'event'],
  ['イベントチケット', 'event'],
  ['티켓 확인', 'event'],
  ['콘서트 티켓', 'event'],
  ['박물관 티켓', 'event'],
  ['ticket bestatigt', 'event'],
  ['konzertticket', 'event'],
  ['veranstaltungsticket', 'event'],
  ['билета на мероприятие', 'event'],
  ['vé sự kiện', 'event'],
  ['tiket acara', 'event'],
  ['entrada confirmada', 'event'],

  ['course booking', 'course'],
  ['course confirmed', 'course'],
  ['workshop confirmed', 'course'],
  ['workshop geboekt', 'course'],
  ['lesson booking', 'course'],
  ['class confirmed', 'course'],
  ['dive course', 'course'],
  ['language course', 'course'],
  ['cooking class', 'course'],
  ['surf lesson', 'course'],
  ['yoga retreat', 'course'],
  ['photography workshop', 'course'],
  ['cursus bevestigd', 'course'],
  ['duikcursus', 'course'],
  ['kookworkshop', 'course'],
  ['les bevestigd', 'course'],
  ['ยืนยันการจองคอร์ส', 'course'],
  ['ยืนยันการเรียน', 'course'],
  ['ยืนยันคลาสดำน้ำ', 'course'],
  ['ยืนยันคลาสทำอาหาร', 'course'],
  ['课程预订', 'course'],
  ['工作坊', 'course'],
  ['潜水课程', 'course'],
  ['烹饪课', 'course'],
  ['コース予約', 'course'],
  ['ワークショップ', 'course'],
  ['ダイビングコース', 'course'],
  ['料理教室', 'course'],
  ['강좌 예약', 'course'],
  ['워크숍', 'course'],
  ['다이빙 코스', 'course'],
  ['요리 수업', 'course'],
  ['kurs bestatigt', 'course'],
  ['workshop buchung', 'course'],
  ['tauchkurs', 'course'],
  ['kochkurs', 'course'],
  ['записи на курс', 'course'],
  ['đặt khóa học', 'course'],
  ['pemesanan kursus', 'course'],
  ['reserva de curso', 'course'],

  ['visa approved', 'visa'],
  ['esta approved', 'visa'],
  ['eta confirmed', 'visa'],
  ['travel authorization approved', 'visa'],
  ['visa confirmation', 'visa'],
  ['entry permit', 'visa'],
  ['evisa approved', 'visa'],
  ['visum goedgekeurd', 'visa'],
  ['esta bevestigd', 'visa'],
  ['reistoestemming', 'visa'],
  ['วีซ่าอนุมัติ', 'visa'],
  ['ยืนยัน esta', 'visa'],
  ['ใบอนุญาตเข้าประเทศ', 'visa'],
  ['签证批准', 'visa'],
  ['esta确认', 'visa'],
  ['入境许可', 'visa'],
  ['ビザ承認', 'visa'],
  ['esta承認', 'visa'],
  ['入国許可', 'visa'],
  ['비자 승인', 'visa'],
  ['esta 승인', 'visa'],
  ['입국 허가', 'visa'],
  ['visum genehmigt', 'visa'],
  ['einreisegenehmigung', 'visa'],
  ['виза одобрена', 'visa'],
  ['подтверждение esta', 'visa'],
  ['visa được chấp thuận', 'visa'],
  ['xác nhận esta', 'visa'],
  ['visa disetujui', 'visa'],
  ['konfirmasi esta', 'visa'],
  ['visado aprobado', 'visa'],
  ['esta confirmado', 'visa'],

  ['lounge access', 'lounge'],
  ['lounge pass', 'lounge'],
  ['airport lounge', 'lounge'],
  ['priority pass', 'lounge'],
  ['lounge reservation', 'lounge'],
  ['loungetoegang', 'lounge'],
  ['loungereservering', 'lounge'],
  ['ยืนยันการเข้าใช้เลานจ์', 'lounge'],
  ['บัตรเข้าเลานจ์', 'lounge'],
  ['贵宾室预订', 'lounge'],
  ['机场贵宾厅', 'lounge'],
  ['ラウンジ予約', 'lounge'],
  ['空港ラウンジ', 'lounge'],
  ['라운지 예약', 'lounge'],
  ['공항 라운지', 'lounge'],
  ['lounge zugang', 'lounge'],
  ['lounge buchung', 'lounge'],
  ['доступа в лаунж', 'lounge'],
  ['phòng chờ sân bay', 'lounge'],
  ['akses lounge', 'lounge'],
  ['sala vip', 'lounge'],

  /* ── Out in the open, in the water, on a bike [J/4b] ──────────────────────────────────────────── */
  ['dive trip', 'diving'],
  ['dive booking', 'diving'],
  ['scuba confirmed', 'diving'],
  ['snorkel trip', 'diving'],
  ['snorkeling confirmed', 'diving'],
  ['duiktrip', 'diving'],
  ['snorkeltrip', 'diving'],
  ['ยืนยันทริปดำน้ำ', 'diving'],
  ['ยืนยันการดำน้ำตื้น', 'diving'],
  ['潜水行程', 'diving'],
  ['浮潜行程', 'diving'],
  ['ダイビングツアー', 'diving'],
  ['シュノーケリング', 'diving'],
  ['다이빙 투어', 'diving'],
  ['스노클링', 'diving'],
  ['schnorcheltour', 'diving'],
  ['дайв-тура', 'diving'],
  ['chuyến lặn', 'diving'],
  ['trip diving', 'diving'],

  ['bike rental', 'bikeRental'],
  ['bicycle hire', 'bikeRental'],
  ['e-bike rental', 'bikeRental'],
  ['fietshuur', 'bikeRental'],
  ['fietstour', 'bikeRental'],
  ['e-bike huur', 'bikeRental'],
  ['ยืนยันการเช่าจักรยาน', 'bikeRental'],
  ['自行车租赁', 'bikeRental'],
  ['电动自行车预订', 'bikeRental'],
  ['自転車レンタル', 'bikeRental'],
  ['サイクリングツアー', 'bikeRental'],
  ['자전거 렌탈', 'bikeRental'],
  ['사이클링 투어', 'bikeRental'],
  ['fahrradverleih', 'bikeRental'],
  ['fahrradtour', 'bikeRental'],
  ['аренды велосипеда', 'bikeRental'],
  ['thuê xe đạp', 'bikeRental'],
  ['sewa sepeda', 'bikeRental'],
  ['alquiler de bicicleta', 'bikeRental'],

  ['skydiving', 'adventure'],
  ['parachute jump', 'adventure'],
  ['bungee jump', 'adventure'],
  ['paragliding', 'adventure'],
  ['hot air balloon', 'adventure'],
  ['zip line', 'adventure'],
  ['go-kart', 'adventure'],
  ['race experience', 'adventure'],
  ['buggy rental', 'adventure'],
  ['quad bike', 'adventure'],
  ['atv rental', 'adventure'],
  ['skydiven', 'adventure'],
  ['ballonvaart', 'adventure'],
  ['kartbaan', 'adventure'],
  ['bungeejumpen', 'adventure'],
  ['quad verhuur', 'adventure'],
  ['ยืนยันการกระโดดร่ม', 'adventure'],
  ['ยืนยันการล่องบอลลูน', 'adventure'],
  ['ยืนยันการขับรถโกคาร์ต', 'adventure'],
  ['跳伞', 'adventure'],
  ['热气球预订', 'adventure'],
  ['卡丁车预订', 'adventure'],
  ['スカイダイビング', 'adventure'],
  ['熱気球', 'adventure'],
  ['ゴーカート', 'adventure'],
  ['스카이다이빙', 'adventure'],
  ['열기구', 'adventure'],
  ['고카트', 'adventure'],
  ['fallschirmspringen', 'adventure'],
  ['heissluftballon', 'adventure'],
  ['heißluftballon', 'adventure'],
  ['прыжка с парашютом', 'adventure'],
  ['nhảy dù', 'adventure'],
  ['paracaidismo', 'adventure'],

  ['horse riding', 'experience'],
  ['camel ride', 'experience'],
  ['safari confirmed', 'experience'],
  ['safaritour', 'experience'],
  ['rickshaw', 'experience'],
  ['elephant sanctuary', 'experience'],
  ['whale watching', 'experience'],
  ['paardrijden', 'experience'],
  ['olifantensafari', 'experience'],
  ['huifkar', 'experience'],
  ['walvissen spotten', 'experience'],
  ['ยืนยันการขี่ม้า', 'experience'],
  ['ยืนยันซาฟารี', 'experience'],
  ['ยืนยันล่องเรือชมวาฬ', 'experience'],
  ['骑马', 'experience'],
  ['骆驼骑行', 'experience'],
  ['大象营地', 'experience'],
  ['观鲸', 'experience'],
  ['乗馬', 'experience'],
  ['サファリツアー', 'experience'],
  ['象使い体験', 'experience'],
  ['ホエールウォッチング', 'experience'],
  ['승마', 'experience'],
  ['사파리 투어', 'experience'],
  ['코끼리 트레킹', 'experience'],
  ['고래 관찰', 'experience'],
  ['reiten bestatigt', 'experience'],
  ['elefantensafari', 'experience'],
  ['конной прогулки', 'experience'],
  ['cưỡi ngựa', 'experience'],
  ['konfirmasi safari', 'experience'],
  ['paseo a caballo', 'experience'],

  ['spa booking', 'wellness'],
  ['spa day', 'wellness'],
  ['massage appointment', 'wellness'],
  ['wellness reservation', 'wellness'],
  ['treatment booking', 'wellness'],
  ['spa bevestigd', 'wellness'],
  ['massage afspraak', 'wellness'],
  ['wellnessreservering', 'wellness'],
  ['ยืนยันการนวด', 'wellness'],
  ['ยืนยันการจองสปา', 'wellness'],
  ['水疗预订', 'wellness'],
  ['按摩预约', 'wellness'],
  ['スパ予約', 'wellness'],
  ['マッサージ予約', 'wellness'],
  ['스파 예약', 'wellness'],
  ['마사지 예약', 'wellness'],
  ['spa buchung', 'wellness'],
  ['massage termin', 'wellness'],
  ['спа-процедуры', 'wellness'],
  ['đặt spa', 'wellness'],
  ['pemesanan spa', 'wellness'],
  ['reserva de spa', 'wellness'],

  ['golf tee time', 'sport'],
  ['golf booking', 'sport'],
  ['golf round', 'sport'],
  ['tennis court', 'sport'],
  ['sports facility', 'sport'],
  ['golftijd', 'sport'],
  ['tennisbaan', 'sport'],
  ['sportfaciliteit', 'sport'],
  ['ยืนยันการจองกอล์ฟ', 'sport'],
  ['ยืนยันสนามเทนนิส', 'sport'],
  ['高尔夫预订', 'sport'],
  ['网球场预订', 'sport'],
  ['ゴルフ予約', 'sport'],
  ['テニスコート', 'sport'],
  ['골프 예약', 'sport'],
  ['테니스 코트', 'sport'],
  ['golf buchung', 'sport'],
  ['tennisplatz', 'sport'],
  ['игры в гольф', 'sport'],
  ['đặt sân golf', 'sport'],
  ['pemesanan golf', 'sport'],
  ['reserva de golf', 'sport'],
];

/**
 * Confirmation phrases that are used for anything but most often mean a hotel. Only consulted when no keyword
 * above matched, so "online inchecken voor je vlucht" stays a flight instead of becoming a hotel check-in.
 */
const WEAK_KIND_KEYWORDS: [string, GmailItemKind][] = [
  ['hotel confirmation', 'hotel'],
  ['inchecken', 'hotel'],
  ['buchungsbestätigung', 'hotel'],
  ['ihre reservierung', 'hotel'],
  ['confirmation de réservation', 'hotel'],
  ['confirmación de reserva', 'hotel'],
  ['ご予約確認', 'hotel'],
];

const FOLDED_SUBJECT_KEYWORDS = SUBJECT_KEYWORDS.map(foldSubject);
const FOLDED_KIND_KEYWORDS: [string, GmailItemKind][] = [...KIND_KEYWORDS, ...WEAK_KIND_KEYWORDS]
  .map(([word, kind]) => [foldSubject(word), kind]);

/**
 * OTAs that sell flights, hotels and cars from one address and say which in the address itself —
 * Trip.com writes NL_HTL_NoReply@trip.com for a hotel and NL_FLT_NoReply@trip.com for a flight.
 */
const MULTI_PRODUCT_BRANDS = ['trip', 'ctrip', 'expedia', 'booking', 'priceline', 'orbitz', 'travelocity'];

const SENDER_HINT: [RegExp, GmailItemKind][] = [
  [/\b(htl|hotel|hotels|stay)\b/, 'hotel'],
  [/\b(act|activity|activities|tour|tours|experience|experiences)\b/, 'excursion'],
  [/\b(rail|train|trains|bus|buses|coach|ferry)\b/, 'transport'],
  [/\b(flt|flight|flights|air|ticket|eticket)\b/, 'flight'],
  [/\b(car|cars|rental|rentals)\b/, 'carRental'],
];

/** The product an OTA put in its own address, e.g. NL_HTL_NoReply@trip.com → hotel. '' when it says nothing. */
export function kindFromSenderAddress(from: string): GmailItemKind | '' {
  const local = String(from || '').match(/([A-Za-z0-9._%+-]+)@/)?.[1] || '';
  const words = ` ${local.toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ')} `;
  for (const [re, kind] of SENDER_HINT) if (re.test(words)) return kind;
  return '';
}

/**
 * The longest a single Gmail search may get, before URL encoding.
 *
 * The search travels as a GET parameter, so the whole of it ends up in the request URL. One query holding
 * every sender and every subject phrase reached 8,200 characters — close to 17,000 once encoded, because a
 * single Thai character costs nine — and a URL that size is refused long before Gmail reads it.
 */
export const QUERY_MAX_CHARS = 1200;

/**
 * And the same budget measured after encoding, which is the length that actually travels.
 *
 * Characters do not cost the same: a Latin letter encodes to itself, a Thai or Japanese one to nine bytes.
 * A batch of Thai phrases would reach the raw budget at roughly ten thousand encoded bytes, back over the
 * ceiling this split exists to stay under, so whichever budget runs out first ends the batch.
 */
export const QUERY_MAX_ENCODED = 6000;

/** Every sender worth searching: the domains, plus the brands that cover their own country domains. */
function searchSenders(): string[] {
  const brands = [
    ...HOTEL_BRANDS, ...FLIGHT_BRANDS, ...CAR_BRANDS, ...EXCURSION_BRANDS, ...TRANSPORT_BRANDS,
    ...RESTAURANT_BRANDS,
    ...HOSTEL_BRANDS, ...CAMPING_BRANDS, ...BOAT_BRANDS, ...VACATION_BRANDS,
    ...FERRY_BRANDS, ...CRUISE_BRANDS, ...TRANSFER_BRANDS, ...PARKING_BRANDS, ...CAMPER_BRANDS,
    ...EVENT_BRANDS, ...COURSE_BRANDS, ...VISA_BRANDS, ...LOUNGE_BRANDS,
    ...DIVING_BRANDS, ...BIKE_BRANDS, ...WELLNESS_BRANDS,
  ];
  // A brand covers every domain it writes from, so its own domains need not be listed again.
  const domains = TRAVEL_DOMAINS.filter(d => !brands.includes(brandLabel(d)));
  return [...domains, ...brands];
}

/**
 * Packs terms into `operator:(a OR b OR …)` clauses, none over either budget.
 *
 * Exported because the guarantee is worth testing on its own: whatever the script, and however long the
 * lists grow, no clause this returns can outgrow a request URL.
 */
export function packQueries(
  prefix: string,
  operator: 'from' | 'subject',
  terms: string[],
  max: number = QUERY_MAX_CHARS,
): string[] {
  const out: string[] = [];
  let batch: string[] = [];
  const build = (list: string[]) => `${prefix} ${operator}:(${list.join(' OR ')})`;
  const close = () => {
    if (!batch.length) return;
    out.push(build(batch));
    batch = [];
  };
  for (const term of terms) {
    const next = build([...batch, term]);
    if (batch.length && (next.length > max || encodeURIComponent(next).length > QUERY_MAX_ENCODED)) close();
    batch.push(term);
  }
  close();
  return out;
}

/**
 * The Gmail searches for one scan: the last `days` days, from a travel sender or with a travel subject.
 *
 * Split into batches rather than asked as one enormous query. Every sender and every phrase still appears in
 * exactly one batch, so a mail that would have been found before is still found — the union is the same set.
 * Running them together also shares the results out more evenly: one busy category can no longer fill the
 * whole page of results and push another category's confirmation off the end.
 *
 * Batching by size rather than by category is deliberate. The subject phrases are one flat list serving every
 * kind, and a batch that fills up simply starts another, so the split keeps working as the lists grow — which
 * is what produced the oversized query in the first place.
 */
export function gmailQueries(days = SCAN_DAYS_DEFAULT): string[] {
  const prefix = `newer_than:${Math.max(1, Math.round(days))}d`;
  return [
    ...packQueries(prefix, 'from', searchSenders()),
    ...packQueries(prefix, 'subject', SUBJECT_KEYWORDS.map(k => `"${k}"`)),
  ];
}

/**
 * The ids of one scan, taken fairly from the batches: one from each, then the next, until the page is full.
 *
 * Concatenating instead would hand the whole page to whichever batch answered first, and a mailbox full of
 * airline mail would push a hotel confirmation off the end. Duplicates are dropped — a mail can match a
 * sender batch and a subject batch both — and the total is capped, so the number of headers read afterwards
 * is the same as when there was one query.
 */
export function mergeListPages(pages: string[][], max: number): string[] {
  const limit = Math.max(0, Math.floor(max));
  const lists = (pages || []).map(p => (p || []).filter(Boolean));
  const seen = new Set<string>();
  const longest = lists.reduce((n, l) => Math.max(n, l.length), 0);
  for (let i = 0; i < longest && seen.size < limit; i += 1) {
    for (const list of lists) {
      if (seen.size >= limit) break;
      const id = list[i];
      if (id) seen.add(id);
    }
  }
  return [...seen];
}

/** The domain of a `From:` header, e.g. `"Booking.com" <noreply@booking.com>` → `booking.com`. */
export function senderDomain(from: string): string {
  const m = String(from || '').match(/@([A-Za-z0-9.-]+)/);
  const host = (m ? m[1] : '').toLowerCase().replace(/\.$/, '');
  if (!host) return '';
  const known = TRAVEL_DOMAINS.find(d => host === d || host.endsWith(`.${d}`));
  return known || host;
}

/** The display name of a `From:` header, falling back to the domain. */
export function senderName(from: string): string {
  const raw = String(from || '').trim();
  const quoted = raw.match(/^"?([^"<]+?)"?\s*</);
  const name = (quoted ? quoted[1] : '').trim();
  return name || senderDomain(raw) || raw;
}

/** Travel mail? A known sender domain, or a subject keyword. */
export function matchesTravel(from: string, subject: string): boolean {
  const domain = senderDomain(from);
  if (domain && TRAVEL_DOMAINS.includes(domain)) return true;
  if (kindFromBrand(from)) return true;
  const s = foldSubject(subject);
  return FOLDED_SUBJECT_KEYWORDS.some(k => s.includes(k));
}

/** Flight, hotel or car rental: the sender decides, else a subject keyword; '' when neither says. */
export function classifyKind(from: string, subject: string): GmailItemKind | '' {
  const s = foldSubject(subject);
  const domain = senderDomain(from);
  // A sender that sells everything: its own address is a better clue than the domain.
  if (MULTI_PRODUCT_BRANDS.includes(brandLabel(domain))) {
    const hint = kindFromSenderAddress(from);
    if (hint) return hint;
  }
  /*
   * An extra bought on top of a flight — a heavier bag, a wheelchair, a meal, wifi, an upgrade, the dog.
   * Asked before the domains, because these mails come from the airline's own address and would otherwise
   * all read as "flight". The ticket itself still wins (ancillaryFirst), and the detect-only kinds it
   * returns are shown but never imported.
   */
  const extra = ancillaryFirst(subject, domain);
  if (extra) return extra.kind;
  if (FLIGHT_DOMAINS.includes(domain)) return 'flight';
  if (HOTEL_DOMAINS.includes(domain)) return 'hotel';
  if (CAR_DOMAINS.includes(domain)) return 'carRental';
  if (TRANSPORT_DOMAINS.includes(domain)) return 'transport';
  if (INSURANCE_DOMAINS.includes(domain)) return 'insurance';
  if (EXCURSION_DOMAINS.includes(domain)) return 'excursion';
  if (RESTAURANT_DOMAINS.includes(domain)) return 'restaurant';
  // [J/2] Asked after every existing list, so no sender that already had a kind can change kind.
  if (HOSTEL_DOMAINS.includes(domain)) return 'hostel';
  if (CAMPING_DOMAINS.includes(domain)) return 'camping';
  if (BOAT_DOMAINS.includes(domain)) return 'boatRental';
  if (VACATION_DOMAINS.includes(domain)) return 'vacationRental';
  // [J/3] Water, transfers and parking. Again after every existing list, so no sender changes kind.
  if (FERRY_DOMAINS.includes(domain)) return 'ferry';
  if (CRUISE_DOMAINS.includes(domain)) return 'cruise';
  if (TRANSFER_DOMAINS.includes(domain)) return 'transfer';
  if (PARKING_DOMAINS.includes(domain)) return 'parking';
  if (CAMPER_DOMAINS.includes(domain)) return 'carRental';
  // A car firm named after an ordinary word: only with a rental word in the subject (CAR_DOMAINS_WEAK).
  if (CAR_DOMAINS_WEAK.includes(domain) && CAR_SUBJECT_WORDS.some(w => s.includes(w))) return 'carRental';
  // [J/4 + J/4b] Things to do, paperwork, lounges and looking after yourself.
  if (EVENT_DOMAINS.includes(domain)) return 'event';
  if (COURSE_DOMAINS.includes(domain)) return 'course';
  if (VISA_DOMAINS.includes(domain)) return 'visa';
  if (LOUNGE_DOMAINS.includes(domain)) return 'lounge';
  if (DIVING_DOMAINS.includes(domain)) return 'diving';
  if (BIKE_DOMAINS.includes(domain)) return 'bikeRental';
  if (WELLNESS_DOMAINS.includes(domain)) return 'wellness';
  if (RESTAURANT_DOMAINS_WEAK.includes(domain) && RESTAURANT_SUBJECT_WORDS.some(w => s.includes(w))) {
    return 'restaurant';
  }
  if (COURSE_DOMAINS_WEAK.includes(domain) && COURSE_SUBJECT_WORDS.some(w => s.includes(w))) return 'course';
  // A country domain of a brand we know, e.g. expedia.nl.
  const brandKind = kindFromBrand(from);
  if (brandKind) {
    // Brand-only senders (no recognised domain): require at least one subject
    // signal so newsletters and promotions are not mistaken for bookings.
    // Domain-matched senders (FLIGHT_DOMAINS etc.) are already specific enough.
    const hasSignal =
      FOLDED_KIND_KEYWORDS.some(([word]) => s.includes(word)) ||
      FOLDED_SUBJECT_KEYWORDS.some(k => s.includes(k));
    if (hasSignal) return brandKind;
  }
  for (const [word, kind] of FOLDED_KIND_KEYWORDS) if (s.includes(word)) return kind;
  return '';
}

type Header = { name?: string; value?: string };

/** One Gmail metadata response → a results-screen item; null when it is not travel or has no kind. */
export function itemFromMetadata(
  id: string,
  headers: Header[] | undefined,
  internalDate?: string | number | null,
): GmailInboxItem | null {
  const pick = (name: string) => {
    const hit = (headers || []).find(h => String(h?.name || '').toLowerCase() === name);
    return String(hit?.value || '').trim();
  };
  const from = pick('from');
  const subject = pick('subject');
  if (!id || !matchesTravel(from, subject)) return null;
  const kind = classifyKind(from, subject);
  if (!kind) return null;
  const headerDate = Date.parse(pick('date'));
  const stamp = Number(internalDate);
  const dateMs = Number.isFinite(stamp) && stamp > 0 ? stamp : (Number.isNaN(headerDate) ? 0 : headerDate);
  return { id, kind, sender: senderName(from), senderDomain: senderDomain(from), subject, dateMs };
}

/** Already-imported mails never show up again (on-device dedupe; no Gmail label, readonly scope). */
export function filterImported(items: GmailInboxItem[], importedIds: string[] | Set<string>): GmailInboxItem[] {
  const seen = importedIds instanceof Set ? importedIds : new Set(importedIds || []);
  return items.filter(i => !seen.has(i.id));
}

export function truncateSubject(subject: string, max = SUBJECT_MAX): string {
  const s = String(subject || '').trim();
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Newest first, grouped for the results screen. */
export function groupItems(items: GmailInboxItem[]): { kind: GmailItemKind; items: GmailInboxItem[] }[] {
  const order: GmailItemKind[] = [
    'flight', 'hotel', 'hostel', 'bandB', 'vacationRental', 'camping', 'boatRental',
    'carRental', 'transfer', 'parking', 'ferry', 'cruise',
    'excursion', 'restaurant', 'event', 'course', 'diving', 'adventure', 'experience',
    'bikeRental', 'sport', 'wellness', 'lounge', 'visa', 'transport', 'insurance',
    'cabinUpgrade', 'extraBaggage', 'mealOrder', 'specialAssistance', 'petReservation', 'inflightPurchase',
  ];
  return order
    .map(kind => ({ kind, items: items.filter(i => i.kind === kind).sort((a, b) => b.dateMs - a.dateMs) }))
    .filter(g => g.items.length > 0);
}
