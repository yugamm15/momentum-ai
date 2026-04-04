export const navItems = ['dashboard', 'meetings', 'tasks', 'analytics', 'settings'];

export const pipelineStages = [
  'Uploaded',
  'Transcribing audio',
  'Extracting decisions and tasks',
  'Calculating meeting score',
  'Ready',
];

export const metrics = [
  { label: 'Meetings Processed', value: '28', meta: '+6 this week' },
  { label: 'Average Score', value: '81', meta: 'Up 9% this week' },
  { label: 'Pending Tasks', value: '14', meta: '5 need review' },
  { label: 'Completion Rate', value: '68%', meta: 'Healthy execution pace' },
];

export const trend = [61, 67, 69, 72, 75, 79, 81, 84];

export const risks = [
  { label: 'No deadline assigned', value: 6 },
  { label: 'Owner unclear', value: 4 },
  { label: 'Task wording vague', value: 3 },
  { label: 'Decision unclear', value: 2 },
];

export const meetings = [
  {
    id: 'live',
    aiTitle: 'Hackathon Launch Readiness',
    rawTitle: 'Team sync',
    time: 'Apr 3, 2026 - 11:10 AM',
    source: 'Google Meet',
    participants: ['Aarav', 'Priya', 'Rohan', 'Neha'],
    processingSummary: 'Momentum is turning the latest recording into an execution-ready workspace.',
    summary:
      'The team aligned on the live demo flow, confirmed the seeded-dashboard opening, and assigned owners for extension polish and story refinement.',
    bullets: [
      'Lead with seeded history before the live upload finishes.',
      'Keep the extension intentionally narrow and trust-building.',
      'Show one editable AI mistake during the demo.',
    ],
    decisions: [
      { text: 'Keep the MVP Google Meet only.', confidence: '0.95' },
      { text: 'Use the execution-first closing line in the final demo.', confidence: '0.93' },
    ],
    checklist: [
      { id: 'lc1', text: 'Polish extension prompt', completed: true },
      { id: 'lc2', text: 'Seed 4-6 prior meetings', completed: true },
      { id: 'lc3', text: 'Confirm final walkthrough owner', completed: false },
    ],
    score: { overall: 82, clarity: 84, ownership: 79, execution: 83 },
    rationale:
      'Clear decisions and strong action language, but one follow-up remains unassigned.',
    transcript: [
      {
        time: '00:01',
        speaker: 'Priya',
        text: 'Let us keep Momentum focused on Google Meet so the story stays sharp.',
      },
      {
        time: '04:18',
        speaker: 'Aarav',
        text: 'I will polish the extension prompt and upload flow by tonight.',
      },
      {
        time: '15:22',
        speaker: 'Rohan',
        text: 'Someone should tighten the final walkthrough tomorrow, but we need an owner.',
      },
    ],
    meetingRisks: [
      {
        type: 'Owner unclear',
        severity: 'Medium',
        message: 'The final walkthrough follow-up still needs a named owner.',
      },
      {
        type: 'No deadline assigned',
        severity: 'Medium',
        message: 'The final walkthrough action does not yet have a confirmed deadline.',
      },
    ],
  },
  {
    id: 'm101',
    aiTitle: 'Demo Storyline Lock',
    rawTitle: 'Demo review',
    time: 'Apr 2, 2026 - 4:00 PM',
    source: 'Google Meet',
    participants: ['Aarav', 'Priya', 'Rohan'],
    summary:
      'The team finalized the demo arc and agreed to lead with execution outcomes instead of transcript quality claims.',
    bullets: [
      'Open on the dashboard.',
      'Show seeded history first.',
      'Close with the execution message.',
    ],
    decisions: [
      { text: 'Open the demo on the dashboard rather than the extension.', confidence: '0.94' },
      { text: 'Use the execution-first closing line.', confidence: '0.97' },
    ],
    checklist: [
      { id: 'd1', text: 'Finalize deck copy', completed: true },
      { id: 'd2', text: 'Rehearse closing line', completed: true },
    ],
    score: { overall: 88, clarity: 90, ownership: 85, execution: 88 },
    rationale: 'Strong decisions, explicit ownership, and very low ambiguity.',
    transcript: [
      {
        time: '02:14',
        speaker: 'Rohan',
        text: 'The story should be about execution systems, not just transcripts.',
      },
      {
        time: '12:09',
        speaker: 'Priya',
        text: 'I will update the deck and rehearse the closing line tonight.',
      },
    ],
    meetingRisks: [],
  },
  {
    id: 'm102',
    aiTitle: 'AI Extraction Calibration',
    rawTitle: 'LLM pipeline',
    time: 'Mar 31, 2026 - 3:10 PM',
    source: 'Google Meet',
    participants: ['Priya', 'Rohan', 'Neha'],
    summary:
      'The team agreed to keep extraction conservative, preserve source snippets, and never invent owners or deadlines.',
    bullets: [
      'Unknown owners must trigger review.',
      'Missing due dates become risk flags.',
      'Each task needs a source snippet.',
    ],
    decisions: [
      { text: 'Do not auto-assign ambiguous owners.', confidence: '0.96' },
      { text: 'Keep source snippets on extracted tasks.', confidence: '0.94' },
    ],
    checklist: [
      { id: 'a1', text: 'Add needs-review state', completed: true },
      { id: 'a2', text: 'Persist source snippets', completed: true },
    ],
    score: { overall: 79, clarity: 82, ownership: 73, execution: 81 },
    rationale: 'Good reasoning quality, but a few ownership statements stayed abstract.',
    transcript: [
      {
        time: '07:54',
        speaker: 'Rohan',
        text: 'If the transcript says someone should do it, we should mark it for review.',
      },
      {
        time: '20:16',
        speaker: 'Priya',
        text: 'We need source snippets so judges see why the model made each call.',
      },
    ],
    meetingRisks: [
      {
        type: 'Owner unclear',
        severity: 'Low',
        message: 'One follow-up stayed unresolved and was correctly marked for review.',
      },
    ],
  },
];

