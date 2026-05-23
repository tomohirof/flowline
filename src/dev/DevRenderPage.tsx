import { Link, useSearchParams } from 'react-router-dom'
import type { Flow } from '../features/editor/types'
import { SharedFlowViewer } from '../features/shared/SharedFlowViewer'
import { fixtures as defaultFixtures } from './fixtures'

interface DevRenderPageProps {
  fixtures?: Record<string, Flow>
}

const pageStyle = {
  padding: 24,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
} as const

export function DevRenderPage({ fixtures = defaultFixtures }: DevRenderPageProps) {
  const [params] = useSearchParams()
  const name = params.get('fixture')

  if (!name) {
    const names = Object.keys(fixtures).sort()
    return (
      <div data-testid="dev-fixture-list" style={pageStyle}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Dev Render Sandbox</h1>
        <p style={{ marginBottom: 16, color: '#555' }}>
          Pick a fixture to render via <code>?fixture=&lt;name&gt;</code>.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {names.map((n) => (
            <li key={n} style={{ marginBottom: 6 }}>
              <Link to={`/dev/render?fixture=${encodeURIComponent(n)}`}>{n}</Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const flow = fixtures[name]
  if (!flow) {
    return (
      <div data-testid="dev-fixture-error" style={{ ...pageStyle, color: '#b00020' }}>
        <p>
          Fixture not found: <code>{name}</code>
        </p>
        <p>
          <Link to="/dev/render">Back to list</Link>
        </p>
      </div>
    )
  }

  return <SharedFlowViewer flow={flow} />
}
