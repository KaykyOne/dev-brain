export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { ensureAdminUser } = await import("./lib/auth/bootstrap");
    await ensureAdminUser();
  } catch (error) {
    // Não derruba o servidor (ex.: migrations ainda não aplicadas), mas deixa o motivo no log.
    console.error("[bootstrap] não foi possível garantir o usuário inicial:", error);
  }
}
