import { rooms } from '../data/mockData'

export function RoomsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rooms</p>
          <h2>群与通道状态</h2>
        </div>
        <p className="page-note">先展示房间名称、关注点和待处理量。</p>
      </div>

      <div className="panel list-panel">
        {rooms.map((room) => (
          <article key={room.id} className="list-row stacked-row">
            <div>
              <h3>{room.name}</h3>
              <p>
                {room.focus} · 待处理：{room.pending}
              </p>
            </div>
            <div className="row-meta">
              <span className={`status-pill status-${room.status}`}>{room.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
