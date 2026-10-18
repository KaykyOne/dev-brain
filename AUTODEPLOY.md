---
name: autodeploy
description: Como publicar este projeto na VPS com a CLI autodeploy (deploy incremental via SSH, com releases e rollback). Use quando o usuário pedir deploy, restart, rollback, logs ou status da aplicação em produção.
---

# Deploy com AutoDeploy

Este projeto é publicado na VPS pela CLI `autodeploy`, configurada em `deploy.config.json` (na raiz, **não versionado**).

- **Projeto:** `gulosos-ai`
- **Runtime:** Docker Compose
- **Servidor:** servidor salvo `vps` (`~/.autodeploy/servers.json`)
- **Pasta na VPS:** `/opt/apps/gulosos-ai` (a menos que `remotePath` esteja no config)

## Comandos

Rode sempre a partir da raiz do projeto.

| Comando | O que faz |
| --- | --- |
| `autodeploy deploy --dry-run` | Mostra arquivos novos/modificados/removidos. **Não altera nada.** Rode antes do deploy real. |
| `autodeploy deploy --yes` | Deploy real, sem perguntas (use em automação/IA). |
| `autodeploy status` | Release ativa, estado do compose e health check. |
| `autodeploy logs [-f] [--tail 200]` | Logs da aplicação na VPS. |
| `autodeploy restart` | Reinicia a release ativa, sem enviar arquivos. |
| `autodeploy releases` | Lista as releases (● = ativa). |
| `autodeploy rollback [id]` | Volta para a release anterior (ou a indicada). |
| `autodeploy doctor` | Confere SSH, Docker/Compose, permissões e `.env` na VPS. |
| `autodeploy unlock` | Libera o lock de um deploy interrompido. Só use se nenhum deploy estiver rodando. |

## Como o deploy funciona

1. Compara os arquivos locais (SHA-256) com o manifest da release ativa.
2. Cria `releases/<data-hora>` na VPS como cópia da release ativa e envia só o que mudou.
3. Valida o Compose e o `.env`, aponta `current` para a nova release e reinicia.
4. Roda o health check. **Se reiniciar ou o health check falhar, volta sozinho para a release anterior.**
5. Releases antigas são apagadas (mantém as últimas 5).

Sem alterações locais, nenhuma release é criada.

## Regras para a IA

- **Sempre** rode `autodeploy deploy --dry-run` primeiro e mostre o resumo ao usuário antes do deploy real, salvo se ele pedir para ir direto.
- **Nunca** edite arquivos dentro de `releases/` ou `current/` na VPS: a próxima release os sobrescreve.
- **Nunca** versione nem imprima `deploy.config.json` ou `.env`: contêm host e segredos.
- O `.env` de produção vive **somente na VPS** (fora das releases). O primeiro deploy o cria a partir do `.env` local; depois a VPS é a fonte da verdade. Para sobrescrevê-lo com o local, use `autodeploy deploy --include-env` (confirme com o usuário).
- Dados que a aplicação grava em tempo de execução (banco em arquivo, uploads, sessões) devem ficar em `persistentPaths` no config, senão são copiados a cada release.
- Se o deploy disser "Outro deploy está em andamento", **não** rode `unlock` sem confirmar que não há deploy ativo.
- Se o deploy falhar e voltar sozinho ("rollback foi concluído"), investigue com `autodeploy logs` antes de tentar de novo.

## Problemas comuns

| Sintoma | Causa provável / solução |
| --- | --- |
| `Permission denied` ao copiar a release | Um container gravou como root numa pasta. Acrescente o nome dela em `persistentPaths`. |
| Health check falha após deploy | Veja `autodeploy logs`; confira a URL/porta em `health.url` (é testada **dentro da VPS**). |
| `Chave SSH não encontrada` | Defina `privateKey` no config ou no servidor salvo, ou crie `~/.ssh/id_ed25519`. |
| `Chave desconhecida "..."` no início | Typo no `deploy.config.json`; a mensagem sugere o nome certo. |
| Variável faltando no Docker | O deploy valida `docker.requiredEnv` contra o `.env` da VPS antes de ativar a release. |

## Configuração mínima

```json
{
  "name": "gulosos-ai",
  "server": "vps",
  "runtime": "docker",
  "persistentPaths": "auto",
  "docker": {
    "envFile": true,
    "requiredEnv": "auto"
  }
}
```

Padrões quando omitidos: `remotePath` = `/opt/apps/<name>`, `port` = 22, `localPath` = `.`, `releases.keep` = 5, `privateKey` = `~/.ssh/id_ed25519` ou `id_rsa`.
