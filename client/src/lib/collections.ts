import type { AgeBucket } from '../api/types'
import type { PillKind } from '../components/StatusPill'

export const BUCKET_ACTION: Record<AgeBucket, string> = {
  '0-30': 'Reminder stage',
  '31-60': 'Call the buyer',
  '61-90': 'Escalate',
  '90+': 'Legal review',
}

export const bucketKind = (b: AgeBucket): PillKind => (b === '90+' ? 'danger' : b === '0-30' ? 'neutral' : 'warning')

export const CHANNEL_LABEL = { CALL: 'Call', EMAIL: 'Email', VISIT: 'Visit', NOTE: 'Note' } as const
