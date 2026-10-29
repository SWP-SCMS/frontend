import { useCallback, useEffect, useRef, useState } from 'react';

import { listNotifications } from '../../services/notificationService';

const REFRESH_INTERVAL_MS = 30_000;
const PAGE_SIZE = 5;

function uniqueNotifications(pages) {
  const seen = new Set();
  return pages.flatMap((page) => page.content).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function useNotificationUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const loadedPageRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    try {
      const pages = await Promise.all(
        Array.from({ length: loadedPageRef.current + 1 }, (_, page) =>
          listNotifications({ page, size: PAGE_SIZE }),
        ),
      );
      const firstPage = pages[0];
      setUnreadCount(firstPage.unreadCount);
      setNotifications(uniqueNotifications(pages));
      setHasMore(loadedPageRef.current + 1 < firstPage.totalPages);
    } catch {
      // Keep the last successful notification list visible.
    }
  }, []);

  const loadMoreNotifications = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError('');
    const nextPage = loadedPageRef.current + 1;
    try {
      const data = await listNotifications({ page: nextPage, size: PAGE_SIZE });
      loadedPageRef.current = nextPage;
      setNotifications((current) => uniqueNotifications([
        { content: current },
        data,
      ]));
      setUnreadCount(data.unreadCount);
      setHasMore(nextPage + 1 < data.totalPages);
    } catch {
      setLoadMoreError('Không tải được thông báo trước đó. Vui lòng thử lại.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', loadNotifications);
    window.addEventListener('scms:notifications-changed', loadNotifications);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadNotifications);
      window.removeEventListener('scms:notifications-changed', loadNotifications);
    };
  }, [loadNotifications]);

  return {
    unreadCount,
    notifications,
    hasMore,
    loadingMore,
    loadMoreError,
    loadMoreNotifications,
  };
}
