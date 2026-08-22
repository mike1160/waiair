import AsyncStorage from '@react-native-async-storage/async-storage';

export type ModuleId =
  | 'journey_phase'
  | 'weather'
  | 'transport'
  | 'lounge'
  | 'inbound_tracking'
  | 'connection_risk'
  | 'immigration'
  | 'radar'
  | 'turbulence'
  | 'fids_board'
  | 'miles_compensation'
  | 'morning_briefing';

export type Preset = 'quick' | 'traveller' | 'pro' | 'custom';

export interface Module {
  id: ModuleId;
  label: string;
  description: string;
  icon: string;
}

const STORAGE_KEY = 'waiair.modules';

const JOURNEY_PHASE: ModuleId = 'journey_phase';

export const ALL_MODULE_IDS: readonly ModuleId[] = [
  'journey_phase',
  'weather',
  'transport',
  'lounge',
  'inbound_tracking',
  'connection_risk',
  'immigration',
  'radar',
  'turbulence',
  'fids_board',
  'miles_compensation',
  'morning_briefing',
] as const;

const MODULE_ID_SET = new Set<ModuleId>(ALL_MODULE_IDS);

export const MODULES: readonly Module[] = [
  {
    id: 'journey_phase',
    label: 'Journey phase',
    description: 'Core trip timeline and flight status for your active journey.',
    icon: '✈️',
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Destination and origin weather snapshots on your route.',
    icon: '🌤️',
  },
  {
    id: 'transport',
    label: 'Transport',
    description: 'Grab, taxi, and ground transport quick actions.',
    icon: '🚕',
  },
  {
    id: 'lounge',
    label: 'Lounge',
    description: 'Airport lounge access hints and lounge finder.',
    icon: '🛋️',
  },
  {
    id: 'inbound_tracking',
    label: 'Inbound tracking',
    description: 'Track inbound flights for pickup and meet-and-greet.',
    icon: '📍',
  },
  {
    id: 'connection_risk',
    label: 'Connection risk',
    description: 'Minimum connection time and missed-connection alerts.',
    icon: '⚠️',
  },
  {
    id: 'immigration',
    label: 'Immigration',
    description: 'Visa and entry requirements for your destination.',
    icon: '🛂',
  },
  {
    id: 'radar',
    label: 'Radar',
    description: 'Live aircraft map around your airport.',
    icon: '📡',
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    description: 'Route turbulence forecast and comfort indicators.',
    icon: '〰️',
  },
  {
    id: 'fids_board',
    label: 'Flight board',
    description: 'Live departures and arrivals board.',
    icon: '📋',
  },
  {
    id: 'miles_compensation',
    label: 'Miles & compensation',
    description: 'Miles wallet, upgrades, and EU261-style compensation hints.',
    icon: '💰',
  },
  {
    id: 'morning_briefing',
    label: 'Morning briefing',
    description: 'Day-of-travel summary card on My Flights.',
    icon: '☀️',
  },
] as const;

/** Default active modules per preset (journey_phase always included). */
export const PRESET_MODULES: Record<Exclude<Preset, 'custom'>, readonly ModuleId[]> = {
  quick: ['journey_phase'],
  traveller: ['journey_phase', 'weather', 'transport', 'immigration'],
  pro: [...ALL_MODULE_IDS],
};

type StoredModules = {
  preset: Preset;
  modules: ModuleId[];
};

const DEFAULT_PRESET: Exclude<Preset, 'custom'> = 'traveller';

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && MODULE_ID_SET.has(value as ModuleId);
}

function normalizeModules(modules: ModuleId[]): ModuleId[] {
  const seen = new Set<ModuleId>();
  const out: ModuleId[] = [];
  for (const id of modules) {
    if (!isModuleId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (!seen.has(JOURNEY_PHASE)) out.unshift(JOURNEY_PHASE);
  return out;
}

function modulesMatchPreset(modules: ModuleId[], preset: Exclude<Preset, 'custom'>): boolean {
  const expected = normalizeModules([...PRESET_MODULES[preset]]);
  const actual = normalizeModules(modules);
  if (expected.length !== actual.length) return false;
  const expectedSet = new Set(expected);
  return actual.every(id => expectedSet.has(id));
}

function presetForModules(modules: ModuleId[]): Preset {
  if (modulesMatchPreset(modules, 'quick')) return 'quick';
  if (modulesMatchPreset(modules, 'traveller')) return 'traveller';
  if (modulesMatchPreset(modules, 'pro')) return 'pro';
  return 'custom';
}

function defaultState(): StoredModules {
  return {
    preset: DEFAULT_PRESET,
    modules: normalizeModules([...PRESET_MODULES[DEFAULT_PRESET]]),
  };
}

async function readState(): Promise<StoredModules> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<StoredModules>;
    const modules = normalizeModules(
      Array.isArray(parsed.modules) ? parsed.modules.filter(isModuleId) : [],
    );
    const preset = parsed.preset === 'quick'
      || parsed.preset === 'traveller'
      || parsed.preset === 'pro'
      || parsed.preset === 'custom'
      ? parsed.preset
      : presetForModules(modules);
    return { preset, modules: modules.length ? modules : defaultState().modules };
  } catch {
    return defaultState();
  }
}

async function writeState(state: StoredModules): Promise<void> {
  const modules = normalizeModules(state.modules);
  const preset = state.preset === 'custom'
    ? 'custom'
    : presetForModules(modules);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, modules }));
}

export function modulesForPreset(preset: Preset): ModuleId[] {
  if (preset === 'custom') return normalizeModules([...PRESET_MODULES.traveller]);
  return normalizeModules([...PRESET_MODULES[preset]]);
}

export async function getActiveModules(): Promise<ModuleId[]> {
  const state = await readState();
  return normalizeModules(state.modules);
}

export async function setActiveModules(modules: ModuleId[]): Promise<void> {
  const normalized = normalizeModules(modules);
  const preset = presetForModules(normalized);
  await writeState({ preset, modules: normalized });
}

export async function getPreset(): Promise<Preset> {
  const state = await readState();
  return state.preset;
}

export async function setPreset(preset: Preset): Promise<void> {
  const state = await readState();
  await writeState({ ...state, preset });
}

export async function applyPreset(preset: Preset): Promise<void> {
  if (preset === 'custom') {
    const state = await readState();
    await writeState({ ...state, preset: 'custom' });
    return;
  }
  await writeState({
    preset,
    modules: modulesForPreset(preset),
  });
}

export async function isModuleActive(id: ModuleId): Promise<boolean> {
  if (id === JOURNEY_PHASE) return true;
  const active = await getActiveModules();
  return active.includes(id);
}
