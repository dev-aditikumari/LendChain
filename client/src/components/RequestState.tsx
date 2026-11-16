import { useCallback, useEffect, useState } from 'react'
import { ApiError, messageFor } from '../api/http'
import Card from './Card'
import Notice from './Notice'

export function useRequest<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(() => {
    setLoading(true)
    setError(null)
    load().then(setData).catch(setError).finally(() => setLoading(false))
  }, [load])

  useEffect(run, [run])
  return { data, error, loading, reload: run }
}

// 403 gets its own message so a forbidden call never looks like a blank page
export function ErrorMessage({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <Card title="Not allowed">
        <p className="m-0 text-muted">Your role does not have access to this data. If you think it should, ask an admin.</p>
      </Card>
    )
  }
  return <Notice kind="danger">{messageFor(error)}</Notice>
}
