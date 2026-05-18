import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AdminInfo } from '@/api/auth';

const TOKEN_KEY = 'xc_admin_token';
const ADMIN_KEY = 'xc_admin_info';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? '');
  const admin = ref<AdminInfo | null>(
    JSON.parse(localStorage.getItem(ADMIN_KEY) ?? 'null'),
  );

  function setSession(t: string, info: AdminInfo): void {
    token.value = t;
    admin.value = info;
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(info));
  }

  function logout(): void {
    token.value = '';
    admin.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  }

  return { token, admin, setSession, logout };
});
