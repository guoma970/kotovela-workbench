import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { agents, projects, rooms, tasks } from './data/mockData'
import { OfficeInstancesProvider } from './data/officeInstancesContext'
import { AppShell } from './layout/AppShell'
import { AgentsPage } from './pages/AgentsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { RoomsPage } from './pages/RoomsPage'
import { TasksPage } from './pages/TasksPage'
import { AutoTasksPage } from './pages/AutoTasksPage'
import { ConsultantsPage } from './pages/ConsultantsPage'
import { LeadsPage } from './pages/LeadsPage'
import { ModelUsagePage } from './pages/ModelUsagePage'
import { SystemControlPage } from './pages/SystemControlPage'
import { EvidenceAcceptancePage } from './pages/EvidenceAcceptancePage'

type RouteErrorBoundaryProps = {
  children: ReactNode
}

type RouteErrorBoundaryState = {
  hasError: boolean
  message: string
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : '页面渲染时遇到未知错误',
    }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Route render failed', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: '#f8fafc',
            color: '#0f172a',
          }}
        >
          <section
            role="alert"
            style={{
              maxWidth: '520px',
              borderRadius: '24px',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: '#ffffff',
              padding: '28px',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)',
            }}
          >
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '14px' }}>Kotovela Hub</p>
            <h1 style={{ margin: '0 0 12px', fontSize: '24px' }}>页面暂时无法打开</h1>
            <p style={{ margin: '0 0 20px', lineHeight: 1.7, color: '#475569' }}>
              系统已拦截本次异常，避免影响其他页面。你可以先刷新页面；如果仍然失败，请把当前页面和时间发给研发群。
            </p>
            <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '13px' }}>{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: '999px',
                background: '#0f172a',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 700,
                padding: '12px 18px',
              }}
            >
              刷新页面
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function App() {
  return (
    <OfficeInstancesProvider
      fallbackAgents={agents}
      fallbackProjects={projects}
      fallbackRooms={rooms}
      fallbackTasks={tasks}
    >
      <RouteErrorBoundary>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="scheduler" element={<AutoTasksPage />} />
            <Route path="consultants" element={<ConsultantsPage />} />
            <Route path="model-usage" element={<ModelUsagePage />} />
            <Route path="system-control" element={<SystemControlPage />} />
            <Route path="evidence-acceptance" element={<EvidenceAcceptancePage />} />
            <Route path="auto-tasks" element={<Navigate to="/scheduler" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </RouteErrorBoundary>
    </OfficeInstancesProvider>
  )
}

export default App
