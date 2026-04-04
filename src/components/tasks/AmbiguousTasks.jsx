const MOCK_AMBIGUOUS = [
  { id: 1, task: 'Follow up with client', summary: 'Assigned to "Team", needs specific owner', meeting: 'Product Sync' },
  { id: 2, task: 'Deploy new feature', summary: 'Mentioned "maybe next week", needs exact deadline', meeting: 'Design Review' }
];

export default function AmbiguousTasks() {
  return (
    <div>
      <h2 className="page-title">Ambiguous Task Resolver</h2>
      <div className="grid grid-cols-1">
        {MOCK_AMBIGUOUS.map(t => (
          <div key={t.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <h3 style={{ marginBottom: '8px' }}>{t.task}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              From: {t.meeting} • Issue: {t.summary}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="text" className="input" placeholder="Assign specific owner / date..." />
              <button className="button">Resolve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
