# GrandChase Classic - Management Agent

Agente intent-based que consome o MCP server de gestão GrandChase via protocolo A2A (Agent-to-Agent).

## Características

✅ **Arquitetura orchestrator→intent** (A2A protocol)  
✅ **OpenAI GPT-4o** para interpretação de comandos  
✅ **MCP Client** (stdio transport) para ferramentas GrandChase  
✅ **API REST** com autenticação via API Key  
✅ **Rate limiting** (50 req/15min)  
✅ **Structured logging** (Pino)  
✅ **Deploy Render** (free tier)

## Quick Start

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com credenciais OpenAI e MCP

# Iniciar agent API
npm start
```

## Endpoints

### `GET /health`
Health check (sem autenticação)
```json
{
  "status": "ok",
  "timestamp": "2026-10-04T06:40:00.000Z",
  "uptime": 42.5
}
```

### `POST /api/execute`
Executar comando via agente intent

**Headers:**
```
X-API-Key: sua-chave-secreta
Content-Type: application/json
```

**Body:**
```json
{
  "command": "Liste todos os personagens",
  "context": {
    "user": "orchestrator-id"
  }
}
```

**Response (sucesso):**
```json
{
  "status": "success",
  "result": "Encontrei 25 personagens do GrandChase Classic:\n\n1. Elesis\n2. Arme\n3. Lire\n...",
  "metadata": {
    "toolsCalled": ["list_characters"],
    "model": "gpt-4o"
  }
}
```

**Response (erro):**
```json
{
  "status": "error",
  "error": "User not found"
}
```

## Exemplos de Comandos

```bash
# Listar personagens
curl -X POST http://localhost:3001/api/execute \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"command": "Liste todos os personagens"}'

# Marcar Berkas diário como Feito
curl -X POST http://localhost:3001/api/execute \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"command": "Marque Berkas diário como Feito para o usuário oGus"}'

# Registrar ATK
curl -X POST http://localhost:3001/api/execute \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Registre 1000000 de ATK total para Elesis do jogador PlayerKR",
    "context": {"date": "2026-10-04"}
  }'

# Extrair stats de screenshot via OCR
curl -X POST http://localhost:3001/api/execute \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Extraia os stats deste screenshot: https://i.imgur.com/example.png para o personagem Elesis"
  }'
```

## MCP Tools Disponíveis

O agente tem acesso a 12 ferramentas via MCP:

1. **create_discord_user** - Registrar usuário Discord
2. **create_user** - Criar conta de jogo vinculada a Discord owner
3. **list_users** - Listar usuários
4. **list_characters** - Listar 25 personagens
5. **register_stats** - Registrar stats individual (agora inclui acessórios: anel, tornozeleira, brinco, piercing + anotações)
6. **register_stats_batch** - Registrar stats em lote
7. **query_stats** - Consultar histórico
8. **update_stat_all_chars** - Atualizar 1 campo em todos os 25 personagens (agora suporta acessórios)
9. **grant_permission** - Conceder permissão de edição
10. **revoke_permission** - Revogar permissão
11. **list_permissions** - Listar permissões de uma conta
12. **extract_stats_from_image** - Extrair atributos de screenshot via OCR (GPT-4o Vision)

**Novos campos disponíveis (v1.2.0):**
- Acessórios: `status_anel`, `tipo_anel`, `status_tornozeleira`, `tipo_tornozeleira`
- Notas: `anotacoes` (texto livre, max 5000 chars)
- Calculado: `poder` (auto: (atk + atk_sp) / 10000)

**Novos recursos (v1.2.0):**
- Reset automático semanal/diário (preserva histórico)
- OCR de screenshots com GPT-4o Vision

Ver documentação completa em [gc-management-api](https://github.com/g-soldera/gc-management-api).

## Arquitetura

```
[Orchestrator Service]
    ↓ HTTP POST (A2A protocol)
[gc-management-agent API]
    ↓ spawn IntentAgent
[OpenAI GPT-4o]
    ↓ function calling
[MCP Client (stdio)]
    ↓ spawn subprocess
[MCP Server (gc-management-api)]
    ↓ HTTP + X-API-Key
[REST API (gc-management-api)]
    ↓ Supabase SDK
[PostgreSQL (Kimball Model)]
```

Ver `ARCHITECTURE.md` para diagramas Mermaid completos.

## Variáveis de Ambiente

```bash
# Agent API
PORT=3001
API_KEY=your-secret-api-key-here

# OpenAI
OPENAI_API_KEY=sk-proj-...

# MCP Server (gc-management-api)
MCP_SERVER_PATH=D:\gc-management-api\mcp-server\index.js  # local
MCP_API_URL=https://gc-classic-api.onrender.com
MCP_API_KEY=your-mcp-api-key

# Environment
NODE_ENV=development
```

## Deploy

Ver `SETUP.md` para instruções completas.

**Resumo Render CLI:**
```bash
render login
render create web gc-management-agent --branch main \
  --build-command "npm install" \
  --start-command "npm start"
```

## Segurança

- ✅ API Key obrigatória (header `X-API-Key`)
- ✅ Rate limiting (50 req/15min por IP)
- ✅ Input validation (Zod schemas)
- ✅ Helmet.js (headers de segurança)
- ✅ CORS configurado
- ✅ Body size limit (1MB)
- ✅ Logging estruturado (auditoria)
- ✅ MCP subprocess isolado (stdio transport)

## Custos

| Serviço | Tier | Custo |
|---------|------|-------|
| OpenAI API | Pay-as-you-go | ~$0.001-0.01/req (GPT-4o) |
| Render | Free | $0 (750h/mês) |
| **Total estimado** | | **$1-5/mês** (100 req/dia) |

**Nota:** Para economizar custos, consulte `.planning-alternatives.md` (git-ignored) para alternativas ao Render com free tier maior.

## Licença

MIT
