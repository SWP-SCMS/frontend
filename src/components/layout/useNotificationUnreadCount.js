import { useCallback, useEffect, useState } from 'react';

import { listNotifications } from '../../services/notificationService';

const REFRESH_INTERVAL_MS = 30_000;

export default function useNotificationUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(() => {
    listNotifications({ unreadOnly: true, page: 0, size: 1 })
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const intervalId = window.setInterval(loadUnreadCount, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', loadUnreadCount);
    window.addEventListener('scms:notifications-changed', loadUnreadCount);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadUnreadCount);
      window.removeEventListener('scms:notifications-changed', loadUnreadCount);
    };
  }, [loadUnreadCount]);

  return unreadCount;
}
