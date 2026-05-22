import { useSearchParams } from 'react-router-dom'
import type { Flow } from '../features/editor/types'
import { SharedFlowViewer } from '../features/shared/SharedFlowViewer'

interface DevRenderPageProps {
  fixtures: Record<string, Flow>
}

export function DevRenderPage({ fixtures }: DevRenderPageProps) {
  const [params] = useSearchParams()
  const name = params.get('fixture')

  if (!name) {
    const names = Object.keys(fixtures).sort()
    return (
      <div
        data-testid="dev-fixture-list"
        style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Dev Render Sandbox</h1>
        <p style={{ marginBottom: 16, color: '#555' }}>
          Pick a fixture to render via <code>?fixture=&lt;name&gt;</code>.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {names.map((n) => (
            <li key={n} style={{ marginBottom: 6 }}>
              <a href={`/dev/render?fixture=${encodeURIComponent(n)}`}>{n}</a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const flow = fixtures[name]
  if (!flow) {
    return (
      <div
        data-testid="dev-fixture-error"
        style={{
          padding: 24,
          color: '#b00020',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <p>
          Fixture not found: <code>{name}</code>
        </p>
        <p>
          <a href="/dev/render">Back to list</a>
        </p>
      </div>
    )
  }

  return <SharedFlowViewer flow={flow} />
}
