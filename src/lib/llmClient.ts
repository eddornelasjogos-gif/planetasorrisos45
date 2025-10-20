import { sanitizeMessages, type ChatMessage } from "./sanitizePrompt";

const LLM_API_URL = import.meta.env.VITE_LLM_API_URL as string | undefined;
const LLM_API_KEY = import.meta.env.VITE_LLM_API_KEY as string | undefined;

/**
 * callLLM
 * - Recebe um array de mensagens no formato { role, content } (como em chat completions).
 * - Usa sanitizeMessages para enviar apenas a última mensagem do usuário.
 * - Faz POST para VITE_LLM_API_URL com body { messages: [...] }.
 *
 * Observações:
 * - Configure VITE_LLM_API_URL e (opcional) VITE_LLM_API_KEY no seu .env.
 * - Este wrapper é propositalmente simples: adapta conforme a API do seu provedor (OpenAI, Anthropic, etc).
 */
export async function callLLM(messages: ChatMessage[]) {
  const sanitized = sanitizeMessages(messages);
  if (sanitized.length === 0) {
    throw new Error("Nenhuma mensagem de usuário encontrada: nada a enviar para o LLM.");
  }

  if (!LLM_API_URL) {
    throw new Error("VITE_LLM_API_URL não está definida. Adicione a URL da API do LLM ao seu .env.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (LLM_API_KEY) {
    headers["Authorization"] = `Bearer ${LLM_API_KEY}`;
  }

  const resp = await fetch(LLM_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      // Ajuste o payload conforme a API que você utiliza.
      // Aqui enviamos o campo `messages` que contém apenas a última mensagem do usuário.
      messages: sanitized,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Erro na chamada ao LLM (${resp.status}): ${text}`);
  }

  // Retorna o JSON bruto; adapte se quiser extrair só o texto de resposta.
  return resp.json();
}

/**
 * callLLMSafe
 * - Mesma ideia de callLLM, mas captura erros e retorna um objeto com success flag.
 */
export async function callLLMSafe(messages: ChatMessage[]) {
  try {
    const result = await callLLM(messages);
    return { success: true, result };
  } catch (error: any) {
    console.error("LLM request failed:", error);
    return { success: false, error: error?.message || String(error) };
  }
}