/** Coordinate a retained browser intent with other tabs on the same origin. */
export async function withBrowserLock<T>(name: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate cross-tab requests.');
  return navigator.locks.request(name, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Another tab is handling this request.');
    return action();
  });
}
