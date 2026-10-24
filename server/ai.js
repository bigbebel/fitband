// 식단 사진 → OpenAI GPT-4o Vision 으로 칼로리/영양소 분석
import OpenAI from 'openai';
import fs from 'fs';

const hasKey = !!process.env.OPENAI_API_KEY;
const client = hasKey ? new OpenAI() : null;

const SCHEMA_HINT = `다음 JSON 형식으로만 답하세요(설명 없이):
{
  "foods": [
    { "name": "음식명", "amount": "추정 양(예: 1인분, 200g)", "calories": 0, "carbs": 0, "protein": 0, "fat": 0, "sodium": 0, "sugar": 0 }
  ],
  "total": { "calories": 0, "carbs": 0, "protein": 0, "fat": 0, "sodium": 0, "sugar": 0 },
  "comment": "한 줄 영양 코멘트 (한국어)"
}
단위: calories=kcal, carbs/protein/fat/sugar=g, sodium=mg. 숫자만 넣으세요.`;

export async function analyzeMeal(filePath, mimeType) {
  if (!client) return mock();
  const b64 = fs.readFileSync(filePath).toString('base64');
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '당신은 영양사입니다. 음식 사진을 보고 음식 종류, 양, 칼로리, 영양 성분을 추정합니다. ' + SCHEMA_HINT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '이 식단을 분석해줘.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}`, detail: 'low' } },
        ],
      },
    ],
  });
  const text = res.choices[0].message.content || '{}';
  const parsed = JSON.parse(text);
  return normalize(parsed);
}

function normalize(p) {
  const n = (v) => Number(v) || 0;
  const foods = (p.foods || []).map((f) => ({
    name: f.name || '음식', amount: f.amount || '',
    calories: n(f.calories), carbs: n(f.carbs), protein: n(f.protein), fat: n(f.fat), sodium: n(f.sodium), sugar: n(f.sugar),
  }));
  const total = foods.reduce((a, f) => ({
    calories: a.calories + f.calories, carbs: a.carbs + f.carbs, protein: a.protein + f.protein,
    fat: a.fat + f.fat, sodium: a.sodium + f.sodium, sugar: a.sugar + f.sugar,
  }), { calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0 });
  return { foods, total: p.total && n(p.total.calories) ? { ...total, ...mapNum(p.total) } : total, comment: p.comment || '' };
}
function mapNum(o) { const r = {}; for (const k of Object.keys(o)) r[k] = Number(o[k]) || 0; return r; }

function mock() {
  return normalize({
    foods: [
      { name: '(목업) 현미밥', amount: '1공기', calories: 300, carbs: 65, protein: 6, fat: 1, sodium: 5, sugar: 0 },
      { name: '(목업) 닭가슴살', amount: '150g', calories: 165, carbs: 0, protein: 31, fat: 3.6, sodium: 74, sugar: 0 },
    ],
    comment: 'OPENAI_API_KEY 가 없어 목업 결과입니다.',
  });
}
