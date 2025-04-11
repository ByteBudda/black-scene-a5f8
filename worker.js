/**
 * Cloudflare Worker - API Endpoint для @hf/Kvikontent/midjourney-v6 (Image Generation)
 *
 * Ожидает POST-запрос на /api/generate
 * Требует заголовок: X-API-Key: <ваш-секретный-ключ>
 * Тело запроса (JSON):
 * {
 *   "prompt": "A photorealistic image of an astronaut riding a horse on the moon",
 *   // Могут поддерживаться и другие параметры, специфичные для модели,
 *   // например: "negative_prompt", "guidance_scale", "num_steps", etc.
 *   // Их нужно будет добавить в объект inputs ниже, если они есть в requestBody.
 * }
 *
 * Возвращает:
 * Успех: Изображение (например, image/png) или JSON с результатом (зависит от модели).
 *        Предполагаем, что возвращаются байты изображения.
 * Ошибка: JSON с описанием ошибки. { "error": { "message": "...", "details": "..." } }
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Проверяем путь и метод
    const url = new URL(request.url);
    if (url.pathname !== '/api/generate') {
      return new Response(JSON.stringify({ error: { message: 'Not Found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Проверяем API ключ (из секрета)
    const providedApiKey = request.headers.get('X-API-Key');
    if (!env.API_KEY) {
       console.error('Секрет API_KEY не установлен в окружении воркера!');
       return new Response(JSON.stringify({ error: { message: 'API Key configuration error' } }), {
         status: 500, // Ошибка конфигурации сервера
         headers: { 'Content-Type': 'application/json' },
       });
    }
    if (!providedApiKey || providedApiKey !== env.API_KEY) {
        console.warn('Unauthorized API access attempt.');
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // 3. Проверяем привязку AI
     if (!env.AI) {
        console.error("AI binding is not configured in wrangler.toml");
        return new Response(JSON.stringify({ error: { message: 'AI service not configured on server' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // 4. Получаем и валидируем тело запроса
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Валидация обязательного поля 'prompt'
    if (!requestBody || typeof requestBody.prompt !== 'string' || requestBody.prompt.trim() === '') {
      return new Response(JSON.stringify({ error: { message: 'Request body must contain a non-empty string "prompt"' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Готовим входные данные для модели AI
    const model = '@cf/lykon/dreamshaper-8-lcm';
    const inputs = {
      prompt: requestBody.prompt,
      // Добавляем другие параметры из запроса, если они есть
      ...(requestBody.negative_prompt && { negative_prompt: requestBody.negative_prompt }),
      ...(requestBody.guidance_scale && { guidance_scale: requestBody.guidance_scale }),
      ...(requestBody.num_steps && { num_steps: requestBody.num_steps }),
      // ... добавьте другие параметры по необходимости ...
    };

    // 6. Выполняем запрос к AI
    try {
      console.log(`Running image generation model ${model} with prompt: "${inputs.prompt.substring(0, 50)}..."`);

      // Для моделей генерации изображений ответ часто является ArrayBuffer с байтами изображения
      const aiResponse = await env.AI.run(model, inputs);

      console.log(`AI image generation successful for model ${model}. Response type: ${aiResponse?.constructor?.name}`);

      // 7. Возвращаем успешный ответ (предполагаем, что это байты изображения)
      // Устанавливаем правильный Content-Type. Возможно, потребуется определить его точнее,
      // если модель может генерировать разные форматы (png, jpeg). Начнем с png.
      return new Response(aiResponse, {
        headers: {
          'Content-Type': 'image/png', // Или 'image/jpeg', или определите на основе ответа, если возможно
        },
      });

    } catch (error) {
      // 8. Обрабатываем ошибки выполнения AI
      console.error(`Error running AI model ${model}:`, error);

      let errorMessage = 'AI model execution failed';
      let errorDetails = error instanceof Error ? error.message : String(error);
      let statusCode = 500;

      if (error.message && error.message.includes('AiError:')) {
          errorMessage = error.message;
          // Можно добавить обработку кодов ошибок AI, если нужно
      } else if (error.cause) {
          errorDetails += ` | Cause: ${error.cause}`;
      }

      return new Response(JSON.stringify({ error: { message: errorMessage, details: errorDetails } }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
