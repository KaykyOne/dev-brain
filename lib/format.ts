const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

/** Aceita `Date` ou data ISO (ex.: a data de um commit vinda do git). */
export const formatDateTime = (value: Date | string) => dateTime.format(new Date(value));

/** Hash curto de um commit, como o git exibe. */
export const shortSha = (sha: string) => sha.slice(0, 7);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** Dia civil (AAAA-MM-DD) no fuso do app: agrupa commits e alimenta gráficos. */
export const dayKey = (value: Date | string) => dayFormat.format(new Date(value));

const longDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: TIME_ZONE });
export const formatLongDay = (value: Date | string) => longDay.format(new Date(value));

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 3 horas", "ontem"... (para listas; o horário exato fica no `title`). */
export function formatRelative(value: Date | string, now = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "agora";
}
