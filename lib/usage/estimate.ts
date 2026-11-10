/**
 * Estimativas de uso do MCP. Puro: sem banco nem git, para ser testado isoladamente.
 *
 * O MCP não recebe o consumo real do agente, então tudo aqui é aproximado:
 * - tokens ≈ caracteres / 4 (média de texto e Markdown; em português costuma ficar um pouco acima);
 * - uma sessão é uma sequência de chamadas da mesma chave ao mesmo projeto sem pausa maior que SESSION_GAP_MS;
 * - a alternativa comparada é carregar o contexto inteiro (repositório + skills) em toda sessão, como num
 *   CLAUDE.md único. Economia = contexto inteiro − o que o agente de fato recebeu, nunca negativa.
 */

export const CHARS_PER_TOKEN = 4;
export const SESSION_GAP_MS = 30 * 60 * 1000;

export const estimateTokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

export type UsageCall = {
  projectId: string | null;
  tokenId: string | null;
  responseChars: number;
  createdAt: Date;
};

export type UsageTotals = {
  sessions: number;
  calls: number;
  /** Tokens que o MCP entregou ao agente. */
  deliveredTokens: number;
  /** Tokens que o agente receberia carregando o contexto inteiro a cada sessão. */
  fullContextTokens: number;
  savedTokens: number;
  /** Fração economizada (0 a 1) sobre o contexto inteiro; null sem sessões. */
  savedRatio: number | null;
};

const emptyTotals = (): UsageTotals => ({
  sessions: 0,
  calls: 0,
  deliveredTokens: 0,
  fullContextTokens: 0,
  savedTokens: 0,
  savedRatio: null,
});

/** Agrupa as chamadas em sessões (por chave e projeto) e soma os caracteres de cada uma. */
export function groupSessions(calls: UsageCall[], gapMs = SESSION_GAP_MS) {
  const sorted = [...calls].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const open = new Map<string, { projectId: string | null; chars: number; calls: number; last: number }>();
  const sessions: { projectId: string | null; chars: number; calls: number }[] = [];

  for (const call of sorted) {
    const key = `${call.tokenId ?? "-"}:${call.projectId ?? "-"}`;
    const time = call.createdAt.getTime();
    const current = open.get(key);

    if (current && time - current.last <= gapMs) {
      current.chars += call.responseChars;
      current.calls += 1;
      current.last = time;
      continue;
    }

    const session = { projectId: call.projectId, chars: call.responseChars, calls: 1, last: time };
    open.set(key, session);
    sessions.push(session);
  }

  return sessions.map(({ projectId, chars, calls }) => ({ projectId, chars, calls }));
}

/**
 * Totais por projeto e gerais. `fullContextChars` é o tamanho do contexto inteiro de cada projeto.
 * Chamadas sem projeto (ferramentas do hub) contam como entregues, mas não entram na comparação.
 */
export function summarizeUsage(calls: UsageCall[], fullContextChars: Map<string, number>, gapMs = SESSION_GAP_MS) {
  const byProject = new Map<string, UsageTotals>();
  const overall = emptyTotals();

  for (const session of groupSessions(calls, gapMs)) {
    const delivered = estimateTokens(session.chars);
    overall.calls += session.calls;
    overall.deliveredTokens += delivered;

    const full = session.projectId ? fullContextChars.get(session.projectId) : undefined;
    if (!session.projectId || full === undefined) continue;

    const fullTokens = estimateTokens(full);
    const saved = Math.max(0, fullTokens - delivered);
    const totals = byProject.get(session.projectId) ?? emptyTotals();
    totals.sessions += 1;
    totals.calls += session.calls;
    totals.deliveredTokens += delivered;
    totals.fullContextTokens += fullTokens;
    totals.savedTokens += saved;
    byProject.set(session.projectId, totals);

    overall.sessions += 1;
    overall.fullContextTokens += fullTokens;
    overall.savedTokens += saved;
  }

  const withRatio = (totals: UsageTotals): UsageTotals => ({
    ...totals,
    savedRatio: totals.fullContextTokens > 0 ? totals.savedTokens / totals.fullContextTokens : null,
  });

  return {
    overall: withRatio(overall),
    byProject: new Map([...byProject].map(([id, totals]) => [id, withRatio(totals)])),
  };
}
