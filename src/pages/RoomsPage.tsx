import { rooms } from '../data/mockData'

export function RoomsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rooms</p>
          <h2>群与通道状态</h2>
        </div>
        <p className="page-note">按房间关系看当前协作位置、通道类型和待处理情况。</p>
      </div>

      <div className="card-grid">
        {rooms.map((room) => (
          <article key={room.id} className="panel info-card">
            <div className="panel-header">
              <h3>{room.name}</h3>
              <span className={`status-pill status-${room.status}`}>{room.status}</span>
            </div>
            <div className="info-pairs">
              <div>
                <span>通道类型</span>
                <strong>{room.channelType}</strong>
              </div>
              <div>
                <span>当前焦点</span>
                <strong>{room.focus}</strong>
              </div>
              <div>
                <span>待处理项</span>
                <strong>{room.pending}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
