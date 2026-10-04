---
task: gc-management-agent
created: 2026-10-04T06:36:40.211Z
status: planning
---

# Quick Task: gc-management-agent com MCP e deploy CLI

## Objetivo

Criar agente intent-based `gc-management-agent` que consome MCP server de gestão GrandChase, seguindo padrão A2A protocol (orchestrator→intent). Base da API `D:\gc-management-api`.

## Escopo

1. **Repositório GitHub** `gc-management-agent`
2. **Agente intent** via OpenAI (o1/o1-mini) consumindo MCP tools
3. **API REST** para receber comandos A2A protocol
4. **Deploy via Render CLI**
5. **Documentação** (README.md, ARCHITECTURE.md, SETUP.md)
6. **Relatório git-ignored** com alternativa ao Render (CLI, free tier, conexão segura)

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **LLM:** OpenAI o1-preview/o1-mini (via `OPENAI_API_KEY`)
- **MCP Client:** `@modelcontextprotocol/sdk`
- **Deploy:** Render CLI (free tier)
- **Security:** API Key auth, Helmet, rate limiting

## Arquitetura

```
[Orchestrator] 
    ↓ HTTP POST (A2A protocol)
[gc-management-agent API]
    ↓ spawn intent agent
[OpenAI Agent (intent)]
    ↓ MCP protocol
[gc-management-api MCP Server]
    ↓ HTTP + X-API-Key
[gc-management-api REST API]
    ↓ Supabase SDK
[PostgreSQL Kimball Model]
```

## Tasks

### 1. Estrutura base
- [ ] Criar diretório `D:\gc-management-agent`
- [ ] Inicializar package.json (deps: express, @modelcontextprotocol/sdk, openai, dotenv, helmet, cors, zod)
- [ ] .gitignore (node_modules, .env, coverage, .planning-alternatives.md)
- [ ] .env.example

### 2. Intent agent core
- [ ] `src/agent/intent.js` - wrapper OpenAI com MCP client
- [ ] `src/agent/mcp-client.js` - cliente MCP stdio (spawn mcp-server)
- [ ] Prompt system: "Você é um agente especializado em gerenciar personagens GrandChase Classic via MCP tools"

### 3. API REST A2A
- [ ] `src/index.js` - Express server
- [ ] `POST /api/execute` - recebe comando orchestrator (JSON: {command: string, context?: object})
- [ ] Middleware auth (X-API-Key)
- [ ] Response format A2A: {status, result, error?, metadata}
- [ ] Health endpoint

### 4. Deploy
- [ ] render.yaml (web service, build: npm install, start: npm start)
- [ ] Configurar env vars: OPENAI_API_KEY, API_KEY, MCP_API_URL, MCP_API_KEY
- [ ] Deploy via Render CLI

### 5. Documentação
- [ ] README.md (quick start, endpoints, MCP tools, deploy)
- [ ] ARCHITECTURE.md (diagramas Mermaid: orchestrator→intent→MCP flow)
- [ ] SETUP.md (env vars, GitHub setup, Render CLI commands)

### 6. Relatório alternativas deploy
- [ ] `.planning-alternatives.md` (git-ignored)
- [ ] Avaliar: Railway, Fly.io, Koyeb, Deta Space
- [ ] Critérios: CLI disponível, free tier resources, conexão segura (HTTPS/mTLS)
- [ ] Tabela comparativa custos/limites
- [ ] Recomendação final

### 7. GitHub
- [ ] Criar repo via gh CLI: `gh repo create gc-management-agent --public`
- [ ] Push inicial
- [ ] README badges (tests, deploy status)

## Decisões técnicas

- **OpenAI model:** o1-mini (menor custo, suficiente para intent routing)
- **MCP spawn:** stdio transport (mesmo processo, sem network overhead)
- **Auth:** API Key dupla (agent API + MCP API) para defesa em profundidade
- **Rate limit:** 50 req/15min (agente orchestrator não será high-throughput)
- **Logs:** pino structured logging
- **Validation:** Zod schemas para A2A protocol payload

## Ponytail

Skipped para MVP:
- [ ] Context engineering avançado (system prompt básico primeiro)
- [ ] Golden trajectory optimization (validar após primeiros testes)
- [ ] Retry logic + circuit breaker (adicionar quando latência OpenAI causar timeouts)
- [ ] Telemetria (OpenTelemetry) - adicionar quando escalar
- [ ] Multi-agent orchestration (single intent agent primeiro)

## Success criteria

✅ Agent responde comando orchestrator: "Liste todos os personagens"
✅ Agent executa MCP tool `list_characters` e retorna resultado formatado
✅ Deploy Render funcionando (health endpoint 200 OK)
✅ Documentação completa (README com exemplos curl)
✅ Relatório alternativas com recomendação CLI + free tier

## Estimativa

- Estrutura + agent core: 30min
- API REST A2A: 20min
- Docs: 20min
- Deploy + testes: 15min
- Relatório alternativas: 15min
- **Total:** ~100min
