import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Hook exposing authentication state, user info, and sign-in/out actions.
 * Must be used within an AuthProvider.
 * @returns {{
 *   user: {email: string, name: string, picture: string}|null,
 *   loading: boolean,
 *   provisioning: boolean,
 *   folderIds: {rootId: string, billsId: string, paymentsId: string}|null,
 *   spreadsheetId: string|null,
 *   error: string|null,
 *   signIn: () => void,
 *   signOut: () => Promise<void>,
 *   isAuthenticated: boolean,
 * }}
 */
export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
