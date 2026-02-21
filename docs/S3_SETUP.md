# Настройка Yandex Object Storage для Cinema Sphere

Чтобы показывать фото и видео с Yandex S3 на куполе и получать ссылки для публикации, нужно настроить bucket в Yandex Object Storage.

## Загрузка с кнопки «Опубликовать»

Для загрузки локальных файлов на S3 при нажатии «Опубликовать» разверните [Cloudflare Worker](../worker/README.md) (presigner). Он выдаёт presigned URL; загрузка идёт напрямую в Yandex S3, ключи в браузер не попадают.

## 1. CORS

Настройте CORS для bucket, чтобы браузер мог загружать медиа с вашего домена (например, `https://username.github.io`).

В консоли Yandex Cloud: **Object Storage → выберите bucket → CORS**.

Добавьте правило:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://username.github.io</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://127.0.0.1:5173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>Range</AllowedHeader>
    <AllowedHeader>Content-Type</AllowedHeader>
    <ExposeHeader>Content-Range</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

`PUT` нужен для загрузки файлов через presigned URL (кнопка «Опубликовать»).

- `AllowedOrigin` — подставьте ваш домен GitHub Pages (например, `https://your-username.github.io`) и локальные адреса для разработки.
- `Range` — нужен для потокового воспроизведения видео (byte-range requests).
- `Content-Range`, `Content-Length` — браузеру полезно знать размер ответа.

## 2. Публичный доступ на чтение

Для прямого воспроизведения в браузере файлы должны быть доступны по HTTP GET без авторизации.

**Вариант A: публичный bucket**

1. Object Storage → bucket → Права доступа.
2. Включите «Публичный доступ на чтение» для bucket или для нужных объектов.
3. Публичный URL: `https://storage.yandexcloud.net/BUCKET_NAME/OBJECT_KEY`

**Вариант B: приватный bucket + presigned URL**

Если bucket приватный, для воспроизведения нужны presigned GET-URL. Их можно генерировать на сервере (например, Cloudflare Worker или Vercel Function). Текущее приложение поддерживает только публичные или уже подписанные URL.

## 3. Форматы для видео

- **MP4** (H.264 + AAC) — поддерживается везде, желательно с `moov` атомом в начале для быстрого старта.
- **WebM** — также подходит.

Для seek и потоковой передачи важны HTTP Range-запросы; Yandex Object Storage их поддерживает.

## 4. Типичный сценарий

1. Загрузите файл в bucket (консоль, CLI, presigned PUT).
2. Скопируйте публичный URL: `https://storage.yandexcloud.net/bucket/path/file.jpg`
3. В приложении нажмите «По URL», вставьте ссылку.
4. Нажмите «Опубликовать» — ссылка на сферу скопируется в буфер.
