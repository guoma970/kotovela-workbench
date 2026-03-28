import { rooms } from '../data/mockData'

export function RoomsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rooms</p>
          <h2>群与通道状态</h2>
        </div>
        <p className="page-note">补出所属实例、主项目、用途和最近动作类型，让房间关系更清楚。</p>
      </div>

      <div className="card-grid">
        {rooms.map((room) => (
          <article key={room.id} className="panel info-card strong-card">
            <div className="panel-header">
              <h3>{room.name}</h3>
              <span className={`status-pill status-${room.status}`}>{room.status}</span>
            </div>
            <div className="info-pairs">
              <div>
                <span>所属实例</span>
                <strong>{room.instance}</strong>
              </div>
              <div>
                <span>当前主项目</span>
                <strong>{room.mainProject}</strong>
              </div>
              <div>
                <span>通道类型</span>
                <strong>{room.channelType}</strong>
              </div>
              <div>
                <span>待处理项</span>
                <strong>{room.pending}</strong>
              </div>
            </div>
            <div className="info-block">
              <span>当前用途</span>
              <strong>{room.purpose}</strong>
            </div>
            <div className="info-block">
              <span>最近动作类型</span>
              <strong>{room.recentAction}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
