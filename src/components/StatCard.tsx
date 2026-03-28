interface StatCardProps {
  label: string
  value: number
  tone?: 'blue' | 'green' | 'orange' | 'red'
}

export function StatCard({ label, value, tone = 'blue' }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
