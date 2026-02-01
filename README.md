# VK Representative

Сервис синхронизирует стену VK через официальный API, сохраняет посты в SQLite и показывает их на веб-странице.

## Возможности

- Синхронизация последних N постов со стены VK через `wall.get`.
- Сохранение в SQLite и отображение только данных из БД.
- Скачивание фотографий из attachments и выдача через локальный `/uploads`.
- Планировщик (cron) и ручной запуск `/admin/sync` с API key.
- Простая лента карточек с текстом и галереей.

## Требования

- Docker + docker-compose
- Валидный VK access token

## Как получить VK access token легально

1. Зарегистрируйте приложение в VK: <https://vk.com/apps?act=manage>.
2. Создайте **Standalone** приложение.
3. Сгенерируйте access token через официальную OAuth форму:
   - Документация: <https://dev.vk.com/api/access-token/implicit-flow-user>
   - Scope права: `wall`, `photos`, `offline` (для долговременного токена).
4. Убедитесь, что токен принадлежит пользователю с доступом к стене владельца.

## Настройка

1. Скопируйте `.env.example` в `.env` и заполните значения.
2. Запустите сервис:

```bash
docker-compose up --build
```

## Проверка синхронизации

Ручной запуск (API key передаётся в заголовке):

```bash
curl -X POST http://localhost:3000/admin/sync \
  -H "x-api-key: YOUR_ADMIN_API_KEY"
```

Логи синхронизации появятся в контейнере `backend`.

## Просмотр ленты

Откройте <http://localhost:3000> и убедитесь, что посты отображаются.

## API

- `GET /api/posts?limit=&offset=` — список постов с массивом изображений.
- `POST /admin/sync` — запуск синхронизации (защищено API key).

## Переменные окружения

| Переменная | Описание |
| --- | --- |
| `VK_TOKEN` | Access token VK |
| `VK_API_VERSION` | Версия VK API |
| `OWNER_ID` | ID владельца стены |
| `SYNC_LIMIT` | Сколько постов синхронизировать |
| `ADMIN_API_KEY` | API key для `/admin/sync` |
| `SYNC_CRON` | Cron-выражение для планировщика |
| `PORT` | Порт backend |
| `DATA_DIR` | Путь для БД и изображений |

## Что нужно для production

- Перейти на Postgres вместо SQLite.
- Хранить картинки в S3/MinIO и отдавать через CDN.
- Настроить миграции (например, Prisma, Knex, Flyway).
- Добавить мониторинг/логирование (Prometheus, Grafana, Sentry).
- Настроить лимиты и ретраи для VK API.
