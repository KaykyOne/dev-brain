const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: TIME_ZONE });

export const formatDateTime = (value: Date) => dateTime.format(value);
export const formatDate = (value: Date) => date.format(value);
