import { AnimatePresence, motion } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import type { MilestoneAlert } from '../types';
import { CategoryBadge } from './CategoryIcon';

export type BrowserNotificationState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getBrowserNotificationState(): BrowserNotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission as BrowserNotificationState;
}

export async function requestBrowserNotifications(): Promise<BrowserNotificationState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result as BrowserNotificationState;
  } catch {
    return getBrowserNotificationState();
  }
}

export function sendBrowserPushNotification(title: string, body: string) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    window.Notification.permission === 'granted'
  ) {
    try {
      new window.Notification(title, {
        body,
        tag: 'gitstory-milestone',
      });
    } catch {
      // Ignore environments where Notification constructor is restricted
    }
  }
}

interface NotificationToastStackProps {
  alerts: MilestoneAlert[];
  onDismiss: (id: string) => void;
}

export function NotificationToastStack({ alerts, onDismiss }: NotificationToastStackProps) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-lg shadow-slate-900/8 dark:shadow-slate-950/40"
          >
            <div className="flex items-start gap-3">
              <CategoryBadge category={alert.type} kind={alert.type === 'celebration' ? 'alert' : alert.type} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-bold text-[#0F172A] truncate">
                    {alert.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDismiss(alert.id)}
                    aria-label="Dismiss milestone notification"
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{alert.body}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <Sparkles className="h-3 w-3 text-[#0D9488]" />
                  <span>{alert.isSimulated ? 'Preview milestone alert' : 'Live repo milestone'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{alert.timestamp}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
