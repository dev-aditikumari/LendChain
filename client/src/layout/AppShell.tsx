import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'
import { ROLE_LABEL, navFor } from '../lib/permissions'

export default function AppShell() {
  const { user, signOut, section } = useAuth()
  if (!user) return null
  const items = navFor(user.role, section)
  const role = ROLE_LABEL[user.role]

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className="flex shrink-0 flex-col gap-4 px-4 py-5 text-nav-text md:sticky md:top-0 md:h-screen md:w-[236px]"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        <Logo />
        <span className="w-fit rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">{role}</span>
        <nav aria-label="Workspace" className="flex-1">
          <p className="m-0 mb-2 px-3 text-[11px] font-bold tracking-[0.12em] text-nav-label">WORKSPACE</p>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {items.map((it) => (
              <li key={it.label}>
                <NavLink
                  to={it.to}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[15px] no-underline ${
                      isActive ? 'bg-white/14 font-semibold text-white' : 'text-nav-text hover:bg-white/8'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span aria-hidden="true" className={`size-2 rounded-[2px] ${isActive ? 'bg-sun' : 'bg-nav-dot'}`} />
                      {it.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-3 rounded-[14px] bg-white/8 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sun font-display font-extrabold text-ink">
              {role[0]}
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="m-0 text-xs text-nav-label">{role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="min-h-11 w-full cursor-pointer rounded-[10px] border border-white/25 bg-transparent px-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3 px-4 pt-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <label htmlFor="global-search" className="sr-only">Search invoices, buyers and records</label>
            <input
              id="global-search"
              type="search"
              placeholder="Search invoices, buyers, records"
              className="min-h-11 w-full max-w-[340px] rounded-full border border-input-border bg-white/90 px-4"
            />
          </div>
          <span className="rounded-full bg-violet-tint px-3.5 py-2 text-sm font-semibold text-[#4B2FBF]">Viewing as {role}</span>
          <button
            aria-label="Notifications, 1 unread"
            className="relative grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-white/90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1B1340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z" /><path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
            <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-white bg-sun" />
          </button>
        </div>
        <main className="grid gap-4 px-4 py-[22px] sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
