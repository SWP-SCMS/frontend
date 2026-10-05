# SCMS Frontend (SWP GYM)

Frontend React của Sports Center Management System — đồ án SWP391,
FPT University.

## Tech stack

- React 19 + Vite
- react-router-dom 7
- axios
- react-bootstrap + Bootstrap 5

## Chạy dự án

```bash
npm install
npm run dev      # http://localhost:5173 (tự đổi port nếu bận)
npm run build    # production build
npm run lint     # oxlint
```

## Cấu hình

Tạo file `.env` (đã có sẵn, xem `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Tuyệt đối **không** commit secrets backend (JWT signing key, DB password,
SePay secret, …) vào repo frontend.

## Cấu trúc thư mục

```text
src/
├── assets/                      # logo, hình ảnh tĩnh
├── components/
│   ├── common/                  # LoadingScreen, ErrorAlert, EmptyState, theme tokens
│   └── layout/                  # AppShell (đã đăng nhập), PublicShell (chưa đăng nhập)
├── pages/
│   ├── public/                  # Home, Login, Register, Offers, NotFound
│   ├── member/                  # Dashboard, Profile, ChangePassword
│   ├── receptionist/            # Tra cứu HV, đăng ký HV, tạo đơn gói tập, gói tập
│   ├── coach/                   # Phase 6
│   └── manager/                 # Phase 5
├── services/                    # api, auth, member, membership, payment, …
├── context/                     # AuthContext + useAuth hook + helpers
├── hooks/                       # custom hooks (placeholder)
├── routes/                      # AppRoutes, ProtectedRoute, RoleRoute
├── constants/                   # roles, statuses, plan codes, API base URL
├── utils/                       # formatPrice, normalizePhone, extractErrorMessage, …
├── App.jsx
└── main.jsx
```

## Auth flow (token decisions)

| Token           | Lifetime | Storage                                            |
| --------------- | -------- | -------------------------------------------------- |
| Access token    | 15 phút  | **in-memory** (state trong `AuthContext`)           |
| Refresh token   | 7 ngày   | HttpOnly cookie (BE set), FE **không** đọc          |

- Mọi request qua shared axios instance ở `services/api.js`.
- `withCredentials: true` để gửi cookie refresh.
- 401 do access token hết hạn → tự refresh + retry 1 lần. Khi refresh thất
  bại → xoá auth state, đẩy về `/login`.
- Route guard: `<ProtectedRoute>` (cần authenticated) + `<RoleRoute>` (giới
  hạn theo role).

## Phase plan

Theo handoff document, tiến độ chia theo phase:

- ✅ **Phase 1** — Foundation (project structure, router, axios, auth shell)
- ✅ **Phase 2** — Public + Auth (Home, Login, Register, Offer list/detail,
  Change password)
- ⏳ **Phase 3** — Member (membership flow, booking, notifications)
- ⏳ **Phase 4** — Receptionist
- ⏳ **Phase 5** — Manager
- ⏳ **Phase 6** — Coach

## Quy ước FE

- Functional components + hooks (không class component).
- Gọi API từ `services/`, **không** gọi trực tiếp từ component.
- Không hardcode base URL — luôn đi qua `import.meta.env.VITE_API_BASE_URL`.
- Không tự ý thêm field/behavior ngoài BR.
- Loading / error / empty state phải xử lý rõ ràng.
- Khi chưa chốt API: comment `TODO` thay vì đoán.
