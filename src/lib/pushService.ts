// Web Push Notification & Service Worker Utility Service

export const PushService = {
  // Check if Browser & OS support Notifications
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  },

  // Get current permission status
  getPermissionState(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  // Request browser notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.registerServiceWorker();
      }
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  },

  // Register sw.js Service Worker
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      return null;
    }
  },

  // Trigger System Push Notification (Works in background & when tab is minimized/hidden)
  async showNotification(
    title: string,
    options: {
      body: string;
      tag?: string;
      url?: string;
      requireInteraction?: boolean;
    }
  ): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') return;

    try {
      // Priority 1: Service Worker Registration showNotification (Best for Background/Tab Closed)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body: options.body,
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧸</text></svg>",
            badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧸</text></svg>",
            vibrate: [200, 100, 200, 100, 200],
            tag: options.tag || 'private-chat-alert',
            renotify: true,
            requireInteraction: options.requireInteraction ?? true,
            data: { url: options.url || '/' },
          } as any);
          return;
        }
      }

      // Priority 2: Direct Window Notification Fallback
      new Notification(title, {
        body: options.body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧸</text></svg>",
        requireInteraction: options.requireInteraction ?? true,
      });
    } catch (err) {
      console.warn('Could not display notification:', err);
    }
  },
};
