/**
 * Sends a POST JSON request and safely parses a JSON response.
 * Prevents raw `Unexpected token '<', "<!doctype "` syntax errors if a dev server
 * restart or proxy briefly serves an HTML fallback, automatically retrying once.
 */
export async function postJsonSafely<T>(
  url: string,
  body: unknown,
  fallbackError: string
): Promise<T> {
  const attempt = async (): Promise<{
    ok: boolean;
    status: number;
    isHtml: boolean;
    data: (T & { error?: string }) | null;
  }> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const trimmed = rawText.trimStart();
    const looksLikeHtml =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html');

    if (looksLikeHtml) {
      return { ok: false, status: response.status, isHtml: true, data: null };
    }

    try {
      const parsed = rawText ? (JSON.parse(rawText) as T & { error?: string }) : null;
      return { ok: response.ok, status: response.status, isHtml: false, data: parsed };
    } catch {
      return { ok: false, status: response.status, isHtml: false, data: null };
    }
  };

  let result = await attempt();

  // Retry once if the server was mid-restart and returned an HTML fallback
  if (result.isHtml) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    result = await attempt();
  }

  if (result.isHtml) {
    throw new Error(
      `The API route (${url}) returned an HTML page instead of JSON (HTTP ${result.status}). Please refresh the preview and try again.`
    );
  }

  if (!result.ok || !result.data) {
    throw new Error(
      result.data?.error || `${fallbackError} (HTTP ${result.status})`
    );
  }

  return result.data;
}
