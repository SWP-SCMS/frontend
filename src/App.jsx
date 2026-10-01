// Root App component. Sets up:
//   - BrowserRouter (routing)
//   - AuthProvider (auth context with bootstrap + token lifecycle)
//   - <AppRoutes /> (route table)
//
// Bootstrap CSS is imported here exactly once. We deliberately keep the
// root component minimal so individual page modules own their own
// concerns (forms, layouts, etc.).

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
