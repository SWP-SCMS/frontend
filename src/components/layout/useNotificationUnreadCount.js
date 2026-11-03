import { useCallback, useEffect, useRef, useState } from 'react';
import useAutoRefresh from '../../hooks/useAutoRefresh';

import { listNotifications } from '../../services/notificationService';

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
  const refreshingRef = useRef(false);

  const loadNotifications = useCallback(async ({ commitValue = (setter, value) => setter(value) } = {}) => {
    if (refreshingRef.current || loadingMoreRef.current) return;
    refreshingRef.current = true;
    try {
      const pages = await Promise.all(
        Array.from({ length: loadedPageRef.current + 1 }, (_, page) =>
          listNotifications({ page, size: PAGE_SIZE }),
        ),
      );
      const firstPage = pages[0];
      commitValue(setUnreadCount, firstPage.unreadCount);
      commitValue(setNotifications, uniqueNotifications(pages));
      commitValue(setHasMore, loadedPageRef.current + 1 < firstPage.totalPages);
    } catch {
      // Keep the last successful notification list visible.
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const loadMoreNotifications = useCallback(async () => {
    if (loadingMoreRef.current || refreshingRef.current || !hasMore) return;
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
    window.addEventListener('scms:notifications-changed', loadNotifications);
    return () => {
      window.removeEventListener('scms:notifications-changed', loadNotifications);
    };
  }, [loadNotifications]);
  useAutoRefresh(loadNotifications);

  return {
    unreadCount,
    notifications,
    hasMore,
    loadingMore,
    loadMoreError,
    loadMoreNotifications,
  };
}
