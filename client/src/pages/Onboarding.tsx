import { http } from '../api/http'
import type { Entity } from '../api/types'
import KeyValueCard from '../components/KeyValueCard'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import { Async, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'

const load = () => http<Entity>('/entities/mine')

const KYC: Record<string, string> = { PENDING: 'Pending', UNDER_REVIEW: 'Under review', VERIFIED: 'Verified', REJECTED: 'Rejected' }

export default function Onboarding() {
  const req = useRequest(load)
  return (
    <>
      <PageHeader title="Onboarding and KYC" subtitle="Your business details and where your verification stands." />
      <Async req={req}>
        {(e) => (
          <>
            {e.kycStatus === 'REJECTED' && <Notice kind="danger">Verification was rejected{e.kycRemarks ? `: ${e.kycRemarks}` : '.'}</Notice>}
            {e.kycStatus !== 'VERIFIED' && e.kycStatus !== 'REJECTED' && (
              <Notice kind="warning">Financing opens once an analyst verifies your business.</Notice>
            )}
            <KeyValueCard
              title="Business details"
              rows={[
                ['Legal name', e.legalName],
                ['PAN', e.pan ?? '-'],
                ['GSTIN', e.gstin ?? '-'],
                ['Settlement account', e.bankAccount ?? 'Not added'],
                ['Months in business', String(e.vintageMonths ?? 0)],
                ['KYC status', <StatusPill key="k">{KYC[e.kycStatus ?? 'PENDING'] ?? 'Pending'}</StatusPill>],
              ]}
            />
          </>
        )}
      </Async>
    </>
  )
}
