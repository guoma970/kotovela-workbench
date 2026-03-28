import type { Agent, Project, Room, Task, UpdateItem } from '../types'

export const agents: Agent[] = [
  {
    id: 'agent-1',
    name: '小树',
    role: '中枢统筹',
    status: 'active',
    currentTask: '分流主线与支线任务',
    updatedAt: '2 分钟前',
  },
  {
    id: 'agent-2',
    name: '小筑',
    role: '开发执行',
    status: 'active',
    currentTask: '初始化言町科技工作台',
    updatedAt: '刚刚',
  },
  {
    id: 'agent-3',
    name: '小果',
    role: '内容支持',
    status: 'idle',
    currentTask: '等待新任务',
    updatedAt: '18 分钟前',
  },
]

export const projects: Project[] = [
  {
    id: 'project-1',
    name: '言町科技工作台',
    owner: '小筑',
    status: 'active',
    progress: 24,
  },
  {
    id: 'project-2',
    name: '羲果陪伴',
    owner: '小树',
    status: 'planning',
    progress: 10,
  },
  {
    id: 'project-3',
    name: 'OpenClaw 协作体系整理',
    owner: '小树',
    status: 'blocked',
    progress: 42,
  },
]

export const tasks: Task[] = [
  {
    id: 'task-1',
    title: '搭建 Dashboard 页面壳',
    project: '言町科技工作台',
    assignee: '小筑',
    status: 'doing',
    priority: 'high',
  },
  {
    id: 'task-2',
    title: '整理 Agents mock 数据',
    project: '言町科技工作台',
    assignee: '小筑',
    status: 'doing',
    priority: 'medium',
  },
  {
    id: 'task-3',
    title: '确认主线排期',
    project: '羲果陪伴',
    assignee: '小树',
    status: 'blocked',
    priority: 'high',
  },
  {
    id: 'task-4',
    title: '输出移交包 v0.1',
    project: '言町科技工作台',
    assignee: '小树',
    status: 'done',
    priority: 'medium',
  },
]

export const rooms: Room[] = [
  {
    id: 'room-1',
    name: '羲果陪伴开发群',
    status: 'active',
    focus: '主线任务派发与回报',
    pending: 3,
  },
  {
    id: 'room-2',
    name: '言町科技工作台工作流',
    status: 'active',
    focus: 'V1 原型推进',
    pending: 2,
  },
  {
    id: 'room-3',
    name: '阻塞处理区',
    status: 'blocked',
    focus: '等待拍板',
    pending: 1,
  },
]

export const updates: UpdateItem[] = [
  {
    id: 'update-1',
    title: '言町科技工作台脚手架已初始化',
    source: '小筑',
    time: '刚刚',
    type: 'success',
  },
  {
    id: 'update-2',
    title: 'Dashboard / Agents / Projects / Tasks / Rooms 页面壳进入搭建',
    source: '小筑',
    time: '1 分钟前',
    type: 'info',
  },
  {
    id: 'update-3',
    title: '羲果陪伴主线仍等待后续任务派发',
    source: '小树',
    time: '10 分钟前',
    type: 'warning',
  },
]
