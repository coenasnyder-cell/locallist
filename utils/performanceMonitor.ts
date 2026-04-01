// utils/performanceMonitor.ts
// Real-time performance monitoring for critical app flows

import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React from 'react';
import { Platform } from 'react-native';

export interface PerformanceMetric {
  name: string;
  duration: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

/**
 * Monitor and log performance metrics to Firestore
 * Useful for tracking: startup time, Firestore latency, render performance
 */
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();
  private static enabled = __DEV__; // Only in dev by default

  static enable = (enabled: boolean) => {
    PerformanceMonitor.enabled = enabled;
  };

  /**
   * Start a performance timer
   * @param label - Unique identifier for this timing
   */
  static start = (label: string) => {
    if (!PerformanceMonitor.enabled) return;
    PerformanceMonitor.timers.set(label, performance.now());
  };

  /**
   * End a performance timer and log the duration
   * @param label - Same label used in start()
   * @param threshold - Optional duration threshold in ms for warnings
   */
  static end = async (label: string, threshold?: number) => {
    if (!PerformanceMonitor.enabled) return;

    const startTime = PerformanceMonitor.timers.get(label);
    if (!startTime) {
      console.warn(`[Performance] No timer found for: ${label}`);
      return;
    }

    const duration = performance.now() - startTime;
    PerformanceMonitor.timers.delete(label);

    const exceeded = threshold && duration > threshold;
    const icon = exceeded ? '⚠️' : '✓';
    const thresholdStr = threshold ? ` (threshold: ${threshold}ms)` : '';
    
    console.log(`[Performance] ${icon} ${label}: ${duration.toFixed(2)}ms${thresholdStr}`);

    // Log to Firestore if in production or monitoring enabled
    if (!__DEV__ || PerformanceMonitor.enabled) {
      try {
        await PerformanceMonitor.logMetric({
          name: label,
          duration,
          threshold,
          metadata: {
            platform: Platform.OS,
            exceeded
          }
        });
      } catch (error) {
        console.error(`[Performance] Failed to log metric: ${label}`, error);
      }
    }
  };

  /**
   * Log a metric directly to Firestore
   */
  static logMetric = async (metric: PerformanceMetric) => {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'performanceMetrics'), {
        name: metric.name,
        duration: metric.duration,
        threshold: metric.threshold,
        platform: Platform.OS,
        timestamp: serverTimestamp(),
        metadata: metric.metadata || {}
      });
    } catch (error) {
      console.error('Error logging performance metric:', error);
    }
  };

  /**
   * Measure a function execution time
   * @example
   * const result = await PerformanceMonitor.measure('firestore-query', () => {
   *   return db.collection('listings').limit(10).get();
   * });
   */
  static measure = async <T>(
    label: string,
    fn: () => Promise<T> | T,
    threshold?: number
  ): Promise<T> => {
    PerformanceMonitor.start(label);
    try {
      const result = await fn();
      await PerformanceMonitor.end(label, threshold);
      return result;
    } catch (error) {
      await PerformanceMonitor.end(label, threshold);
      throw error;
    }
  };
}

/**
 * Hook to measure React component render times
 * @example
 * export function MyComponent() {
 *   useRenderTime('MyComponent');
 *   return <View>...</View>;
 * }
 */
export const useRenderTime = (componentName: string) => {
  const startTimeRef = React.useRef(performance.now());

  React.useEffect(() => {
    const renderDuration = performance.now() - startTimeRef.current;
    if (renderDuration > 100) {
      console.warn(`[Performance] ${componentName} took ${renderDuration.toFixed(2)}ms to render`);
    }
  }, [componentName]);
};

// ─── Critical Path Metrics ────────────────────────────────────

/**
 * Log app startup time from launch to interactive
 * Call this once when home screen is fully loaded
 */
export const logAppStartupTime = (startTime: number) => {
  const coldStartDuration = Date.now() - startTime;
  PerformanceMonitor.logMetric({
    name: 'app_cold_startup',
    duration: coldStartDuration,
    threshold: 3000,
    metadata: {
      type: 'cold_start'
    }
  });
};

/**
 * Log Firestore query latency
 * @example
 * const start = performance.now();
 * const docs = await getDocs(query(...));
 * logFirestoreLatency('list_featured_listings', performance.now() - start);
 */
export const logFirestoreLatency = (queryName: string, duration: number) => {
  const threshold = 500; // 500ms threshold for Firestore reads
  PerformanceMonitor.logMetric({
    name: `firestore_latency: ${queryName}`,
    duration,
    threshold,
    metadata: {
      type: 'database_query'
    }
  });
};

/**
 * Log user flow completion time
 * @example
 * logUserFlowDuration('listing_creation', startTime, { category: 'used-goods', featured: true });
 */
export const logUserFlowDuration = (
  flowName: string,
  startTime: number,
  metadata?: Record<string, any>
) => {
  const duration = Date.now() - startTime;
  const thresholds: Record<string, number> = {
    'listing_creation': 4000,
    'featured_checkout': 3000,
    'user_signup': 2000,
    'search_query': 1000
  };

  PerformanceMonitor.logMetric({
    name: `user_flow: ${flowName}`,
    duration,
    threshold: thresholds[flowName],
    metadata: {
      type: 'user_flow',
      ...metadata
    }
  });
};
