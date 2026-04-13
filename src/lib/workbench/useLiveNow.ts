'use client';

import { useEffect, useState } from 'react';

export function useLiveNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, intervalMs]);

  return now;
}