/**
 * Orchestrator API client
 * Wraps fetch calls to the FastAPI backend with auth token.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8080";

interface ApiOptions {
  token?: string;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  opts?: ApiOptions
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (opts?.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Trip API ---

export interface TripData {
  id: string;
  name: string;
  chain_trip_id: number;
  organizer: string;
  spend_limit: string;
  status: string;
  created_at: string;
}

export async function createTrip(
  data: { name: string; spend_limit: string },
  token?: string
): Promise<TripData> {
  return apiFetch("/v1/trips", {
    method: "POST",
    body: JSON.stringify(data),
  }, { token });
}

export async function getTrips(token?: string): Promise<TripData[]> {
  return apiFetch("/v1/trips", { method: "GET" }, { token });
}

export async function getTrip(id: string, token?: string): Promise<TripData> {
  return apiFetch(`/v1/trips/${id}`, { method: "GET" }, { token });
}

// --- Voice / Text Converse ---

export async function textConverse(
  tripId: string,
  message: string,
  token?: string
): Promise<{ reply: string }> {
  return apiFetch(
    "/v1/text/converse",
    {
      method: "POST",
      body: JSON.stringify({ trip_id: tripId, message }),
    },
    { token }
  );
}

/**
 * Send audio to orchestrator voice endpoint.
 * Returns a WAV blob for playback.
 */
export async function voiceConverse(
  tripId: string,
  audioBlob: Blob,
  token?: string
): Promise<Blob> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("trip_id", tripId);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/v1/voice/converse`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Voice API ${res.status}: ${text}`);
  }

  return res.blob();
}
