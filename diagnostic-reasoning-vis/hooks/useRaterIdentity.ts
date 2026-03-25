"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getRaterId,
  getRaterName,
  isTutorialDone,
  createRaterIdentity,
  markTutorialDone,
} from "@/lib/rater-identity";

interface RaterIdentity {
  raterId: string | null;       // name-based slug (e.g. "alice")
  raterName: string | null;     // display name (e.g. "Alice")
  needsTutorial: boolean;
  isReady: boolean;             // false during SSR hydration
  completeTutorial: (name: string) => string;
  skipTutorial: () => void;
}

export function useRaterIdentity(): RaterIdentity {
  const [raterId, setRaterId] = useState<string | null>(null);
  const [raterName, setRaterName] = useState<string | null>(null);
  const [needsTutorial, setNeedsTutorial] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from cookies/localStorage on mount
  useEffect(() => {
    const id = getRaterId();
    const name = getRaterName();
    const tutorialDone = isTutorialDone();

    setRaterId(id);
    setRaterName(name);
    setNeedsTutorial(!id || !tutorialDone);
    setIsReady(true);
  }, []);

  const completeTutorial = useCallback((name: string): string => {
    const id = createRaterIdentity(name);
    setRaterId(id);
    setRaterName(name.trim());
    setNeedsTutorial(false);
    return id;
  }, []);

  const skipTutorial = useCallback(() => {
    markTutorialDone();
    setNeedsTutorial(false);
  }, []);

  return { raterId, raterName, needsTutorial, isReady, completeTutorial, skipTutorial };
}
