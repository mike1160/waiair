/** 28×28 gold radar: rotating sweep + 3 pulsing blips, 3s loop. */

const GOLD: [number, number, number, number] = [201 / 255, 168 / 255, 76 / 255, 1];

function tr(x = 0, y = 0) {
  return {
    ty: 'tr' as const,
    p: { a: 0, k: [x, y] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
  };
}

function ring(d: number) {
  return {
    ty: 4,
    nm: `ring-${d}`,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [14, 14, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [d, d] }, nm: 'el' },
      { ty: 'st', c: { a: 0, k: GOLD }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.1 }, lc: 2, lj: 1, nm: 'stroke' },
      tr(),
    ],
    ip: 0,
    op: 90,
    st: 0,
  };
}

function crosshair() {
  return {
    ty: 4,
    nm: 'crosshair',
    sr: 1,
    ks: {
      o: { a: 0, k: 70 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [14, 14, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        nm: 'lines',
        it: [
          {
            ty: 'sh',
            ks: {
              a: 0,
              k: {
                c: false,
                v: [[0, -12], [0, 12]],
                i: [[0, 0], [0, 0]],
                o: [[0, 0], [0, 0]],
              },
            },
          },
          {
            ty: 'sh',
            ks: {
              a: 0,
              k: {
                c: false,
                v: [[-12, 0], [12, 0]],
                i: [[0, 0], [0, 0]],
                o: [[0, 0], [0, 0]],
              },
            },
          },
          { ty: 'st', c: { a: 0, k: GOLD }, o: { a: 0, k: 100 }, w: { a: 0, k: 1 }, lc: 2, lj: 1, nm: 'stroke' },
          tr(),
        ],
      },
    ],
    ip: 0,
    op: 90,
    st: 0,
  };
}

function sweepArm() {
  return {
    ty: 4,
    nm: 'sweep',
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
          { t: 90, s: [360] },
        ],
      },
      p: { a: 0, k: [14, 14, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      {
        ty: 'sh',
        ks: {
          a: 0,
          k: {
            c: false,
            v: [[0, 0], [0, -12.5]],
            i: [[0, 0], [0, 0]],
            o: [[0, 0], [0, 0]],
          },
        },
      },
      { ty: 'st', c: { a: 0, k: GOLD }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.6 }, lc: 2, lj: 1, nm: 'stroke' },
      tr(),
    ],
    ip: 0,
    op: 90,
    st: 0,
  };
}

function blip(nm: string, x: number, y: number, appear: number) {
  const fade = appear + 18;
  return {
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [0], i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] } },
          { t: appear, s: [0], e: [100], i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] } },
          { t: appear + 4, s: [100], e: [0], i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] } },
          { t: fade, s: [0] },
        ],
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [x, y, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [100, 100, 100], e: [100, 100, 100], i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] } },
          { t: appear, s: [100, 100, 100], e: [220, 220, 100], i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] } },
          { t: fade, s: [220, 220, 100] },
        ],
      },
    },
    ao: 0,
    shapes: [
      { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [3.2, 3.2] }, nm: 'dot' },
      { ty: 'fl', c: { a: 0, k: GOLD }, o: { a: 0, k: 100 }, r: 1, nm: 'fill' },
      { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [6, 6] }, nm: 'ring' },
      { ty: 'st', c: { a: 0, k: GOLD }, o: { a: 0, k: 70 }, w: { a: 0, k: 1 }, lc: 2, lj: 1, nm: 'ring-stroke' },
      tr(),
    ],
    ip: 0,
    op: 90,
    st: 0,
  };
}

export function radarBlipLottie() {
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 90,
    w: 28,
    h: 28,
    nm: 'RadarBlip',
    ddd: 0,
    assets: [],
    layers: [
      ring(24),
      ring(16),
      ring(8),
      crosshair(),
      sweepArm(),
      blip('blip-a', 20, 8, 12),
      blip('blip-b', 8, 18, 42),
      blip('blip-c', 21, 20, 68),
    ],
  };
}
