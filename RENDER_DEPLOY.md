# GC Management Agent - Render Deploy

## ⚠️ Ação Necessária: Deploy Manual

O agente precisa ser deployado no Render para funcionar.

## Passo 1: Verificar Serviço no Render

Dashboard: https://dashboard.render.com/

- **Nome do serviço:** `gc-management-agent`
- **Branch:** `main`
- **Região:** Oregon
- **Plan:** Free

Se o serviço não existir, crie um novo Web Service.

## Passo 2: Configurar Environment Variables

No dashboard do serviço, adicione (valores devem vir do arquivo `.env` local):

### Obrigatórias:
```
API_KEY=(copie do .env local)
OPENAI_API_KEY=(copie do .env local)
MCP_API_URL=https://gc-classic-api.onrender.com
MCP_API_KEY=(copie do .env local - campo MCP_API_KEY)
```

**Nota:** Valores sensíveis não são incluídos neste guia. Use o arquivo `.env` local como referência.

### Já configuradas no render.yaml:
```
NODE_ENV=production
PORT=10000
MCP_SERVER_PATH=/opt/render/project/src/mcp-server-local/index.js
```

## Passo 3: Habilitar Auto-Deploy

1. Settings → Build & Deploy
2. Auto-Deploy: **Yes**
3. Branch: `main`
4. Save Changes

## Passo 4: Deploy Manual (Agora)

1. Manual Deploy → Branch `main` → Deploy
2. Aguardar ~3-5 minutos

## Passo 5: Testar Após Deploy

```bash
# Health check
curl https://gc-management-agent.onrender.com/health

# Deve retornar:
# {"status":"ok","timestamp":"...","uptime":...}

# Teste de execução (use API_KEY do .env)
curl -X POST https://gc-management-agent.onrender.com/api/execute \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"command": "Liste todos os personagens"}'
```

## Arquitetura de Integração

```
[gc-management-agent]
    ↓ spawn MCP Client (stdio)
[MCP Server subprocess]
    ↓ HTTP + X-API-Key
[gc-classic-api.onrender.com]
    ↓ Supabase SDK
[PostgreSQL]
```

## Notas Importantes

- **MCP_SERVER_PATH:** Aponta para `/opt/render/project/src/mcp-server-local/index.js` (local ao agent)
- O agente **não** precisa do MCP server externo, ele spawna um subprocess local
- `MCP_API_URL` e `MCP_API_KEY` são usados pelo subprocess MCP para chamar a API REST

## Status Atual

- ✅ `render.yaml` configurado
- ✅ Código commitado e pushed
- ⏳ Aguardando configuração de env vars no dashboard
- ⏳ Aguardando deploy manual

## Após Deploy

O agente estará disponível em:
- **URL:** https://gc-management-agent.onrender.com
- **Health:** https://gc-management-agent.onrender.com/health
- **Execute:** POST /api/execute (requer X-API-Key)

**Futuros `git push` farão auto-deploy automático.**
