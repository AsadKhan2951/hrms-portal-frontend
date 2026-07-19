function resolveBackendBaseUrl() {
  const baseUrl =
    process.env.WINGMAN_PROXY_TARGET?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    process.env.VITE_API_URL?.trim();

  if (!baseUrl) {
    throw new Error("Missing backend URL. Set WINGMAN_PROXY_TARGET or VITE_API_URL in Vercel.");
  }

  return baseUrl.replace(/\/+$/, "");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let targetUrl: string;
  try {
    targetUrl = `${resolveBackendBaseUrl()}/api/wingman/clock`;
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "backend_url_missing",
    });
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wingman-secret": req.headers["x-wingman-secret"]?.toString() || "",
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(response.status);

    const contentType = response.headers.get("content-type") || "application/json";
    res.setHeader("content-type", contentType);

    return res.send(text);
  } catch (error) {
    console.error("[Wingman Proxy] Failed to reach backend", error);
    return res.status(502).json({ ok: false, error: "backend_unreachable" });
  }
}
