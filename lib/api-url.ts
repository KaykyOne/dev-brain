/** Prefixa caminhos de API com o basePath (o `fetch` do navegador não o aplica sozinho). */
export const apiUrl = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
