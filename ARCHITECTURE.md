# Architecture - GrandChase Management Agent

## Overview

Agente intent-based que interpreta comandos em linguagem natural via OpenAI e executa ferramentas MCP (Model Context Protocol) para gerenciar personagens do GrandChase Classic.

## Stack Tecnológico

```mermaid
graph TB
    Orchestrator[Orchestrator Service<br/>External system]
    
    subgraph Agent["gc-management-agent (Node.js + Express)"]
        API[REST API<br/>POST /api/execute]
        Intent[IntentAgent<br/>OpenAI GPT-4o]
        MCPClient[MCP Client<br/>stdio transport]
    end
    
    subgraph MCP["MCP Server (subprocess)"]
        MCPServer[gc-management-api<br/>mcp-server/index.js]
    end
    
    subgraph Backend["gc-management-api"]
        REST[REST API<br/>Express.js]
        DB[(Supabase PostgreSQL<br/>Kimball Model)]
    end
    
    Orchestrator -->|HTTP POST + X-API-Key| API
    API --> Intent
    Intent -->|OpenAI Function Calling| MCPClient
    MCPClient -->|stdio| MCPServer
    MCPServer -->|HTTP + X-API-Key| REST
    REST -->|Supabase SDK| DB
```

## Fluxo de Dados A2A Protocol

### Exemplo: "Marque Berkas diário como Feito para o usuário oGus"

```mermaid
sequenceDiagram
    participant Orch as Orchestrator
    participant API as Agent API
    participant Agent as IntentAgent
    participant OpenAI as OpenAI GPT-4o
    participant MCP as MCP Client
    participant Server as MCP Server
    participant Backend as gc-management-api

    Orch->>API: POST /api/execute<br/>{command: "Marque Berkas...", context: {}}
    API->>API: Auth Middleware (X-API-Key)
    API->>Agent: execute(command, context)
    Agent->>OpenAI: chat.completions.create<br/>system: prompt + tools<br/>user: command
    OpenAI-->>Agent: tool_call: update_stat_all_chars<br/>{username: "oGus", field_name: "status_berkas_diario", ...}
    Agent->>MCP: callTool("update_stat_all_chars", args)
    MCP->>Server: stdio request
    Server->>Backend: POST /api/stats/update-all-chars<br/>+ X-API-Key
    Backend->>Backend: RPC update_stat_all_chars(...)
    Backend-->>Server: {updated_count: 25, char_names: [...]}
    Server-->>MCP: MCP response
    MCP-->>Agent: tool result
    Agent->>OpenAI: Second turn with tool results
    OpenAI-->>Agent: "Marquei Berkas diário como Feito para todos os 25 personagens do usuário oGus"
    Agent-->>API: {status: "success", result: "...", metadata: {...}}
    API-->>Orch: JSON response
```

## Componentes

### 1. REST API Layer (`src/index.js`)

**Responsabilidades:**
- Receber comandos A2A via `POST /api/execute`
- Autenticação via API Key
- Rate limiting (50 req/15min)
- Validação de payload (Zod)
- Health check endpoint

**Middlewares:**
- `helmet` - Security headers
- `cors` - CORS policy
- `express-rate-limit` - Rate limiting
- `authMiddleware` - API Key validation
- `validate` - Schema validation

### 2. IntentAgent (`src/agent/intent.js`)

**Responsabilidades:**
- Interpretar comandos em linguagem natural
- Selecionar ferramentas MCP apropriadas
- Orquestrar chamadas OpenAI + MCP
- Formatar resposta final

**Prompt System:**
```
Você é um agente especializado em gerenciar personagens do GrandChase Classic.

Você tem acesso a ferramentas via MCP que permitem:
- Criar usuários
- Listar usuários e personagens
- Registrar estatísticas (individual ou lote)
- Consultar histórico
- Atualizar campo em todos os 25 personagens

Instruções:
1. Interprete o comando
2. Identifique ferramenta(s) MCP
3. Execute ferramentas
4. Retorne resultado em português brasileiro
```

**OpenAI Function Calling:**
- Model: `gpt-4o` (ponytail: migrar para o1-mini após validação)
- Tools: Lista dinâmica de MCP tools convertida para OpenAI function schema
- Two-turn flow: request → tool_calls → results → final response

### 3. MCP Client (`src/agent/mcp-client.js`)

**Responsabilidades:**
- Spawn subprocess `node mcp-server/index.js`
- stdio transport (stdin/stdout communication)
- Enviar env vars para MCP server (API_URL, API_KEY)
- Lifecycle management (connect/close)

**Métodos:**
- `connect()` - Spawn subprocess + connect transport
- `listTools()` - Request `tools/list` from MCP server
- `callTool(name, args)` - Request `tools/call` with params
- `close()` - Kill subprocess + cleanup

