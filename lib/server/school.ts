type CookieStoreLike = {
  get: (name: string) => { value?: string } | undefined;
};

export function getSchoolKeyFromServerCookies(cookieStore: CookieStoreLike): string {
  return String(cookieStore.get('schoolKey')?.value || '').trim();
}
