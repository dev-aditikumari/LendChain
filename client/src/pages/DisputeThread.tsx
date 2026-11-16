import { useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import { Field } from '../components/Field'
import KeyValueCard from '../components/KeyValueCard'
import { Grid } from '../components/KpiRow'
import MessageThread, { type Message } from '../components/MessageThread'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { DISPUTE_MESSAGES } from '../data/sample'
import { useAuth } from '../auth/AuthContext'
import { inr } from '../lib/format'

export default function DisputeThread() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>(DISPUTE_MESSAGES)
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim() || !user) return
    setMessages((m) => [...m, { id: m.length + 1, from: user.name, own: true, text: text.trim(), time: 'Just now' }])
    setText('')
  }

  return (
    <>
      <PageHeader title="Dispute: INV-2019" subtitle="Quantity mismatch raised by the buyer." actions={<StatusPill kind="danger">Disputed</StatusPill>} />
      <Grid>
        <Card title="Conversation">
          <MessageThread messages={messages} />
          <form className="mt-4 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); send() }}>
            <Field className="flex-1" label="Reply" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit">Send</Button>
          </form>
        </Card>
        <KeyValueCard
          title="Dispute details"
          rows={[
            ['Disputed amount', inr(380000)],
            ['Reason', 'Quantity mismatch'],
            ['Financing', <StatusPill key="f" kind="neutral">Paused</StatusPill>],
            ['Raised on', '08 Nov 2026'],
            ['Resolution SLA', '5 working days (2 left)'],
          ]}
        />
      </Grid>
    </>
  )
}
