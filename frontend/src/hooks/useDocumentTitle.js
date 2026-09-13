import { useEffect } from 'react';

const SUFFIX = 'mkt_studio';

/** Keeps the browser tab (and therefore history and bookmarks) meaningful. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default useDocumentTitle;
