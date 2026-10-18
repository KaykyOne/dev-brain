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
