/**
 * Kids mode artwork: size-optimised copies of assets/kids/ (drawn at most ~200pt, so 480–600px JPEGs and
 * 480–624px H.264 loops without audio). 1.1 MB in the app instead of the 19 MB originals.
 */
export const KIDS_ART = {
  sky: require('../assets/kids-app/sky_background.jpg'),
  pilot: require('../assets/kids-app/pilot.jpg'),
  stewardess: require('../assets/kids-app/stewardess.jpg'),
  airplane: require('../assets/kids-app/airplane.jpg'),
  airportBuilding: require('../assets/kids-app/airport_building.jpg'),
  boardingPass: require('../assets/kids-app/boarding_pass.jpg'),
} as const;

export const KIDS_VIDEO = {
  airplane: require('../assets/kids-app/airplane.mp4'),
  baggage: require('../assets/kids-app/baggage.mp4'),
  confetti: require('../assets/kids-app/confetti.mp4'),
} as const;

/** The flat blue behind the confetti animation, so a square video fills a tall screen without a seam. */
export const CONFETTI_BACKDROP = 'rgb(72, 154, 200)';
