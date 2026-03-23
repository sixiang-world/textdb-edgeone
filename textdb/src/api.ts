const BASE = location.origin;

export async function writeData(key: string, value: string) {
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`,
  });
  return res.json();
}

export async function deleteData(key: string) {
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `key=${encodeURIComponent(key)}&value=`,
  });
  return res.json();
}

export async function readData(key: string): Promise<string> {
  const res = await fetch(`${BASE}/${key}`);
  return res.text();
}
