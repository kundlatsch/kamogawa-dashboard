#!/bin/sh
# Container entrypoint for the backend image (used by the `backend` and `scheduler` services).
#
# With RUN_STARTUP_TASKS=true (the default) it prepares the app before starting it:
#   1. apply database migrations (additive, they keep existing data)
#   2. collect static files for the Django admin (served by whitenoise)
#   3. create the initial account admin from ADMIN_USERNAME / ADMIN_PASSWORD if missing
# Then it hands over to the container command (gunicorn by default).
#
# Only one service should run the startup tasks: the scheduler sets RUN_STARTUP_TASKS=false
# and waits for the backend to be healthy instead. The dev compose file disables them too,
# because its commands already migrate and the dev server does not need collected static files.
set -e

if [ "${RUN_STARTUP_TASKS:-true}" = "true" ]; then
  echo "entrypoint: applying migrations"
  python manage.py migrate --noinput
  echo "entrypoint: collecting static files"
  python manage.py collectstatic --noinput --verbosity 0
  echo "entrypoint: ensuring the account admin exists"
  python manage.py ensure_admin
fi

exec "$@"
