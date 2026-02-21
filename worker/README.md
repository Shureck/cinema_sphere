# Cinema Sphere Presigner (Cloudflare Worker)

Worker выдаёт presigned PUT URL для загрузки файлов в Yandex Object Storage. Ключи не хранятся в клиенте.

## Развёртывание

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put YANDEX_ACCESS_KEY_ID
npx wrangler secret put YANDEX_SECRET_ACCESS_KEY
npx wrangler secret put YANDEX_BUCKET
npx wrangler deploy
```

После деплоя скопируйте URL Worker (например, `https://cinema-sphere-presigner.xxx.workers.dev`) и укажите его в `.env` приложения:

```
VITE_PRESIGNER_URL=https://cinema-sphere-presigner.xxx.workers.dev
```

Затем выполните `npm run build` в корне проекта.

## Переменные окружения (secrets)

| Переменная | Описание |
|------------|----------|
| YANDEX_ACCESS_KEY_ID | Access Key ID из Yandex Cloud |
| YANDEX_SECRET_ACCESS_KEY | Secret Access Key |
| YANDEX_BUCKET | Имя bucket в Object Storage |
| YANDEX_REGION | (опционально) Регион, по умолчанию `ru-central1` |
