"use client";

import { useEffect, useState } from "react";
import { BsCoin } from "react-icons/bs";
import {
  MdOutlineAdsClick,
  MdOutlinePeopleAlt,
  MdOutlineRemoveRedEye,
  MdOutlineShowChart,
  MdOutlineTableChart,
  MdOutlineOpenInNew,
} from "react-icons/md";
import {
  PARTNER_REPORT_RANGES,
  PartnerReportNotFoundError,
  fetchPartnerReport,
  partnerCtr,
  totalPartnerClicks,
  type PartnerReport,
  type PartnerReportRange,
} from "@/lib/partnerReport";
import {
  FunnelChart,
  SplitBar,
  StatTile,
  TimeSeriesChart,
  bucketFullLabel,
  formatCount,
} from "./charts";

// How often the numbers refresh. The same interval the admin panel polls at —
// the promise this page makes is "em tempo real", and five seconds is what
// that means to someone watching a campaign go out.
const POLL_INTERVAL_MS = 5000;

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function relativeSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return "agora mesmo";
  if (seconds < 60) return `há ${seconds}s`;
  return `há ${Math.round(seconds / 60)}min`;
}

export function PartnerReportClient({ token }: { token: string }) {
  const [range, setRange] = useState<PartnerReportRange>("24h");
  // undefined = the first load hasn't landed yet. A failed *poll* deliberately
  // keeps the last report on screen (see the effect below): a blank page is a
  // worse answer to a dropped packet than numbers five seconds old.
  const [report, setReport] = useState<PartnerReport | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [showTable, setShowTable] = useState(false);
  // Re-rendered once a second purely so the "atualizado há Xs" line stays
  // honest between polls.
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await fetchPartnerReport(token, range, controller.signal);
        if (cancelled) return;
        setReport(data);
        setUpdatedAt(Date.now());
        setError(null);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        if (err instanceof PartnerReportNotFoundError) {
          setNotFound(true);
          return;
        }
        // Transient — say so in the corner and keep the last numbers up.
        setError("Sem conexão com o servidor. Tentando de novo...");
      }
    }

    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [token, range]);

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-md grow flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Link inválido</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Esse relatório não existe mais — o anúncio pode ter sido removido, ou o link foi digitado
          errado. Peça um novo link para quem te enviou esse.
        </p>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto flex w-full max-w-md grow flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent dark:border-zinc-700 dark:border-t-transparent" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando o relatório...</p>
      </main>
    );
  }

  const { ad, stats, history } = report;
  const clicks = totalPartnerClicks(stats);
  const ctr = partnerCtr(stats);
  const hasVideoReward = Boolean(ad.rewardVideoUrl && ad.rewardPoints);
  const hasClickReward = Boolean(ad.clickRewardPoints);

  return (
    // Every colour the charts use is declared here, once, for both themes —
    // see charts.tsx, which reads these and hardcodes no hex of its own.
    <main className="report-viz mx-auto w-full max-w-5xl grow px-4 py-6 sm:px-6">
      <style>{`
        .report-viz {
          --surface: #ffffff;
          --hairline: #e4e4e7;
          --track: #f0efec;
          --grid: #ececea;
          --ink-1: #09090b;
          --ink-2: #52525b;
          --ink-3: #a1a1aa;
          --series-1: #2a78d6;
          --series-2: #eb6834;
          --series-3: #1baf7a;
          --ordinal-1: #1c5cab;
          --ordinal-2: #2a78d6;
          --ordinal-3: #5598e7;
        }
        [data-theme="dark"] .report-viz {
          --surface: #0c0c0e;
          --hairline: #27272a;
          --track: #26262a;
          --grid: #242428;
          --ink-1: #fafafa;
          --ink-2: #a1a1aa;
          --ink-3: #71717a;
          --series-1: #3987e5;
          --series-2: #d95926;
          --series-3: #199e70;
          --ordinal-1: #86b6ef;
          --ordinal-2: #5598e7;
          --ordinal-3: #2a78d6;
        }
      `}</style>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            Relatório do anúncio
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
            {ad.title}
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            No ar desde {dateTimeFormat.format(ad.createdAt)}
            {ad.expiresAt
              ? ` · ${ad.active ? "expira" : "expirou"} em ${dateTimeFormat.format(ad.expiresAt)}`
              : " · sem data para acabar"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {ad.active ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              No ar agora
            </span>
          ) : (
            <span className="rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Campanha encerrada
            </span>
          )}
          <span className="text-[11px] text-[var(--ink-3)]">
            {error ?? `Atualizado ${relativeSeconds(Math.max(0, now - updatedAt))}`}
          </span>
        </div>
      </header>

      {/* ── Números principais ────────────────────────────────────────── */}
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Impressões"
          icon={<MdOutlineRemoveRedEye />}
          accent="--series-1"
          value={formatCount(stats.views)}
          hint="Cada vez que o anúncio apareceu para alguém"
        />
        <StatTile
          label="Pessoas alcançadas"
          icon={<MdOutlinePeopleAlt />}
          accent="--series-3"
          value={formatCount(stats.uniqueViews)}
          hint="Gente diferente que viu o anúncio pelo menos uma vez"
        />
        <StatTile
          label="Cliques"
          icon={<MdOutlineAdsClick />}
          accent="--series-2"
          value={formatCount(clicks)}
          hint="Cliques no botão, no card e dentro do vídeo somados"
        />
        <StatTile
          label="Taxa de clique"
          icon={<MdOutlineShowChart />}
          value={ctr === null ? "—" : `${ctr.toFixed(1)}%`}
          hint="Dos que foram alcançados, quantos clicaram"
        />
      </section>

      {/* ── Ao longo do tempo ─────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--ink-1)]">Ao longo do tempo</h2>
          <div className="flex gap-1 rounded-lg bg-[var(--track)] p-0.5">
            {PARTNER_REPORT_RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  range === option.value
                    ? "bg-[var(--surface)] text-[var(--ink-1)] shadow-sm"
                    : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duas escalas diferentes, dois gráficos: nunca dois eixos no mesmo. */}
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <TimeSeriesChart
            buckets={history.buckets}
            step={history.step}
            emptyLabel="Nenhuma impressão nesse período"
            series={{ label: "Impressões", color: "--series-1", valueOf: (b) => b.views }}
          />
          <TimeSeriesChart
            buckets={history.buckets}
            step={history.step}
            emptyLabel="Nenhum clique nesse período"
            series={{
              label: "Cliques",
              color: "--series-2",
              valueOf: (b) => b.clicks + b.clicksByVideo,
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink-1)]"
        >
          <MdOutlineTableChart className="h-3.5 w-3.5" />
          {showTable ? "Esconder os números" : "Ver os números em tabela"}
        </button>

        {showTable && (
          <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-[var(--hairline)]">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="sticky top-0 bg-[var(--surface)] text-[var(--ink-3)]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {history.step === "hour" ? "Hora" : "Dia"}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Impressões
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Cliques
                  </th>
                </tr>
              </thead>
              <tbody className="text-[var(--ink-1)]">
                {[...history.buckets].reverse().map((bucket) => (
                  <tr key={bucket.t} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-1.5 whitespace-nowrap text-[var(--ink-2)]">
                      {bucketFullLabel(bucket.t, history.step)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatCount(bucket.views)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatCount(bucket.clicks + bucket.clicksByVideo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Detalhe + preview ─────────────────────────────────────────── */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--ink-1)]">De onde vieram os cliques</h2>
            <p className="mt-0.5 mb-3 text-xs text-[var(--ink-3)]">
              O mesmo botão aparece no card da sala e dentro do popup do vídeo. São dois cliques
              diferentes de gente em situações diferentes, então ficam separados.
            </p>
            <SplitBar
              parts={[
                { label: "No card", value: stats.clicks, color: "--series-2" },
                { label: "No vídeo", value: stats.clicksByVideo, color: "--series-3" },
              ]}
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--hairline)] pt-3 text-xs">
              <div>
                <dt className="text-[var(--ink-3)]">Sessões alcançadas</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--ink-1)]">
                  {formatCount(stats.sessionViews)}
                </dd>
                <p className="text-[10px] leading-snug text-[var(--ink-3)]">
                  Uma por aba aberta — entre as impressões e as pessoas
                </p>
              </div>
              <div>
                <dt className="text-[var(--ink-3)]">Minimizações</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--ink-1)]">
                  {formatCount(stats.minimizes)}
                </dd>
                <p className="text-[10px] leading-snug text-[var(--ink-3)]">
                  Vezes que alguém recolheu a barra lateral com o anúncio aberto
                </p>
              </div>
            </dl>
          </div>

          {(hasVideoReward || hasClickReward) && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-1)]">
                <BsCoin className="h-3.5 w-3.5 text-amber-500" />
                Recompensas
              </h2>
              {hasVideoReward && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-[var(--ink-3)]">
                    Quem assiste o vídeo inteiro ganha {formatCount(ad.rewardPoints ?? 0)} pontos.
                  </p>
                  <FunnelChart
                    stages={[
                      { label: "Abriram o vídeo", value: stats.rewardVideoOpens },
                      { label: "Assistiram até o fim", value: stats.rewardVideoCompletions },
                      {
                        label: "Resgataram os pontos",
                        value: stats.rewardClaims,
                        hint: "Contas diferentes — ninguém resgata duas vezes",
                      },
                    ]}
                  />
                </div>
              )}
              {hasClickReward && (
                <p className="mt-3 border-t border-[var(--hairline)] pt-3 text-xs text-[var(--ink-2)]">
                  <strong className="text-base font-semibold tabular-nums text-[var(--ink-1)]">
                    {formatCount(stats.clickRewardClaims)}
                  </strong>{" "}
                  contas resgataram os {formatCount(ad.clickRewardPoints ?? 0)} pontos por clicar no
                  botão.
                </p>
              )}
            </div>
          )}
        </div>

        {/* O anúncio como as pessoas realmente veem — a mesma marcação do card
            na barra lateral, para o relatório não descrever um anúncio que o
            leitor nunca viu. */}
        <div className="lg:w-72">
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--ink-1)]">Como ele aparece</h2>
            <div
              className="mt-3 overflow-hidden rounded-xl p-4"
              style={{
                backgroundColor: ad.backgroundColor ?? "#111827",
                color: ad.textColor ?? "#f4f4f5",
              }}
            >
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70 dark:bg-white/10">
                Patrocinado
              </span>
              {ad.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.imageUrl}
                  alt=""
                  className="mt-2 max-h-32 w-full rounded-lg object-cover"
                />
              )}
              <p className="mt-2 text-sm font-semibold">{ad.title}</p>
              <p className="mt-1 whitespace-pre-line text-xs opacity-80">{ad.description}</p>
              <div
                className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold"
                style={{
                  backgroundColor: ad.buttonBackgroundColor ?? "#10b981",
                  color: ad.buttonTextColor ?? "#ffffff",
                }}
              >
                {ad.buttonLabel}
              </div>
            </div>
            <a
              href={ad.buttonUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-3 flex items-center gap-1 text-xs text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink-1)]"
            >
              <MdOutlineOpenInNew className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ad.buttonUrl}</span>
            </a>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-3)]">
        Os números são atualizados sozinhos a cada {POLL_INTERVAL_MS / 1000} segundos, direto do
        servidor do GoLive. Qualquer pessoa com esse link vê essa página — ela não dá acesso a mais
        nada da conta nem a outros anúncios.
      </p>
    </main>
  );
}
