export const storage = {
  save(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  },
  load(key: string): any {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  clear(key: string): void {
    try { localStorage.removeItem(key); } catch {}
  }
};
