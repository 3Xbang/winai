'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseScrollLoadOptions {
  /** Pixel threshold from top to trigger loading */
  threshold?: number;
  /** Whether there are more items to load */
  hasMore: boolean;
}

/**
 * Hook for detecting scroll-to-top to load historical messages.
 * Returns a ref to attach to the scrollable container.
 */
export function useScrollLoad({ threshold = 100, hasMore }: UseScrollLoadOptions) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);

  const loadMore = useCallback(async (fetchFn: () => Promise<void>) => {
    if (isLoadingMore || !hasMore) return;

    const container = containerRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
    }

    setIsLoadingMore(true);
    try {
      await fetchFn();
    } finally {
      setIsLoadingMore(false);
    }

    // Restore scroll position after new messages are prepended
    requestAnimationFrame(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      }
    });
  }, [isLoadingMore, hasMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop <= threshold && hasMore && !isLoadingMore) {
        // Emit a custom event that the parent can listen to
        container.dispatchEvent(new CustomEvent('loadmore'));
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [threshold, hasMore, isLoadingMore]);

  return { containerRef, isLoadingMore, loadMore };
}
