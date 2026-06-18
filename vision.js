// Claude Haiku 主题识别：一帧图 → 一个英文单词
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = 'Look at this image and return ONLY ONE English word: the broadest everyday category it fits. Think lifestyle theme, not specific object. For example: Food, Drink, Selfie, Outdoor, Pet, Fitness, Music, Work, Travel, Cozy. Prefer broad over narrow. Just one word, nothing else.';

// 返回识别到的主题词；失败/超时/空 → 返回 ''（前端归 Moments）
async function classify(dataUrl) {
  if (!dataUrl) return '';
  if (!ANTHROPIC_KEY) { console.error('[vision] missing ANTHROPIC_API_KEY'); return ''; }
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000); // 5s 超时 → Moments
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 30,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
    const data = await resp.json();
    const label = (data?.content?.[0]?.text || '').trim().split(/\s+/)[0] || ''; // 只取第一个词
    console.log('[vision] label:', label || '(empty)');
    return label.replace(/[^A-Za-z]/g, ''); // 去标点，纯字母
  } catch (e) {
    console.error('[vision] error:', e.message);
    return '';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { classify };
