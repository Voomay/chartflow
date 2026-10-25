import {describe,it,expect} from 'vitest';
import {FAQ_ITEMS,answerFaq} from '../faq';
describe('FAQ assistant',()=>{
  it.each(FAQ_ITEMS)('answers its own suggested question: $id',item=>{expect(answerFaq(item.question).id).toBe(item.id);});
  it('does not invent answers to unsupported questions',()=>{expect(answerFaq('Should I buy Bitcoin tomorrow?').id).toBe(null);});
  it('describes the waitlist as a preview',()=>{expect(answerFaq('waitlist').answer).toContain('does not save signups');});
});
