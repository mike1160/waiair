import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { itemHint, partitionByHint, type GmailInboxItem } from './gmailInboxScan.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const item = (id: string, kind: GmailInboxItem['kind'], sender: string, domain: string, subject: string,
  promo?: { promotions?: boolean; unsubscribe?: boolean }): GmailInboxItem =>
  ({ id, kind, sender, senderDomain: domain, subject, dateMs: 1, promo: promo as never });

/** The real inbox from the report, as the scan would hand it over. */
const INBOX: GmailInboxItem[] = [
  item('t1', 'flight', 'Thai Airways', 'thaiairways.com', 'Thai Airways | Booking Confirmed'),
  item('t2', 'flight', 'Thai Airways', 'thaiairways.com', 'Thai Airways | Booking Confirmed'),
  item('t3', 'flight', 'Thai Airways', 'thaiairways.com', 'Thai Airways | Booking Confirmed'),
  item('k1', 'flight', 'KLM', 'infos-klm.com', 'Ticket voor uw reis'),
  item('a1', 'flight', 'AirAsia MOVE', 'airasia.com', 'Save up to 40% on Checked Baggage'),
  item('a2', 'flight', 'AirAsia MOVE', 'airasia.com', 'Japan Flight Deals'),
  item('a3', 'flight', 'AirAsia MOVE', 'airasia.com', 'Autumn Bliss in Japan', { promotions: true }),
  item('s1', 'flight', 'Singapore Airlines', 'singaporeair.com', 'Dining, elevated', { unsubscribe: true }),
  item('c1', 'flight', 'Cathay', 'cathaypacific.com', 'Inspiration by Cathay'),
  item('p1', 'hotel', 'Trip.com', 'trip.com', 'Trip Coins-saldo gewijzigd'),
  item('p2', 'hotel', 'Trip.com', 'trip.com', 'U bent nu Gold-lid!'),
  item('b1', 'hotel', 'Booking.com', 'booking.com', "Bespaar tot 20% op huurauto's"),
  item('n1', 'hotel', 'Netflix', 'netflix.com', 'Bevestiging: je Netflix-huishouden is bijgewerkt'),
];

test('[W/16c] only the real confirmations land in the pre-ticked tier', () => {
  const { strong, weak, promo } = partitionByHint(INBOX);
  assert.deepEqual(strong.map(i => i.id), ['t1', 't2', 't3', 'k1']);
  // And every single other mail is still there, in one of the two other tiers.
  assert.equal(strong.length + weak.length + promo.length, INBOX.length, 'nothing is dropped');
  for (const i of INBOX) {
    assert.ok([...strong, ...weak, ...promo].some(x => x.id === i.id), `${i.id} must still be shown`);
  }
});

test('[W/16c] Netflix and the loyalty mails stay visible as possibly travel-related', () => {
  const { weak } = partitionByHint(INBOX);
  assert.deepEqual(weak.map(i => i.id).sort(), ['n1', 'p1', 'p2']);
});

test('[W/16c] the newsletters go to the marketing tier, not the bin', () => {
  const { promo } = partitionByHint(INBOX);
  assert.deepEqual(promo.map(i => i.id).sort(), ['a1', 'a2', 'a3', 'b1', 'c1', 's1']);
});

test('[W/16c] an item scanned before the signals existed still gets a tier', () => {
  const old = { id: 'o', kind: 'flight', sender: 'X', senderDomain: 'airasia.com', subject: 'Japan Flight Deals', dateMs: 1 } as GmailInboxItem;
  assert.equal(itemHint(old), 'promo', 'the subject alone is enough here');
});

test('[W/16c] the screen pre-ticks the strong tier only, and hides nothing', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(
    screen.includes("result.items.filter(i => itemHint(i) === 'strong' && !detectOnly(i.kind)).map(i => i.id)"),
    'pre-selection is the strong tier',
  );
  assert.ok(screen.includes('{tiers.map(tier => ('), 'all three tiers are rendered');
  assert.ok(screen.includes('t().gmailMaybeTravel'), 'the weak tier has a heading');
  assert.ok(screen.includes('t().gmailPromotions'), 'and so does the marketing one');
  assert.ok(screen.includes('setPromoOpen(o => !o)'), 'which is collapsible, not hidden');
  assert.ok(screen.includes('t().gmailShowGroup'), 'with a way to open it');
});
