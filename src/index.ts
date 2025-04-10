// src/index.ts (Модифицированный)

export default {
  async fetch(request: Request, env: { AI: any }, ctx: ExecutionContext): Promise<Response> {
    // 1. Проверяем метод запроса (ожидаем POST)
    if (request.method !== 'POST') {
      return new Response('Expected POST method', { status: 405 }); // Method Not Allowed
    }

    // 2. Получаем промпт из тела запроса (ожидаем JSON)
    let prompt: string;
    try {
      const requestBody: any = await request.json();
      if (!requestBody || typeof requestBody.prompt !== 'string' || !requestBody.prompt.trim()) {
        return new Response('Missing or invalid "prompt" in JSON body', { status: 400 }); // Bad Request
      }
      prompt = requestBody.prompt.trim();
    } catch (e) {
      return new Response('Invalid JSON body', { status: 400 }); // Bad Request
    }

    // 3. Подготавливаем входные данные для модели AI
    const inputs = {
      prompt: prompt
      // Можно добавить другие параметры, если модель их поддерживает,
      // например: negative_prompt, num_steps и т.д., получая их из requestBody
    };

    // 4. Выполняем модель AI
    try {
      const response = await env.AI.run(
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        inputs
      );

      // 5. Возвращаем результат (изображение)
      return new Response(response, {
        headers: {
          "content-type": "image/png" // Указываем тип контента
        }
      });
    } catch (e: any) {
       console.error("AI Model Run Error:", e); // Логируем ошибку в Cloudflare
       return new Response(`Error running AI model: ${e.message || 'Unknown error'}`, { status: 500 }); // Internal Server Error
    }
  }
};
