import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, messageFor } from '../api/http'
import Button from './Button'
import Card from './Card'
import Notice from './Notice'

// `key` re-runs the request when it changes (for example a route id); the loader itself may be an inline function
export function useRequest<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  loadRef.current = load

  const run = useCallback(() => {
    setLoading(true)
    setError(null)
    loadRef.current().then(setData).catch(setError).finally(() => setLoading(false))
  }, [])

  useEffect(run, [run, key])
  return { data, error, loading, reload: run }
}

// `page` is for a screen whose data could not be loaded: a 403 there gets a full "Not allowed" card.
// Next to a form, a refusal shows the server's reason (for example "above your approval limit").
export function ErrorMessage({ error, onRetry, page }: { error: unknown; onRetry?: () => void; page?: boolean }) {
  if (page && error instanceof ApiError && error.status === 403) {
    return (
      <Card title="Not allowed">
        <p className="m-0 text-muted">Your role does not have access to this data. If you think it should, ask an admin.</p>
      </Card>
    )
  }
  return (
    <Notice kind="danger">
      <span>{messageFor(error)}</span>
      {onRetry && <Button variant="row" className="ml-3" onClick={onRetry}>Try again</Button>}
    </Notice>
  )
}

interface Req<T> { data: T | null; error: unknown; loading: boolean; reload: () => void }

// shows a loading line, the error, or the screen body once the data is here
export function Async<T>({ req, children }: { req: Req<T>; children: (data: T) => ReactNode }) {
  if (req.error) return <ErrorMessage page error={req.error} onRetry={req.reload} />
  if (req.data === null) {
    return <p role="status" aria-busy="true" className="m-0 py-6 text-center text-muted">Loading...</p>
  }
  return <>{children(req.data)}</>
}

// runs a write and keeps its error for display next to the form
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])
  return { run, busy, error, clear: () => setError(null) }
}
