import { useEffect, useState } from 'react';

/**
 * Trailing-edge debounce for a value. Search boxes feed their value straight
 * into a query key, so without this every keystroke is its own request.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
