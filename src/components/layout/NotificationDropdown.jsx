import { useEffect, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';

export default function NotificationDropdown({ children, ...props }) {
  const [show, setShow] = useState(false);
  const { key } = useLocation();
  useEffect(() => { setShow(false); }, [key]);
  return <Dropdown {...props} show={show} onToggle={setShow}>{children}</Dropdown>;
}
