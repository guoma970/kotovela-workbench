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

function App() {
  return (
    <OfficeInstancesProvider
      fallbackAgents={agents}
      fallbackProjects={projects}
      fallbackRooms={rooms}
      fallbackTasks={tasks}
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="scheduler" element={<AutoTasksPage />} />
          <Route path="consultants" element={<ConsultantsPage />} />
          <Route path="auto-tasks" element={<Navigate to="/scheduler" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </OfficeInstancesProvider>
  )
}

export default App
