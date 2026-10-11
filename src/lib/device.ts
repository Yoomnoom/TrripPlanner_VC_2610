const NICK_KEY = 'tp:last-nickname';

/** Last nickname used on this device, offered as the default in forms. */
export const getLastNickname = () => {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setLastNickname = (nickname: string) => {
  try {
    localStorage.setItem(NICK_KEY, nickname);
  } catch {
    // storage unavailable (private mode quota etc.): the default is a convenience only
  }
};

/** Returns false when the browser blocks clipboard access. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
