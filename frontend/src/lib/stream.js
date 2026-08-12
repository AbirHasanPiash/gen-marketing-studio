import { API_ORIGIN, getToken } from './api';

/**
 * Consume a Server-Sent-Events stream from a POST endpoint (fetch-based, since
 * EventSource can't POST). Calls onToken for each delta and onDone at the end.
 */
export async function streamPost(path, body, { onToken, onDone, onError } = {}) {
  try {
    const res = await fetch(`${API_ORIGIN}/api${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const payload = await res.json().catch(() => null);
      const details = payload?.error?.details;
      const detailText = Array.isArray(details)
        ? details.map((d) => `${d.path}: ${d.message}`).join(', ')
        : details;
      const message = payload?.error?.message || `Stream failed (${res.status})`;
      throw new Error(detailText ? `${message}: ${detailText}` : message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        let event = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === 'done') onDone?.(parsed.text);
        else if (event === 'error') onError?.(new Error(parsed.message));
        else if (parsed.token) onToken?.(parsed.token);
      }
    }
  } catch (err) {
    onError?.(err);
  }
}
