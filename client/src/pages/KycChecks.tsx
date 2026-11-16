import { useState } from 'react'
import { http } from '../api/http'
import type { Entity } from '../api/types'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import { Field } from '../components/Field'
import PageHeader from '../components/PageHeader'
import { Async, ErrorMessage, useMutation, useRequest } from '../components/RequestState'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../auth/AuthContext'

const load = () => http<Entity[]>('/entities')
const LABEL: Record<string, string> = { PENDING: 'Pending', UNDER_REVIEW: 'Under review', VERIFIED: 'Verified', REJECTED: 'Rejected' }

export default function KycChecks() {
  const { can } = useAuth()
  const req = useRequest(load)
  const m = useMutation()
  const [remarks, setRemarks] = useState('')

  const mark = async (id: string, status: string) => {
    await m.run(() => http(`/entities/${id}/kyc`, { method: 'PATCH', body: { status, remarks: remarks.trim() || undefined } }))
    req.reload()
  }

  return (
    <>
      <PageHeader title="KYC checks" subtitle="Verify suppliers and buyers before they can use financing." />
      <Field label="Remarks for the next change (shown to the supplier)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      {m.error ? <ErrorMessage error={m.error} /> : null}
      <Async req={req}>
        {(rows) => (
          <DataTable
            title="Entities"
            columns={[
              { key: 'legalName', header: 'Name', render: (r) => <b>{r.legalName}</b> },
              { key: 'kind', header: 'Type' },
              { key: 'pan', header: 'PAN' },
              { key: 'kycStatus', header: 'KYC', render: (r) => <StatusPill>{LABEL[r.kycStatus ?? 'PENDING'] ?? 'Pending'}</StatusPill> },
              {
                key: 'act', header: 'Action',
                render: (r) => can('entity:verify') && (
                  <span className="flex flex-wrap gap-2">
                    <Button variant="row" disabled={m.busy || r.kycStatus === 'VERIFIED'} onClick={() => mark(r._id, 'VERIFIED')}>Verify</Button>
                    <Button variant="row" disabled={m.busy || r.kycStatus === 'UNDER_REVIEW'} onClick={() => mark(r._id, 'UNDER_REVIEW')}>Under review</Button>
                    <Button variant="row" disabled={m.busy || r.kycStatus === 'REJECTED'} onClick={() => mark(r._id, 'REJECTED')}>Reject</Button>
                  </span>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r._id}
          />
        )}
      </Async>
    </>
  )
}
