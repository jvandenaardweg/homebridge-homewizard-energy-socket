/**
 * Checks if `value` is `null` or `undefined`.
 *
 * @example
 *```
 * isNil(null); // => true
 * isNil(void 0); // => true
 * isNil(NaN); // => false
 * ```
 */
export function isNil<T>(value?: T | null): value is null | undefined {
  return value === null || value === undefined;
}
