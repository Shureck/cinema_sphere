import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const accessKeyId = env.YANDEX_ACCESS_KEY_ID;
    const secretAccessKey = env.YANDEX_SECRET_ACCESS_KEY;
    const bucket = env.YANDEX_BUCKET;
    const region = env.YANDEX_REGION || 'ru-central1';

    if (!accessKeyId || !secretAccessKey || !bucket) {
      return json({ error: 'Presigner not configured' }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const { filename, contentType } = body;
    if (!filename || !contentType) {
      return json({ error: 'filename and contentType required' }, 400);
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `cinema-sphere/${Date.now()}-${safeName}`;
    const objectUrl = `https://storage.yandexcloud.net/${bucket}/${key}`;
    const expiresIn = 3600;
    const presignUrl = `${objectUrl}?X-Amz-Expires=${expiresIn}`;

    const client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region,
    });

    const signedRequest = await client.sign(new Request(presignUrl, { method: 'PUT' }), {
      aws: { signQuery: true },
    });

    const putUrl = signedRequest.url;
    const publicUrl = objectUrl;

    return json(
      { putUrl, publicUrl },
      { headers: corsHeaders() }
    );
  },
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...(init.headers || {}),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
