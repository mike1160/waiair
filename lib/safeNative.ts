/** Lazy require that never throws — for optional native modules in dev/simulator builds. */
export function tryRequire<T = unknown>(moduleId: string): T | null {
  try {
    return require(moduleId) as T;
  } catch {
    return null;
  }
}

export async function tryCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
