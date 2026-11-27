import { useCallback, useEffect, useState } from 'react'
import { http } from '../api/http'

// the header bell and the notifications page share this count through a window event
const EVENT = 'lendchain:notifications-read'

export async function markNotificationsRead() {
  try {
    await http('/notifications/read', { body: {} })
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // the count stays as it was; the next visit tries again
  }
}

export function useUnreadCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const refresh = useCallback(() => {
    if (!enabled) return
    http<{ count: number }>('/notifications/unread').then((r) => setCount(r.count)).catch(() => setCount(0))
  }, [enabled])
  useEffect(() => {
    refresh()
    window.addEventListener(EVENT, refresh)
    return () => window.removeEventListener(EVENT, refresh)
  }, [refresh])
  return count
}
