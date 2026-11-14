export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Deploy check',
  robots: { index: false, follow: false },
}

export default function DeployCheckPage() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'lokaal'
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? 'lokaal'
  const env = process.env.VERCEL_ENV ?? 'development'
  const now = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: '#f7f8fa',
        color: '#0f1b2d',
        padding: '2rem',
      }}
    >
      <div
        style={{
          border: '1px solid #d8dde5',
          borderRadius: 12,
          background: '#fff',
          padding: '2rem 2.5rem',
          lineHeight: 1.9,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          ✅ Deploy doorgekomen
        </div>
        <div>commit: {sha}</div>
        <div>branch: {branch}</div>
        <div>omgeving: {env}</div>
        <div>paginatijd: {now}</div>
      </div>
    </main>
  )
}
