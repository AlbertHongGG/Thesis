function getErrorMessage(response: Response, body: unknown) {
  if (body && typeof body === 'object') {
    if ('error' in body && typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }

    if ('message' in body && typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  }

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  return `Request failed: ${response.status} ${response.statusText}`;
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => '');
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(response, body));
  }

  return (body ?? {}) as T;
}

export async function requestResponse(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new Error(getErrorMessage(response, body));
  }

  return response;
}