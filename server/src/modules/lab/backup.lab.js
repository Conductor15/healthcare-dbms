// Topic vi (Backup & recovery) experiments: backup history, on-demand backups, point-in-time restore demo.
// Same flow as demos/06-backup-recovery/mssql/03_point_in_time.sql.
import { config } from '../../config.js';
import { getLabPool, run, sleep } from './lab.db.js';

const DB = config.mssql.database;
const DIR = '/var/opt/mssql/backup';
const COPY = `${DB}_PITR`;

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

export async function listBackups(limit = 20) {
  const pool = await getLabPool();
  const { recordset } = await run(
    pool,
    `SELECT TOP (@limit) b.backup_set_id AS id,
            CASE b.type WHEN 'D' THEN 'FULL' WHEN 'I' THEN 'DIFF' WHEN 'L' THEN 'LOG' END AS type,
            b.backup_finish_date AS finishedAt, b.first_lsn AS firstLsn, b.last_lsn AS lastLsn,
            CAST(b.backup_size / 1048576.0 AS DECIMAL(10,2)) AS sizeMb,
            CAST(b.compressed_backup_size / 1048576.0 AS DECIMAL(10,2)) AS compressedMb,
            b.has_backup_checksums AS checksum, f.physical_device_name AS [file]
     FROM msdb.dbo.backupset b JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = b.media_set_id
     WHERE b.database_name = @db ORDER BY b.backup_set_id DESC`,
    { limit, db: DB },
  );
  return recordset;
}

/** @param {'FULL'|'DIFF'|'LOG'} type */
export async function takeBackup(type) {
  const pool = await getLabPool();
  const file = `${DIR}/${DB}_${type.toLowerCase()}_${stamp()}.${type === 'LOG' ? 'trn' : 'bak'}`;
  const statement =
    type === 'LOG'
      ? `BACKUP LOG [${DB}] TO DISK = @file WITH COMPRESSION, CHECKSUM`
      : `BACKUP DATABASE [${DB}] TO DISK = @file WITH ${type === 'DIFF' ? 'DIFFERENTIAL, ' : ''}COMPRESSION, CHECKSUM`;
  const start = performance.now();
  await run(pool, `EXEC master.dbo.xp_create_subdir N'${DIR}'; ${statement};`, { file });
  const ms = Math.round(performance.now() - start);
  const [latest] = await listBackups(1);
  return { ...latest, ms };
}

const prices = async (target, db = DB) =>
  (
    await run(
      target,
      `SELECT TOP (5) medicine_id AS id, name, unit_price AS price FROM [${db}].dbo.medicines ORDER BY medicine_id`,
    )
  ).recordset;

/**
 * Full backup → legit change → accident (all prices = 0) → log backup → restore a COPY with STOPAT
 * just before the accident → repair the live table from the copy → drop the copy.
 * Safety net: the original prices are kept in memory and written back if any step fails.
 */
export async function pointInTimeDemo() {
  const pool = await getLabPool();
  const steps = [];
  const step = async (label, fn) => {
    const start = performance.now();
    const detail = await fn();
    steps.push({ label, ms: Math.round(performance.now() - start), detail });
    return detail;
  };

  const original = (await run(pool, 'SELECT medicine_id, unit_price FROM dbo.medicines')).recordset;
  const restoreOriginal = () =>
    run(
      pool,
      `UPDATE m SET unit_price = j.unit_price FROM dbo.medicines m
       JOIN OPENJSON(@json) WITH (medicine_id INT, unit_price DECIMAL(12,2)) j ON j.medicine_id = m.medicine_id`,
      { json: JSON.stringify(original) },
    );

  let accidentHappened = false;
  try {
    await run(pool, `IF DB_ID(N'${COPY}') IS NOT NULL DROP DATABASE [${COPY}]`);
    const full = await step('0. Full backup', () => takeBackup('FULL'));
    await step('1. Thay đổi hợp lệ sau backup: Paracetamol 1500 → 1650', () =>
      run(pool, 'UPDATE dbo.medicines SET unit_price = 1650 WHERE medicine_id = 1'),
    );
    await sleep(1000);
    const stopAt = (await run(pool, 'SELECT CONVERT(NVARCHAR(23), SYSDATETIME(), 121) AS t')).recordset[0].t;
    await sleep(1000);
    accidentHappened = true;
    const damaged = await step('2. Sự cố: UPDATE dbo.medicines SET unit_price = 0 (quên WHERE)', async () => {
      await run(pool, 'UPDATE dbo.medicines SET unit_price = 0');
      return prices(pool);
    });
    const log = await step('3. Backup log (chứa cả sự cố)', () => takeBackup('LOG'));
    await step(`4. Restore bản sao ${COPY} với STOPAT = ${stopAt} (giờ máy chủ, UTC)`, () =>
      run(
        pool,
        `RESTORE DATABASE [${COPY}] FROM DISK = @full
           WITH MOVE '${DB}' TO '/var/opt/mssql/data/${COPY}.mdf',
                MOVE '${DB}_log' TO '/var/opt/mssql/data/${COPY}_log.ldf', NORECOVERY, REPLACE;
         -- STOPAT rejects NVARCHAR(MAX) (how the driver sends strings): convert to DATETIME first
         DECLARE @stop DATETIME = CONVERT(DATETIME, @stopAt, 121);
         RESTORE LOG [${COPY}] FROM DISK = @log WITH STOPAT = @stop, RECOVERY;`,
        { full: full.file, log: log.file, stopAt },
      ),
    );
    const restored = await step('5. Giá trong bản khôi phục', () => prices(pool, COPY));
    const repaired = await step('6. Sửa bảng live từ bản khôi phục', async () => {
      const r = await run(
        pool,
        `UPDATE live SET unit_price = r.unit_price
         FROM dbo.medicines live JOIN [${COPY}].dbo.medicines r ON r.medicine_id = live.medicine_id`,
      );
      return { rows: r.rowsAffected[0] };
    });
    accidentHappened = false;
    const final = await prices(pool);
    return { stopAt, steps, damaged, restored, repaired, final };
  } catch (err) {
    if (accidentHappened) await restoreOriginal(); // never leave the clinic with zero prices
    throw err;
  } finally {
    await run(pool, `IF DB_ID(N'${COPY}') IS NOT NULL DROP DATABASE [${COPY}]`).catch(() => {});
    const paracetamol = original.find((m) => m.medicine_id === 1);
    await run(pool, 'UPDATE dbo.medicines SET unit_price = @p WHERE medicine_id = 1', {
      p: paracetamol.unit_price,
    }).catch(() => {}); // undo the demo's "legit change" so the lab is repeatable
  }
}