export const baseTasks = [
  {
    id: 't1',
    meetingId: 'm101',
    sourceMeeting: 'Demo Storyline Lock',
    title: 'Update the final deck with the closing line',
    owner: 'Priya',
    dueDate: 'Apr 3',
    status: 'Done',
    confidence: '0.96',
    needsReview: false,
    sourceSnippet: 'I will update the deck and rehearse the closing line tonight.',
  },
  {
    id: 't2',
    meetingId: 'm102',
    sourceMeeting: 'AI Extraction Calibration',
    title: 'Add source snippets to extracted tasks',
    owner: 'Neha',
    dueDate: 'Apr 3',
    status: 'In Progress',
    confidence: '0.91',
    needsReview: false,
    sourceSnippet: 'We need source snippets so judges see why the model made each call.',
  },
  {
    id: 't3',
    meetingId: 'm102',
    sourceMeeting: 'AI Extraction Calibration',
    title: 'Define review handling for ambiguous owners',
    owner: 'Rohan',
    dueDate: '',
    status: 'Pending',
    confidence: '0.74',
    needsReview: true,
    sourceSnippet: 'If the transcript says someone should do it, we should mark it for review.',
  },
];

export const liveTasks = [
  {
    id: 'lt1',
    meetingId: 'live',
    sourceMeeting: 'Hackathon Launch Readiness',
    title: 'Polish extension prompt and upload flow',
    owner: 'Aarav',
    dueDate: 'Tonight',
    status: 'In Progress',
    confidence: '0.95',
    needsReview: false,
    sourceSnippet: 'I will polish the extension prompt and upload flow by tonight.',
  },
  {
    id: 'lt2',
    meetingId: 'live',
    sourceMeeting: 'Hackathon Launch Readiness',
    title: 'Confirm final walkthrough owner and deadline',
    owner: '',
    dueDate: '',
    status: 'Pending',
    confidence: '0.68',
    needsReview: true,
    sourceSnippet: 'Someone should tighten the final walkthrough tomorrow, but we need an owner.',
  },
];

export const ownerLoad = [
  { name: 'Priya', count: 5 },
  { name: 'Aarav', count: 4 },
  { name: 'Neha', count: 3 },
  { name: 'Rohan', count: 2 },
];
