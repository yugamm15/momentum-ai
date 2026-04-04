export function normalizePersonName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createPersonDirectory(profiles = [], membershipByProfileId = new Map()) {
  return (Array.isArray(profiles) ? profiles : [])
    .map((profile) => buildDirectoryRecord(profile, membershipByProfileId.get(profile.id)))
    .filter(Boolean);
}

export function matchDirectoryPerson(name, directory = []) {
  const normalizedCandidate = normalizePersonName(name);
  if (!normalizedCandidate) {
    return { status: 'unmatched', confidence: 0 };
  }

  const exactMatches = directory.filter((record) => record.aliases.includes(normalizedCandidate));
  if (exactMatches.length === 1) {
    return {
      status: 'matched',
      confidence: 1,
      record: exactMatches[0],
    };
  }

  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      confidence: 1,
    };
  }

  const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
  const scored = directory
    .map((record) => ({
      record,
      confidence: scoreCandidate(candidateTokens, record),
    }))
    .filter((entry) => entry.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);

  if (!scored.length || scored[0].confidence < 0.76) {
    return { status: 'unmatched', confidence: scored[0]?.confidence || 0 };
  }

  const [best, second] = scored;
  if (second && best.confidence - second.confidence < 0.08) {
    return { status: 'ambiguous', confidence: best.confidence };
  }

  return {
    status: 'matched',
    confidence: Number(best.confidence.toFixed(3)),
    record: best.record,
  };
}

export function displayNameForProfile(profile = {}) {
  const fullName = String(profile.full_name || '').trim();
  if (fullName) {
    return fullName;
  }

  const email = String(profile.email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    return email || 'Workspace member';
  }

  const localPart = email.split('@')[0];
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ') || email;
}

function buildDirectoryRecord(profile, membership) {
  if (!profile?.id) {
    return null;
  }

  const displayName = displayNameForProfile(profile);
  const aliases = buildAliases(displayName, profile.email);
  const tokenSet = new Set();

  aliases.forEach((alias) => {
    alias.split(' ').filter(Boolean).forEach((token) => tokenSet.add(token));
  });

  const tokens = Array.from(tokenSet);

  return {
    id: profile.id,
    email: String(profile.email || '').trim(),
    displayName,
    role: membership?.role || 'member',
    aliases,
    tokens,
    firstToken: tokens[0] || '',
  };
}

function buildAliases(displayName, email) {
  const aliases = new Set();
  const normalizedDisplayName = normalizePersonName(displayName);
  const normalizedEmail = normalizePersonName(String(email || '').split('@')[0]);

  if (normalizedDisplayName) {
    aliases.add(normalizedDisplayName);

    const parts = normalizedDisplayName.split(' ').filter(Boolean);
    if (parts[0]) {
      aliases.add(parts[0]);
    }
  }

  if (normalizedEmail) {
    aliases.add(normalizedEmail);

    const emailParts = normalizedEmail.split(' ').filter(Boolean);
    if (emailParts[0]) {
      aliases.add(emailParts[0]);
    }
  }

  return Array.from(aliases);
}

function scoreCandidate(candidateTokens, record) {
  if (!candidateTokens.length || !record) {
    return 0;
  }

  const normalizedCandidate = candidateTokens.join(' ');
  if (record.aliases.includes(normalizedCandidate)) {
    return 1;
  }

  if (candidateTokens.length === 1 && candidateTokens[0] === record.firstToken) {
    return 0.94;
  }

  if (candidateTokens.every((token) => record.tokens.includes(token))) {
    return Math.min(0.99, 0.86 + candidateTokens.length * 0.05);
  }

  if (record.tokens.every((token) => candidateTokens.includes(token))) {
    return 0.82;
  }

  if (candidateTokens.length === 1 && record.tokens.includes(candidateTokens[0])) {
    return 0.78;
  }

  return 0;
}
