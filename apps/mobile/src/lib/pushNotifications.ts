/**
 * Push Notification Service - DISABLED
 *
 * Push notifications are temporarily disabled due to expo-notifications
 * causing a "callBind is not a function" error on Android with Hermes.
 *
 * TODO: Re-enable when the call-bind compatibility issue is resolved.
 */

import { useState, useCallback } from 'react';

// Stub permission status type
type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface NotificationData {
  type?: 'message' | 'system';
  conversationId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

// ============================================
// Stub Functions (Push Notifications Disabled)
// ============================================

/**
 * Check if push notifications are supported - always returns false (disabled)
 */
export function isSupported(): boolean {
  return false;
}

/**
 * Register push token with the desktop server - no-op
 */
export async function registerWithServer(_baseUrl: string, _apiKey: string): Promise<boolean> {
  console.log('[Push] Push notifications are disabled');
  return false;
}

/**
 * Unregister push token from the desktop server - no-op
 */
export async function unregisterFromServer(_baseUrl: string, _apiKey: string): Promise<boolean> {
  return true;
}

/**
 * Check if currently registered with server - always false
 */
export async function isRegisteredWithServer(): Promise<boolean> {
  return false;
}

/**
 * Clear all notifications and badge - no-op
 */
export async function clearNotifications(): Promise<void> {
  // No-op
}

/**
 * Clear badge count on the server - no-op
 */
export async function clearServerBadge(_baseUrl: string, _apiKey: string): Promise<void> {
  // No-op
}

// ============================================
// React Hook (Stub - Push Notifications Disabled)
// ============================================

export interface UsePushNotificationsResult {
  /** Whether push is supported on this device */
  isSupported: boolean;
  /** Current permission status */
  permissionStatus: PermissionStatus | null;
  /** Whether registered with server */
  isRegistered: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Register for push notifications */
  register: (baseUrl: string, apiKey: string) => Promise<boolean>;
  /** Unregister from push notifications */
  unregister: (baseUrl: string, apiKey: string) => Promise<boolean>;
  /** Set handler for notification taps (for deep linking) */
  setOnNotificationTap: (handler: ((data: NotificationData) => void) | null) => void;
  /** Clear all notifications */
  clear: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isLoading] = useState(false);

  const register = useCallback(async (_baseUrl: string, _apiKey: string): Promise<boolean> => {
    console.log('[Push] Push notifications are disabled');
    return false;
  }, []);

  const unregister = useCallback(async (_baseUrl: string, _apiKey: string): Promise<boolean> => {
    return true;
  }, []);

  const setOnNotificationTap = useCallback((_handler: ((data: NotificationData) => void) | null) => {
    // No-op
  }, []);

  const clear = useCallback(async () => {
    // No-op
  }, []);

  return {
    isSupported: false,
    permissionStatus: null,
    isRegistered: false,
    isLoading,
    register,
    unregister,
    setOnNotificationTap,
    clear,
  };
}

