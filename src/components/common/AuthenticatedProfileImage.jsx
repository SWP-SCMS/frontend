import { useEffect, useState } from 'react';

import api from '../../services/api';

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

export default function AuthenticatedProfileImage({
  src,
  alt = '',
  className,
  style,
  width,
  height,
  fallback = null,
}) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setFailed(false);
    setResolvedSrc('');
    const value = String(src || '').trim();
    if (!value) return undefined;
    if (isAbsoluteHttpUrl(value)) {
      setResolvedSrc(value);
      return undefined;
    }
    if (!value.startsWith('/profile-images/')) {
      setFailed(true);
      return undefined;
    }
    api
      .get(value, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!resolvedSrc || failed) return fallback;
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}
