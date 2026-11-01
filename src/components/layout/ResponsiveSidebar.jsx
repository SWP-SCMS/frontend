import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './ResponsiveSidebar.css';

export default function ResponsiveSidebar({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const regionId = useId();
  useEffect(() => { setOpen(false); }, [pathname]);
  return <>
    <button type="button" className="scms-mobile-menu-toggle" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((value) => !value)}>
      <span><span aria-hidden="true">☰</span> Menu điều hướng</span>
      <span>{open ? 'Đóng' : 'Mở'}</span>
    </button>
    <div id={regionId} className={'scms-sidebar-region' + (open ? ' is-open' : '')}>{children}</div>
  </>;
}
