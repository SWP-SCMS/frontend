import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { notificationSummary } from '../../utils/notificationUi';

export default function NotificationBellContent({
  notifications = [],
  unreadCount = 0,
  notificationPath,
  classPrefix,
}) {
  return (
    <>
      <div className={`${classPrefix}-bell-head`}>Thông báo</div>
      {notifications.length > 0 ? (
        <div className={`${classPrefix}-bell-list`}>
          {notifications.map((item) => (
            <div className={`${classPrefix}-bell-preview`} key={item.id}>
              {notificationSummary(item)}
            </div>
          ))}
          {unreadCount > notifications.length ? (
            <div className={`${classPrefix}-bell-more`}>
              Còn {unreadCount - notifications.length} thông báo chưa đọc
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`${classPrefix}-bell-empty`}>Chưa có thông báo mới.</div>
      )}
      <Dropdown.Item as={Link} to={notificationPath} className="small text-danger">
        Xem tất cả thông báo
      </Dropdown.Item>
    </>
  );
}
