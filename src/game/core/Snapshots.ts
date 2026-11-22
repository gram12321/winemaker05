/** Clone and freeze validated plain domain data without retaining caller aliases. */
export function frozenCopy<T>(value: T): T {
  const copy: T = structuredClone(value);
  function freeze(node: unknown): void {
    if (node === null || typeof node !== 'object') return;
    Object.values(node).forEach(freeze);
    Object.freeze(node);
  }
  freeze(copy);
  return copy;
}
