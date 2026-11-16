/**
 * Snapshot and command values are plain JSON data. Reject lossy JSON encoding,
 * accessors, custom prototypes, sparse arrays, cycles and non-finite numbers.
 * The sorted representation is a collision-free, versioned fingerprint input.
 */
function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object') throw new Error('Only finite JSON data is supported.');
  if (ancestors.has(value)) throw new Error('Cyclic data is not supported.');
  if (Object.getOwnPropertySymbols(value).length > 0) throw new Error('Symbol properties are not supported.');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (
        Object.getPrototypeOf(value) !== Array.prototype ||
        Object.keys(value).length !== value.length ||
        Object.getOwnPropertyNames(value).length !== value.length + 1
      ) {
        throw new Error('Only dense arrays without additional properties are supported.');
      }
      const elements: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor)) throw new Error('Array accessors are not supported.');
        elements.push(canonicalJson(descriptor.value, ancestors));
      }
      return `[${elements.join(',')}]`;
    }

    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Only plain objects are supported.');
    const names = Object.getOwnPropertyNames(value).sort();
    const entries = names.map((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error('Non-enumerable properties and accessors are not supported.');
      }
      return `${JSON.stringify(name)}:${canonicalJson(descriptor.value, ancestors)}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalize(value: unknown): string {
  return canonicalJson(value, new Set());
}

function freezeRecursively(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const child of Object.values(value)) freezeRecursively(child);
  Object.freeze(value);
}

export function immutableCopy<T>(value: T): T {
  const copy: unknown = JSON.parse(canonicalize(value));
  freezeRecursively(copy);
  return copy as T;
}

export function commandFingerprint(command: unknown): string {
  return `json-v1:${canonicalize(command)}`;
}
