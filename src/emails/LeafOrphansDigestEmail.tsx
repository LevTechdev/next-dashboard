import { Text, Section, Heading, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface LeafOrphansDigestEmailProps {
  total: number;
  tables: string[];
  samples?: string[];
  dashboardUrl?: string;
  locale?: string;
}

/**
 * Ops digest: the leaf-sync mirror cannot take every local row.
 *
 * Mailed through the durable outbox by the `leaf-orphans-digest` scheduler job
 * when the projected orphan report still NAMES rows an operator has not
 * acknowledged ("Needs reconciliation"). Named rows are the actionable kind:
 * each sample fingerprints one concrete row to review (or retire via
 * `node scripts/ack-leaf-orphans.mjs '<ref>'`). The digest never fires for
 * the quieter verdicts — `warn` (nothing named anymore) has no per-row action
 * and `ok` needs no mail at all — so this mail arriving means there is a
 * decision waiting, not just a number moving.
 *
 * Copy is localized for the four supported locales, matching the rest of the
 * product: an operator who cannot read English must still recognize that the
 * mirror is incomplete.
 */
const COPY: Record<
  string,
  {
    preview: (total: number) => string;
    heading: string;
    line1: (total: number, tableCount: number) => string;
    line2: string;
    tableHeading: string;
    refsHeading: string;
    actionHeading: string;
    action: (cmd: string) => string;
    footer: string;
  }
> = {
  en: {
    preview: (t) => `${t} unsyncable rows need reconciliation`,
    heading: "Leaf-sync orphans need reconciliation",
    line1: (t, tables) =>
      `The Supabase mirror is missing ${t} local row${t === 1 ? "" : "s"} across ${tables} table${tables === 1 ? "" : "s"} — their FK targets exist only in local dev data, so the nightly sync can never copy them.`,
    line2:
      "These rows are named below. Reconcile each one by hand, or acknowledge it as a dev-fixture artifact so it retires from the report.",
    tableHeading: "Affected tables",
    refsHeading: "Named rows",
    actionHeading: "Next step",
    action: (cmd) => `node ${cmd} '<ref>' — then Run sync to see the tally retire.`,
    footer:
      "Acknowledgement never edits the rows: SecurityEvent is hash-chained, so orphans are retired from the report, never rewritten. This digest sends once per day while named rows remain.",
  },
  id: {
    preview: (t) => `${t} baris yang tidak dapat disinkronkan perlu rekonsiliasi`,
    heading: "Orphan leaf-sync perlu rekonsiliasi",
    line1: (t, tables) =>
      `Mirror Supabase kehilangan ${t} baris lokal di ${tables} tabel — target FK-nya hanya ada di data dev lokal, sehingga sinkronisasi tidak pernah bisa menyalinnya.`,
    line2:
      "Baris-baris ini tercantum di bawah. Rekonsiliasi satu per satu secara manual, atau akui sebagai artefak fixture dev agar pensiun dari laporan.",
    tableHeading: "Tabel yang terdampak",
    refsHeading: "Baris yang tercantum",
    actionHeading: "Langkah berikutnya",
    action: (cmd) => `node ${cmd} '<ref>' — lalu Run sync untuk melihat hitungan berkurang.`,
    footer:
      "Pengakuan tidak pernah mengubah baris: SecurityEvent di-hash berantai, jadi orphan dipensiunkan dari laporan, tidak pernah ditulis ulang. Digest ini dikirim sekali per hari selama masih ada baris yang tercantum.",
  },
  ja: {
    preview: (t) => `同期できない${t}行の整理が必要です`,
    heading: "leaf-sync の orphan の整理が必要です",
    line1: (t, tables) =>
      `Supabase ミラーでは ${tables} テーブル計 ${t} 行のローカルデータが欠落しています — FK の参照先がローカルの開発データにしか存在せず、夜間同期では決してコピーされません。`,
    line2:
      "対象の行は以下に列挙されています。手動で整理するか、開発フィクスチャの残骸として承認し、レポートから退避させてください。",
    tableHeading: "影響のあるテーブル",
    refsHeading: "対象の行",
    actionHeading: "次のステップ",
    action: (cmd) => `node ${cmd} '<ref>' — その後「同期を実行」で減少を確認できます。`,
    footer:
      "承認は行を決して書き換えません: SecurityEvent はハッシュチェーンで保たれているため、orphan はレポートから退避されるだけで、行自体は変更されません。このダイジェストは対象の行が残っている間、1 日 1 回送信されます。",
  },
  zh: {
    preview: (t) => `${t} 行无法同步，需要对账`,
    heading: "leaf-sync 孤儿行需要对账",
    line1: (t, tables) =>
      `Supabase 镜像缺少 ${tables} 张表共 ${t} 行本地数据——其外键目标仅存在于本地开发数据中，夜间同步永远无法复制它们。`,
    line2: "这些行已在下方列出。请逐一手动对账，或确认其为开发测试数据残留，使其从报告中退出。",
    tableHeading: "受影响的表",
    refsHeading: "已列出的行",
    actionHeading: "下一步",
    action: (cmd) => `node ${cmd} '<ref>' — 然后执行“Run sync”查看计数下降。`,
    footer:
      "确认绝不会改写行：SecurityEvent 受哈希链保护，孤儿行只会从报告中退出，绝不会被重写。只要仍有已列出的行，此摘要每天至多发送一封。",
  },
};

export default function LeafOrphansDigestEmail({
  total = 0,
  tables = [],
  samples = [],
  dashboardUrl = "https://example.com/admin",
  locale = "en",
}: LeafOrphansDigestEmailProps) {
  const c = COPY[locale] ?? COPY.en;
  return (
    <EmailLayout previewText={c.preview(total)}>
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        {c.heading}
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        {c.line1(total, tables.length)}
      </Text>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">{c.line2}</Text>
      {tables.length > 0 && (
        <>
          <Heading as="h3" className="text-zinc-900 text-[16px] font-semibold mt-[24px] mb-[8px]">
            {c.tableHeading}
          </Heading>
          {tables.map((line) => (
            <Text key={line} className="text-zinc-700 text-[13px] leading-[20px] m-[2px]">
              • {line}
            </Text>
          ))}
        </>
      )}
      {samples.length > 0 && (
        <>
          <Heading as="h3" className="text-zinc-900 text-[16px] font-semibold mt-[20px] mb-[8px]">
            {c.refsHeading}
          </Heading>
          {samples.map((s) => (
            <Text
              key={s}
              className="text-zinc-500 font-mono text-[11px] leading-[18px] m-[2px] break-all"
            >
              {s}
            </Text>
          ))}
        </>
      )}
      <Hr className="border-zinc-200 my-[24px]" />
      <Heading as="h3" className="text-zinc-900 text-[16px] font-semibold mt-[8px] mb-[8px]">
        {c.actionHeading}
      </Heading>
      <Section className="mb-[24px]">
        <Text className="bg-zinc-100 rounded-lg text-zinc-700 font-mono text-[12px] leading-[20px] px-[12px] py-[8px]">
          {c.action("scripts/ack-leaf-orphans.mjs")}
        </Text>
      </Section>
      <Text className="text-zinc-500 text-[13px] leading-[20px]">{dashboardUrl}</Text>
      <Hr className="border-zinc-200 my-[24px]" />
      <Text className="text-zinc-500 text-[14px] leading-[24px]">{c.footer}</Text>
    </EmailLayout>
  );
}
