# Setup - GrandChase Management Agent

Setup completo do agente e deploy.

## Pré-requisitos

1. **Node.js 18+** instalado
2. **OpenAI API Key** (https://platform.openai.com/api-keys)
3. **gc-management-api** deployado e funcionando
4. **Render CLI** (opcional, para deploy via CLI)

## 1. Clonar ou Criar Repositório

```bash
# Se já existe no GitHub
git clone https://github.com/seu-usuario/gc-management-agent.git
cd gc-management-agent

# Ou criar novo
mkdir gc-management-agent
cd gc-management-agent
npm init -y
```

## 2. Instalar Dependências

```bash
npm install
```

## 3. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Editar `.env`:

```bash
# Agent API
PORT=3001
API_KEY=gere-uma-chave-forte-aqui  # Use: openssl rand -hex 32

# OpenAI
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# MCP Server (local development)
MCP_SERVER_PATH=D:\gc-management-api\mcp-server\index.js
MCP_API_URL=http://localhost:3000  # ou https://gc-classic-api.onrender.com
MCP_API_KEY=sua-api-key-da-api-gc

# Environment
NODE_ENV=development
```

**IMPORTANTE:** Após validação, revogue `OPENAI_API_KEY` atual e gere nova (está exposta nesta conversa).

## 4. Testar Localmente

### Iniciar gc-management-api (se local)

```bash
cd D:\gc-management-api
npm start
# Rodando em http://localhost:3000
```

### Iniciar Agent

```bash
cd D:\gc-management-agent
npm start
# Rodando em http://localhost:3001
```

### Testar Health

```bash
curl http://localhost:3001/health
```

### Testar Comando

```bash
curl -X POST http://localhost:3001/api/execute \
  -H "X-API-Key: sua-chave-do-env" \
  -H "Content-Type: application/json" \
  -d '{"command": "Liste todos os personagens"}'
```

## 5. Criar Repositório GitHub

```bash
git init
git add .
git commit -m "Initial commit: GrandChase Management Agent"

# Via gh CLI
gh repo create gc-management-agent --public --source=. --remote=origin
git push -u origin main

# Ou manualmente
# 1. Criar repo em https://github.com/new
# 2. Nome: gc-management-agent
# 3. Public
git remote add origin https://github.com/seu-usuario/gc-management-agent.git
git branch -M main
git push -u origin main
```

## 6. Deploy no Render

### Opção A: Via Dashboard

1. Ir em https://dashboard.render.com/
2. **New** → **Web Service**
3. Connect GitHub repo `gc-management-agent`
4. Configurações:
   - **Name:** `gc-management-agent`
   - **Region:** Oregon (Free)
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. **Add Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
   - `API_KEY` = `sua-chave-secreta`
   - `OPENAI_API_KEY` = `sk-proj-...`
   - `MCP_SERVER_PATH` = `D:\gc-management-api\mcp-server\index.js` (ajustar para caminho absoluto no Render se necessário)
   - `MCP_API_URL` = `https://gc-classic-api.onrender.com`
   - `MCP_API_KEY` = `sua-mcp-api-key`
6. **Create Web Service**

### Opção B: Via Render CLI

```bash
# Instalar Render CLI (se não tiver)
# Download: https://render.com/docs/cli
C:\Users\Administrator\Desktop\render.exe login

# Criar web service
C:\Users\Administrator\Desktop\render.exe create web gc-management-agent \
  --branch main \
  --build-command "npm install" \
  --start-command "npm start" \
  --plan free \
  --region oregon

# Adicionar env vars via dashboard (mais seguro que CLI para secrets)
```

### Health Check

Render configurará automaticamente `/health` como health check path.

## 7. Configurar MCP Server no Render

**Problema:** Render free tier não persiste `node_modules` entre requests (cold start). MCP server precisa estar empacotado.

**Solução 1 (Simples):** Copiar `mcp-server/index.js` da API para o repo do agent:

```bash
mkdir -p src/mcp-server-local
cp D:\gc-management-api\mcp-server\index.js src/mcp-server-local/
```

Ajustar `MCP_SERVER_PATH` no Render:
```
MCP_SERVER_PATH=/opt/render/project/src/mcp-server-local/index.js
```

**Solução 2 (Ideal):** MCP server como npm package publicado, instalar via dependency.

## 8. Validar Deploy

```bash
# Health check
curl https://gc-management-agent.onrender.com/health

# Comando teste
curl -X POST https://gc-management-agent.onrender.com/api/execute \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"command": "Liste todos os usuários"}'
```

## 9. Alternativas ao Render (Free Tier)

Ver `.planning-alternatives.md` (git-ignored) para comparação detalhada de:
- Railway
- Fly.io
- Koyeb
- Deta Space

Critérios: CLI disponível, free tier resources, HTTPS, custo zero.

## Arquitetura de Deploy

```
gc-management-agent/
├── src/
│   ├── agent/
│   │   ├── intent.js          # OpenAI + MCP orchestration
│   │   └── mcp-client.js      # MCP stdio client
│   ├── index.js               # Express API
│   ├── logger.js              # Pino logger
│   └── validators.js          # Zod schemas
├── .env                       # Local env vars (git-ignored)
├── .env.example               # Template
├── .gitignore
├── package.json
├── render.yaml                # Render config
├── README.md
├── ARCHITECTURE.md
└── SETUP.md
```

## Troubleshooting

### MCP Server não conecta

- Verificar `MCP_SERVER_PATH` correto
- Logs Render: ver stderr do subprocess
- Testar MCP server standalone: `node mcp-server/index.js` (deve aguardar stdin)

### OpenAI API Rate Limit

- Free tier: 3 req/min
- Paid tier: 3500 req/min (GPT-4o)
- Implementar retry com exponential backoff

### Render Sleep (Free Tier)

- Após 15min inatividade, service dorme
- Cold start: ~30s para primeiro request
- Solução: Ping externo a cada 10min (Uptime Robot, cron-job.org)

## Custo Real Estimado

### Scenario: 100 comandos/dia

- **OpenAI GPT-4o:**
  - Input: ~500 tokens/req (system + user + tools)
  - Output: ~200 tokens/req
  - Custo: $0.0025/req × 100 = $0.25/dia = **$7.50/mês**

- **OpenAI GPT-4o-mini (alternativa):**
  - Mesmo volume: **$0.015/req** × 100 = **$1.50/mês**

- **Render:** $0/mês (free tier)

**Recomendação:** Usar `gpt-4o-mini` para produção, trocar model em `src/agent/intent.js`.

## Segurança

### Secrets Management

- ❌ **Nunca** commitar `.env`
- ✅ Usar Render env vars (encrypted at rest)
- ✅ Rotacionar API keys mensalmente
- ✅ Revogar OPENAI_API_KEY atual após setup

### HTTPS

Render fornece HTTPS automático (certificado gerenciado).

### Autenticação

Orchestrator deve passar `X-API-Key` válida. Gerar key forte:

```bash
openssl rand -hex 32
```

## Monitoramento

### Logs Render

Dashboard Render → Service → Logs (real-time)

### Alertas

Configurar em Render (Paid plan) ou usar:
- Uptime Robot (ping `/health` a cada 5min)
- Better Uptime (free tier)

## Próximos Passos

1. Validar comandos básicos funcionando
2. Revisar prompt system engineering
3. Otimizar modelo (gpt-4o → gpt-4o-mini)
4. Implementar retry logic
5. Adicionar telemetria (OpenTelemetry)
6. Context engineering para golden trajectory