### 4. Validators (`src/validators.js`)

**Schemas:**
- `executeCommandSchema`:
  - `command`: string (1-1000 chars)
  - `context`: optional record

## Segurança

### Camadas de Proteção

1. **API Key Authentication (Agent API)**
   - Header obrigatório: `X-API-Key`
   - Validado antes de executar comando

2. **API Key Authentication (MCP → Backend)**
   - MCP client passa `MCP_API_KEY` para MCP server via env
   - MCP server usa key no header `X-API-Key` ao chamar REST API

3. **Rate Limiting**
   - 50 requests / 15min por IP
   - Protege contra abuse do orchestrator

4. **Input Validation**
   - Zod schemas para A2A payload
   - Max 1000 chars no comando

5. **Subprocess Isolation**
   - MCP server roda em processo separado
   - stdio transport (sem network exposure)

6. **Helmet.js**
   - Headers de segurança HTTP

## A2A Protocol Contract

### Request Format

```json
{
  "command": "string (natural language command)",
  "context": {
    "optional": "key-value pairs for context"
  }
}
```

### Response Format (Success)

```json
{
  "status": "success",
  "result": "formatted natural language response",
  "metadata": {
    "toolsCalled": ["tool1", "tool2"],
    "model": "gpt-4o"
  }
}
```

### Response Format (Error)

```json
{
  "status": "error",
  "error": "error message"
}
```

## Deploy Architecture

```mermaid
graph LR
    GitHub[GitHub Repo<br/>gc-management-agent]
    
    Render[Render Web Service<br/>Free tier<br/>Build: npm install<br/>Start: npm start]
    
    OpenAI[OpenAI API<br/>GPT-4o]
    
    Backend[gc-management-api<br/>Render Web Service]
    
    Env[Environment Variables<br/>OPENAI_API_KEY<br/>API_KEY<br/>MCP_API_URL<br/>MCP_API_KEY]
    
    GitHub -->|git push| Render
    Env -.->|config| Render
    Render -->|HTTPS| OpenAI
    Render -->|HTTP + MCP subprocess| Backend
```

## Custos Estimados

| Serviço | Tier | Custo/Mês |
|---------|------|-----------|
| OpenAI API | Pay-as-you-go | $1-5 (100 req/dia, GPT-4o) |
| Render (Agent) | Free | $0 (750h, sleep após inatividade) |
| Render (Backend) | Free | $0 (já deployado) |
| **Total** | | **$1-5/mês** |

### Otimizações de Custo

1. **Modelo:** Migrar para `gpt-4o-mini` (5x mais barato, ~$0.20/mês)
2. **Caching:** OpenAI prompt caching (50% desconto em system prompt)
3. **Alternativa Render:** Ver `.planning-alternatives.md` para free tier maior

## MCP Tools Schema

```javascript
[
  {
    name: "create_user",
    description: "Create new user (supports Korean chars)",
    inputSchema: { username: string }
  },
  {
    name: "list_users",
    description: "List all users",
    inputSchema: {}
  },
  {
    name: "list_characters",
    description: "List 25 GrandChase characters",
    inputSchema: {}
  },
  {
    name: "register_stats",
    description: "Register character stats (single)",
    inputSchema: { username, char_name, date?, nivel?, atk_total?, ... }
  },
  {
    name: "register_stats_batch",
    description: "Register stats in batch",
    inputSchema: { records: [...] }
  },
  {
    name: "query_stats",
    description: "Query stats with filters",
    inputSchema: { username?, char_name?, from_date?, to_date? }
  },
  {
    name: "update_stat_all_chars",
    description: "Update 1 field for ALL 25 characters",
    inputSchema: { username, field_name, field_value, date? }
  }
]
```

## Ponytail (Future Optimizations)

Skipped para MVP:

1. **OpenAI o1-mini:** Requer reasoning API diferente, usar GPT-4o primeiro
2. **Context engineering:** System prompt básico, otimizar após validação
3. **Retry logic:** Adicionar quando OpenAI latency causar timeouts
4. **Circuit breaker:** Proteção contra MCP server down
5. **Telemetria:** OpenTelemetry quando escalar
6. **Multi-turn conversations:** Stateless por enquanto, adicionar session management depois

## Monitoring

### Health Checks

- `GET /health` - HTTP 200 OK = service up
- Render health check automático (free tier)

### Logs Estruturados (Pino)

```javascript
logger.info({ command, hasContext }, 'Received A2A command');
logger.info({ toolName, toolArgs }, 'Calling MCP tool');
logger.error({ error }, 'Agent execution failed');
```

### Métricas Importantes

- Latency: Command → Response (target <5s)
- OpenAI tokens: Input + Output per request
- MCP tool call success rate
- Rate limit hits
