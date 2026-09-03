import { create } from 'zustand';
import { verifyAdminCredentials } from '@/services/adminAuth';

/**
 * Session-only admin gate. Deliberately NOT wrapped in the `persist`
 * middleware used by useAppStore — the unlock state must NOT survive an
 * app restart, otherwise the login prompt would be pointless.
 */
interface AdminState {
  isUnlocked: boolean;
  isModalVisible: boolean;
  error: string | null;
  /** Action to run automatically once login succeeds. */
  pendingAction: (() => void) | null;

  /** Call this to guard any admin-only action. Runs `action` immediately
   * if already unlocked this session, otherwise shows the login modal
   * and runs `action` after a successful login. */
  requireAdmin: (action: () => void) => void;
  attemptLogin: (username: string, password: string) => boolean;
  cancelLogin: () => void;
  lock: () => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isUnlocked: false,
  isModalVisible: false,
  error: null,
  pendingAction: null,

  requireAdmin: (action) => {
    if (get().isUnlocked) {
      action();
      return;
    }
    set({ isModalVisible: true, pendingAction: action, error: null });
  },

  attemptLogin: (username, password) => {
    const ok = verifyAdminCredentials(username, password);
    if (ok) {
      const action = get().pendingAction;
      set({ isUnlocked: true, isModalVisible: false, pendingAction: null, error: null });
      action?.();
    } else {
      set({ error: 'Incorrect admin username or password.' });
    }
    return ok;
  },

  cancelLogin: () => set({ isModalVisible: false, pendingAction: null, error: null }),

  lock: () => set({ isUnlocked: false }),
}));
