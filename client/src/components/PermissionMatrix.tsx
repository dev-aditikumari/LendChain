import { ROLES, ROLE_LABEL, ROLE_SHORT, type Level, type Role } from '../lib/permissions'
import Card from './Card'
import PermissionCell from './PermissionCell'

interface Props {
  title: string
  rowLabel: string
  data: Record<string, Record<Role, Level>>
}

export default function PermissionMatrix({ title, rowLabel, data }: Props) {
  return (
    <Card title={title} flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-th-bg">
              <th scope="col" className="px-[18px] py-2.5 text-left text-[13px] font-bold text-muted">{rowLabel}</th>
              {ROLES.map((r) => (
                <th key={r} scope="col" title={ROLE_LABEL[r]} className="px-2 py-2.5 text-center text-[13px] font-bold text-muted">
                  <abbr title={ROLE_LABEL[r]} className="no-underline">{ROLE_SHORT[r]}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([name, levels]) => (
              <tr key={name} className="border-t border-row-line">
                <th scope="row" className="px-[18px] py-2 text-left font-medium">{name}</th>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center"><PermissionCell level={levels[r]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 flex flex-wrap gap-4 px-[18px] py-3 text-xs text-muted">
        <span><PermissionCell level="full" /> allowed</span>
        <span><PermissionCell level="view" /> view only</span>
        <span><PermissionCell level="none" /> not allowed</span>
      </p>
    </Card>
  )
}
