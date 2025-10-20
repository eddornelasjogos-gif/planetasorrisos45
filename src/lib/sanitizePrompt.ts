export type ChatMessage = {
  role: string;
  content: string;
};

/**
 * sanitizeMessages
 * - Recebe um array de mensagens com { role, content }.
 * - Retorna um novo array contendo apenas a ÚLTIMA mensagem cujo role === 'user'.
 * - Se não houver mensagem de usuário, retorna [].
 *
 * Racional: garante que apenas a mensagem do usuário seja enviada ao LLM,
 * prevenindo envio de system/assistant que aumentariam consumo de tokens.
 */
export function sanitizeMessages(messages: ChatMessage[] | undefined | null) {
  if (!messages || messages.length === 0) return [];

  // Itera de trás pra frente e pega a primeira mensagem com role 'user'
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    if (m.role && m.role.toLowerCase() === "user" && typeof m.content === "string" && m.content.trim() !== "") {
      return [
        {
          role: "user",
          content: m.content.trim(),
        },
      ];
    }
  }

  // Nenhuma mensagem de usuário encontrada
  return [];
}