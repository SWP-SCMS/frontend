// The actual React context object, exported separately from the
// Provider component so that `useAuth` can be defined in its own file
// without tripping Fast Refresh rules about mixed exports.

import { createContext } from 'react';

export const AuthContext = createContext(null);
