const MOCK_TEAM = [
  { id: 1, name: 'Alice Smith', role: 'Frontend Engineer', tasks: 3 },
  { id: 2, name: 'Bob Jones', role: 'Backend Engineer', tasks: 2 },
  { id: 3, name: 'Charlie Brown', role: 'Product Manager', tasks: 1 },
];

export default function TeamMembers() {
  return (
    <div>
      <h2 className="page-title">Team Members</h2>
      <div className="grid grid-cols-3">
        {MOCK_TEAM.map(m => (
          <div key={m.id} className="card" style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'var(--accent-primary)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
              {m.name.charAt(0)}
            </div>
            <h3 style={{ marginBottom: '4px' }}>{m.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>{m.role}</p>
            <span className="badge success">{m.tasks} Active Tasks</span>
          </div>
        ))}
      </div>
    </div>
  );
}
