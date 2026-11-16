export interface Message {
  id: number
  from: string
  own: boolean
  text: string
  time: string
}

export default function MessageThread({ messages }: { messages: Message[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0" aria-label="Messages">
      {messages.map((m) => (
        <li key={m.id} className={`flex flex-col ${m.own ? 'items-end' : 'items-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.own ? 'rounded-br-md bg-violet text-white' : 'rounded-bl-md bg-[#EEF0F6] text-ink'}`}>
            {m.text}
          </div>
          <span className="mt-1 text-xs text-muted">{m.from}, {m.time}</span>
        </li>
      ))}
    </ul>
  )
}
