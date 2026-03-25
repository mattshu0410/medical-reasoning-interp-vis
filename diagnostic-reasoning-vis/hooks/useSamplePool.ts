"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { buildSamplePool, type SampleItem } from "@/lib/sample-pool";
import type { Case } from "@/lib/types";

interface UseSamplePoolResult {
  pool: SampleItem[];
  currentItem: SampleItem | null;
  currentCase: Case | null;
  selectedIndex: number;
  isLoading: boolean;
  navigateTo: (index: number) => void;
}

/**
 * Manages the deterministic sample pool and lazy-loads case data.
 * Caches fetched case files so repeat visits are instant.
 */
export function useSamplePool(): UseSamplePoolResult {
  const { metadata } = useMetadata();
  const [pool, setPool] = useState<SampleItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cache: model_dataset -> Case[]
  const cacheRef = useRef<Map<string, Case[]>>(new Map());

  // Build pool once metadata arrives
  useEffect(() => {
    if (!metadata) return;

    const caseCounts: Record<string, Record<string, number>> = {};
    for (const [model, info] of Object.entries(metadata.models)) {
      caseCounts[model] = {};
      for (const [dataset, dsInfo] of Object.entries(info.datasets)) {
        caseCounts[model][dataset] = dsInfo.num_cases;
      }
    }

    const built = buildSamplePool(
      metadata.model_order,
      metadata.dataset_order,
      caseCounts
    );
    setPool(built);
    if (built.length === 0) setIsLoading(false);
  }, [metadata]);

  // Fetch case data for current pool item
  const loadCase = useCallback(async (item: SampleItem) => {
    const key = `${item.model}_${item.dataset}`;
    let cases = cacheRef.current.get(key);

    if (!cases) {
      setIsLoading(true);
      try {
        const res = await fetch(`/data/cases/${key}.json`);
        if (!res.ok) throw new Error(`${res.status}`);
        cases = (await res.json()) as Case[];
        cacheRef.current.set(key, cases);
      } catch {
        setCurrentCase(null);
        setIsLoading(false);
        return;
      }
    }

    setCurrentCase(cases[item.caseIndex] ?? null);
    setIsLoading(false);
  }, []);

  // Load case when selection changes
  useEffect(() => {
    const item = pool[selectedIndex];
    if (!item) return;
    loadCase(item);
  }, [pool, selectedIndex, loadCase]);

  const navigateTo = useCallback((index: number) => {
    if (pool.length === 0) return;
    setSelectedIndex(Math.max(0, Math.min(index, pool.length - 1)));
  }, [pool.length]);

  return {
    pool,
    currentItem: pool[selectedIndex] ?? null,
    currentCase,
    selectedIndex,
    isLoading: isLoading || pool.length === 0,
    navigateTo,
  };
}
