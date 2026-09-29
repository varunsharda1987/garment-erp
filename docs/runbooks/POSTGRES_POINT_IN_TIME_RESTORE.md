# Postgres point-in-time restore (garment_erp)

Written 2026-09-29, after a Claude session wiped the live database and a whole day's work was lost.

## What protects the database

| Layer | Where | How much can be lost |
|---|---|---|
| Change-log archive (WAL) | `F:\pg-wal-archive` — Postgres copies every change-log file there (at least every 5 min) | about 5 minutes; nothing, if the server is still running (step 1) |
| Weekly base backup | `F:\pg-base-backups\<date>` — Sunday 02:30, newest 2 kept (`scripts/pg-base-backup.ps1`) | needed with the archive |
| Hourly dump | `F:\garment-erp-hourly-backups` + NAS `…\garment-erp\hourly`, 48 h (`scripts/backup-hourly.ps1`) | up to 1 hour |
| Nightly dump | `F:\Relocated-from-C\garment-erp-backups\database` + NAS + Google Drive, 19:00 | up to 1 day |

Turned on once by `scripts/pg-enable-wal-archive.ps1` (run as administrator). The hourly backup log
(`F:\garment-erp-hourly-backups\backup-hourly.log`) prints a WARNING if archiving stops.

**The base backup and the archive cover the WHOLE Postgres server** (every business on this PC). The
steps below rebuild it in a SIDE server on port 5433, take `garment_erp` out of it, and put only that
database back. The live server and the other businesses are not touched until the last step.

## When to use which

- **Wrong data from a known moment** (wipe, bad script, bad bulk edit) and you want everything up to just
  before it → **point-in-time restore** (below).
- Anything simpler → restore the newest hourly dump (steps 7–9 only, with that dump file).

## Point-in-time restore

Run in PowerShell. `$env:PGPASSWORD = 'postgres'` first; `$bin = 'C:\Program Files\PostgreSQL\16\bin'`.

1. **Push the latest changes into the archive** (only if the live server is still running):
   `& "$bin\psql.exe" -U postgres -h localhost -c "select pg_switch_wal()"`
2. **Choose the moment** to restore to — a little BEFORE the damage, with the time zone, e.g.
   `2026-09-29 17:07:00+05:30`. The API log or the audit log shows when the damage happened.
3. **Unpack the newest base backup taken BEFORE that moment** into a work folder:
   ```powershell
   $work = 'F:\pg-restore-work\data'
   New-Item -ItemType Directory -Force $work, "$work\pg_wal" | Out-Null
   tar -xzf F:\pg-base-backups\<date>\base.tar.gz -C $work
   tar -xzf F:\pg-base-backups\<date>\pg_wal.tar.gz -C "$work\pg_wal"
   ```
4. **Tell it to recover to that moment on port 5433** — append to `$work\postgresql.auto.conf`:
   ```
   port = 5433
   archive_mode = 'off'
   restore_command = 'copy "F:\\pg-wal-archive\\%f" "%p"'
   recovery_target_time = '2026-09-29 17:07:00+05:30'
   recovery_target_action = 'promote'
   ```
   and create an empty file `$work\recovery.signal`.
5. **Start the side server**: `& "$bin\pg_ctl.exe" -D $work -l F:\pg-restore-work\recovery.log start`.
   Wait until `recovery.log` says `database system is ready to accept connections` (it replays every
   change-log file since the base backup — minutes).
6. **Take garment_erp out of it**, then stop the side server:
   ```powershell
   & "$bin\pg_dump.exe" -U postgres -h localhost -p 5433 -d garment_erp -F c -f F:\pg-restore-work\garment_erp_pitr.dump
   & "$bin\pg_ctl.exe" -D $work stop
   ```
7. **Restore into a NEW database and check it** — never over the live one:
   ```powershell
   & "$bin\createdb.exe" -U postgres -h localhost garment_erp_restore
   & "$bin\pg_restore.exe" -U postgres -h localhost -d garment_erp_restore --no-owner F:\pg-restore-work\garment_erp_pitr.dump
   & "$bin\psql.exe" -U postgres -h localhost -d garment_erp_restore -c "select count(*) from styles"
   ```
   Check a few records you know were entered just before the moment.
8. **Swap it in** (garment-erp only — the other businesses keep running):
   - `npm run ship -- pause "DB restore"` → wait for `npm run ship:status` to show no deploy running
   - `pm2 stop garment-erp-api`
   - `psql -d postgres -c "ALTER DATABASE garment_erp RENAME TO garment_erp_broken_<date>" -c "ALTER DATABASE garment_erp_restore RENAME TO garment_erp"`
   - `cd backend; npx prisma migrate deploy` (only applies migrations newer than the restored copy)
   - `pm2 start garment-erp-api` → `npm run ship -- resume`
9. Keep the broken copy until the team confirms nothing is missing, then drop it. Delete `F:\pg-restore-work`.

## Never

- Never point a Prisma command that takes `--shadow-database-url` (or `migrate dev` / `migrate reset` /
  `db push`) at the live `DATABASE_URL`: Prisma empties that database. This is how the 2026-09-29 wipe happened.
- Never restore over the live database in place (`pg_restore --clean` into `garment_erp`): restore into a
  new database, check it, then rename.
- Never delete files from `F:\pg-wal-archive` by hand — the weekly script removes only what no base backup needs.
