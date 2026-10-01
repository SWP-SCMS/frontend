// SCMS theme tokens. Bảng màu đồng bộ với `src/index.css` (xem comment
// ở đó để biết vai trò từng token). JS tokens này chỉ dùng cho những
// chỗ BẮT BUỘC phải inline style (gradient, màu chữ trong Navbar.Brand,
// hero overlay…). Mọi nơi khác nên dùng class Bootstrap hoặc biến CSS.

export const theme = {
  colors: {
    primary: '#b70011', // crimson — primary CTA, link
    primaryDark: '#8c000d', // crimson darker — hover/active
    primaryContainer: '#dc2626', // accent — badge/light CTA surface
    onPrimary: '#ffffff',

    onSurface: '#0d1c2f', // body text (cool slate)
    surface: '#ffffff', // card surface
    surfaceAlt: '#f8f9ff', // app background (blue-tinted off-white)
    surfaceLow: '#eff4ff', // alt-band section background

    muted: '#5c403c', // warm muted secondary text
    outline: '#916f6b',

    danger: '#b70011', // alias cho primary, dùng cho btn-danger JS-side

    // Phụ — dùng trong gradient hero (cool dark → red)
    heroGradientStart: '#0d1c2f',
    heroGradientMid: '#1a2433',
    heroGradientEnd: '#b70011',
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    lg: '1.25rem',
  },
};

export default theme;