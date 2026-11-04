import { useAuth } from '../context/useAuth';
import usePollingEffect from './usePollingEffect';

// Chỉ khai báo setter dữ liệu đọc. Không đưa reset form, quyền thao tác hay payment vào cache.
export default function useCachedPollingEffect(setup, dependencies, cache, enabled = true) {
  const { user } = useAuth();
  const account = user?.accountId || user?.memberId;
  const key = account ? JSON.stringify([user?.role, account, cache.key]) : null;
  usePollingEffect(setup, [...dependencies, key], enabled, { ...cache, key });
}
