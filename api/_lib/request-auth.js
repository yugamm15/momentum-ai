export async function resolveRequestWorkspaceContext(request, supabase, options = {}) {
  const allowAnonymous = options.allowAnonymous !== false;
  const token = readBearerToken(request);

  if (!token) {
    if (allowAnonymous) {
      return null;
    }

    throw new Error('Missing workspace authorization.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user?.id) {
    if (allowAnonymous) {
      return null;
    }

    throw new Error(userError?.message || 'Momentum could not validate the workspace session.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, workspace_id, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    if (allowAnonymous) {
      return null;
    }

    throw new Error(profileError.message || 'Momentum could not resolve the signed-in workspace.');
  }

  return {
    accessToken: token,
    profileId: user.id,
    workspaceId: profile?.workspace_id || null,
    email: profile?.email || user.email || '',
    fullName: profile?.full_name || '',
  };
}

export function readBearerToken(request) {
  const headerValue =
    request?.headers?.get?.('authorization') ||
    request?.headers?.get?.('Authorization') ||
    '';
  const match = String(headerValue).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}
