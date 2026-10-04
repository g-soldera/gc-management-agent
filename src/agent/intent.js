const OpenAI = require('openai');
const MCPClient = require('./mcp-client');
const logger = require('../logger');

class IntentAgent {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.mcpClient = new MCPClient();
    this.systemPrompt = `Você é um agente especializado em gerenciar personagens do GrandChase Classic.

Você tem acesso a ferramentas via MCP (Model Context Protocol) que permitem:
- Criar usuários (vinculados a Discord user ID)
- Listar usuários e personagens
- Registrar estatísticas de personagens (individual ou em lote)
- Consultar histórico de stats
- Atualizar um campo para todos os 25 personagens de uma vez (ex: marcar Berkas como "Feito")

**IMPORTANTE - Autorização Discord:**
Cada conta (username) está vinculada a um Discord user ID. Somente o dono ou usuários autorizados podem editar dados.

O contexto SEMPRE incluirá \`discord_user_id\` (obrigatório). Você DEVE passar este valor como \`discord_id\` em TODAS as chamadas MCP de escrita:
- register_stats: requer discord_id
- update_stat_all_chars: requer discord_id

Chamadas sem discord_id serão rejeitadas pela API com erro 403.

**Instruções:**
1. Interprete o comando do usuário
2. Identifique qual(is) ferramenta(s) MCP usar
3. Passe \`discord_user_id\` e \`authorized_users\` quando disponíveis no contexto
4. Execute as ferramentas necessárias
5. Retorne resultado formatado em português brasileiro

**Exemplos de comandos:**
- "Liste todos os personagens" → use list_characters (sem discord_id necessário)
- "Marque Berkas diário como Feito para o usuário oGus" → use update_stat_all_chars com discord_id do contexto
- "Registre 1000000 de ATK total para Elesis do jogador PlayerKR" → use register_stats com discord_id do contexto

Sempre confirme ações destrutivas antes de executar.`;
  }

  async initialize() {
    await this.mcpClient.connect();
    this.tools = await this.mcpClient.listTools();
    logger.info({ toolCount: this.tools.length }, 'Agent initialized with MCP tools');
  }

  async execute(command, context = {}) {
    if (!this.tools) await this.initialize();

    logger.info({ command, discord_user_id: context.discord_user_id }, 'Executing intent');

    try {
      // ponytail: usar o1-mini requer reasoning API diferente, simplificando com gpt-4o primeiro
      const contextMessage = context.discord_user_id 
        ? `Discord User ID: ${context.discord_user_id}\nAuthorized Users: ${context.authorized_users?.join(', ') || 'none'}\n\nContexto adicional: ${JSON.stringify(context)}`
        : `Contexto adicional: ${JSON.stringify(context)}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Comando: ${command}\n\n${contextMessage}` }
        ],
        tools: this.tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema
          }
        })),
        tool_choice: 'auto'
      });

      const message = completion.choices[0].message;

      // Se LLM pediu pra chamar tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        const results = [];
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = JSON.parse(toolCall.function.arguments);
          
          // Injetar discord_id do contexto em ferramentas de escrita
          const writeTools = ['register_stats', 'update_stat_all_chars', 'create_user'];
          if (writeTools.includes(toolName) && context.discord_user_id && !toolArgs.discord_id) {
            toolArgs.discord_id = context.discord_user_id;
            logger.info({ toolName, discord_id: context.discord_user_id }, 'Injected discord_id into tool args');
          }
          
          logger.info({ toolName, toolArgs }, 'Calling MCP tool');
          const result = await this.mcpClient.callTool(toolName, toolArgs);
          results.push({ tool: toolName, result });
        }

        // Segundo turno: passar resultados tools de volta pro LLM formatar resposta
        const finalCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: `Comando: ${command}` },
            message,
            ...message.tool_calls.map((tc, i) => ({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(results[i].result)
            }))
          ]
        });

        return {
          status: 'success',
          result: finalCompletion.choices[0].message.content,
          metadata: {
            toolsCalled: results.map(r => r.tool),
            model: 'gpt-4o'
          }
        };
      }

      // LLM respondeu direto sem tools
      return {
        status: 'success',
        result: message.content,
        metadata: { toolsCalled: [], model: 'gpt-4o' }
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Agent execution failed');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async close() {
    await this.mcpClient.close();
  }
}

module.exports = IntentAgent;
