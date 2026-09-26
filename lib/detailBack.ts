/**
 * What "back" means on the flight detail card [B11].
 *
 * Transport, Weather, Briefing and Immigration do not open a screen of their own — they jump the detail card
 * to that section. It reads as having gone somewhere, so back ought to come back, and it did not: back left
 * the card altogether and landed on the overview, losing the flight the traveller was looking at.
 *
 * So back is two steps once a jump has happened. The first returns to the top of the flight card, which is
 * where the jump started; the second leaves. Nothing changes for a card nobody jumped inside, and the ✕ is
 * untouched — it says close and it closes.
 */

export type DetailBackAction = 'backToCard' | 'close';

/**
 * `jumpedToSection` is true while the card is scrolled to a section someone jumped to, and false once they
 * have come back to the top of it.
 */
export function detailBackAction(opts: { jumpedToSection?: boolean }): DetailBackAction {
  return opts.jumpedToSection ? 'backToCard' : 'close';
}
