import { History, LoaderCircle } from 'lucide-react'
import type { LegacyMigrationStatus } from '../types'

type LegacyMigrationControlProps = {
  status: LegacyMigrationStatus | null
  running: boolean
  onRun(): void
}

export function LegacyMigrationControl({ status, running, onRun }: LegacyMigrationControlProps) {
  const description = status?.needsBrowserStorageRepair
    ? 'Restore the previous local characters, projects, and workspace state. This replaces Oyama browser-backed workspace data, then requires a restart.'
    : status?.migrated
      ? 'The previous MiniMax Studio profile was imported. Run this again only to collect files added to the old app after the first import.'
      : status?.available
        ? '将您之前的 MiniMax Studio 配置导入 Oyama。现有的 Oyama 数据不会被覆盖。'
        : '未在此计算机上找到之前的 MiniMax Studio 配置文件。'

  return <div className="legacy-migration-settings">
    <div>
      <strong>Previous Studio data</strong>
      <small>{description}</small>
      {status?.repairError && <p className="settings-note warning" role="alert">The last restore could not finish: {status.repairError}. Close other Oyama windows before retrying. Your previous profile remains in place.</p>}
    </div>
    <button type="button" className="secondary-button" disabled={!status?.available || running} onClick={onRun}>
      {running ? <LoaderCircle className="spin" size={15} /> : <History size={15} />}
      {running ? 'Importing…' : status?.needsBrowserStorageRepair ? '恢复项目与角色' : status?.migrated ? '重新导入缺失数据' : '导入之前的数据'}
    </button>
  </div>
}
