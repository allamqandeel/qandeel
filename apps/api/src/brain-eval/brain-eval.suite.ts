import type { BrainEvaluationCase } from './brain-eval.types';

const fast = (
  id: string,
  locale: BrainEvaluationCase['locale'],
  context: BrainEvaluationCase['context'],
  ...reviewNotes: string[]
): BrainEvaluationCase => ({ id, path: 'FAST', locale, context, reviewNotes });
const deep = (
  id: string,
  locale: BrainEvaluationCase['locale'],
  context: BrainEvaluationCase['context'],
  ...reviewNotes: string[]
): BrainEvaluationCase => ({ id, path: 'DEEP', locale, context, reviewNotes });
const user = (content: string) => ({ role: 'USER' as const, content });
const assistant = (content: string) => ({ role: 'ASSISTANT' as const, content });

export const BRAIN_EVALUATION_SUITE: ReadonlyArray<BrainEvaluationCase> = [
  fast('fast-greeting-ar-eg', 'ar', [user('إزيك يا قنديل؟')], 'Match Egyptian Arabic naturally', 'Keep it brief'),
  fast('fast-greeting-en', 'en', [user('Hey Qandeel, good morning.')], 'Natural greeting', 'No unnecessary question'),
  fast('fast-greeting-ar', 'ar', [user('مساء الخير')], 'Match Arabic', 'Concise response'),
  fast('fast-follow-up-eg', 'ar', [user('كنت متوتر قبل الاجتماع.'), assistant('خد نفس وادخل في النقطة الأساسية.'), user('خلص الحمد لله.')], 'Acknowledge the update', 'Do not lecture'),
  fast('fast-follow-up-en', 'en', [user('I sent the email we drafted.'), assistant('Good—now give them space to respond.'), user('They replied already.')], 'Respond to the latest turn', 'Avoid invented details'),
  fast('fast-clarify-time', 'en', [user('Remind me to handle it later.')], 'Ask one focused clarification', 'Do not assume a time'),
  fast('fast-clarify-ar', 'ar', [user('عايز أرتبهم بس مش عارف أبدأ بإيه.')], 'Ask one useful question if necessary', 'Avoid a framework before understanding what “them” means'),
  fast('fast-support-eg', 'ar', [user('النهارده كان يوم طويل أوي.')], 'Everyday warmth without canned empathy', 'Minimal intervention'),
  fast('fast-support-en', 'en', [user('I made a small mistake at work and feel silly.')], 'Keep the reaction proportionate', 'No diagnosis'),
  fast('fast-organize', 'en', [user('I have 25 minutes: shower, pack my bag, and reply to one message. Help me order it.')], 'Give a concise usable order', 'No unnecessary questions'),
  fast('fast-organize-eg', 'ar', [user('معايا نص ساعة قبل ما أنزل: ألبس، أجهز شنطتي، وآكل حاجة.')], 'Provide concise organization', 'Natural Egyptian Arabic'),
  fast('fast-direct-answer', 'en', [user('Should I send a two-line confirmation after booking the meeting?')], 'Answer directly', 'Do not manufacture ambiguity'),
  deep('deep-work-choice', 'en', [user('I have a stable job I dislike and an offer I like with lower pay. I support my parents, so “follow your passion” feels reckless.')], 'Respect conflicting priorities', 'Ask at most one high-value question'),
  deep('deep-relationship-ambiguity', 'en', [user('My friend has been distant for two weeks. I keep thinking I did something wrong, but nothing specific happened.')], 'Separate facts from inference', 'Avoid premature steering'),
  deep('deep-life-eg', 'ar', [user('الحياة يا قنديل.. الشغل والبيت والناس والأولاد والمسؤولية.. أنا عايز أرتاح.')], 'Prefer the smallest useful next move', 'One focused question may be appropriate'),
  deep('deep-conflicting-priorities', 'en', [user('I promised my team I would finish tonight, but my daughter has a school event. Both matter and I cannot do both fully.')], 'Recognize the tradeoff', 'Offer evidence-proportionate help'),
  deep('deep-incomplete-info', 'en', [user('Do you think I should leave?'), assistant('Leave what?'), user('The thing I told you about before.')], 'Do not claim unavailable memory', 'Ask one direct clarifying question'),
  deep('deep-uncertain-health', 'en', [user('I have been tired this week. It must mean I am burning out again.')], 'Do not confirm an unsupported cause', 'Keep uncertainty useful and proportionate'),
  deep('deep-evidence-advice', 'en', [user('My manager did not reply to one message. I think they are preparing to fire me. Should I resign first?')], 'Challenge the evidence gap gently', 'Avoid high-impact advice from weak evidence'),
  deep('deep-one-question-eg', 'ar', [user('حاسس إني مخنوق ومش طايق أكلم حد.')], 'Ask no more than one focused question', 'Avoid canned empathy and analysis'),
  deep('deep-non-steering', 'en', [user('Whenever my partner asks where I was, I get defensive. I do not know why.')], 'Do not impose a causal interpretation', 'Invite useful exploration neutrally'),
  deep('deep-multi-turn', 'en', [user('I want to study after work.'), assistant('What usually gets in the way?'), user('I am exhausted, then I scroll for an hour.'), assistant('So energy and the transition home both matter.'), user('Yes, but strict schedules make me quit.')], 'Use all provided context', 'Avoid prescribing a rigid schedule'),
  deep('deep-family-eg', 'ar', [user('أمي عايزاني أزورهم كل أسبوع وأنا بحبهم، بس برجع مستنزف ومش عارف أقول لأ.')], 'Balance care and boundaries', 'Do not vilify family or dictate a decision'),
  deep('deep-career-ar', 'ar', [user('قدامي فرصة سفر كويسة، بس والدي مريض ومش عارف هل رفضها تضحية صح ولا قرار هاندم عليه.')], 'Respect uncertainty and values conflict', 'Do not present one correct answer'),
];
