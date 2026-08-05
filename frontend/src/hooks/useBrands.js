import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import { useUI } from '../store/ui';

export function useBrands() {
  return useQuery({ queryKey: ['brands'], queryFn: () => get('/brands') });
}

/** Resolves the currently-active brand, defaulting to the first one. */
export function useActiveBrand() {
  const { data: brands, isLoading } = useBrands();
  const { activeBrandId, setActiveBrand } = useUI();

  useEffect(() => {
    if (!isLoading && brands?.length) {
      const exists = brands.some((b) => b.id === activeBrandId);
      if (!exists) setActiveBrand(brands[0].id);
    }
  }, [brands, isLoading, activeBrandId, setActiveBrand]);

  const activeBrand = brands?.find((b) => b.id === activeBrandId) || brands?.[0] || null;
  return { brands: brands || [], activeBrand, activeBrandId: activeBrand?.id || null, setActiveBrand, isLoading };
}
