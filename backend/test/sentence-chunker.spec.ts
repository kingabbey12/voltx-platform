import { SentenceChunker } from '../src/modules/ai/ask/sentence-chunker';
import { ASK_FENCE_OPEN } from '../src/modules/ai/ask/ask-response-contract';

describe('SentenceChunker', () => {
  function drain(chunker: SentenceChunker, deltas: string[]): string[] {
    const sentences: string[] = [];
    for (const delta of deltas) {
      sentences.push(...chunker.push(delta));
    }
    return sentences;
  }

  it('emits nothing until a sentence completes, then emits it whole', () => {
    const chunker = new SentenceChunker();
    expect(chunker.push('Yes — carefully. The company has')).toEqual(['Yes — carefully.']);
    expect(chunker.push(' carried the wage for five months. More')).toEqual([
      'The company has carried the wage for five months.',
    ]);
    expect(chunker.flush()).toEqual(['More']);
  });

  it('reassembles sentences split across many small deltas', () => {
    const chunker = new SentenceChunker();
    const text = 'Service revenue held steady. Installations are booked six weeks out. ';
    const sentences = drain(
      chunker,
      text.split(/(?<= )/), // word-sized deltas
    );
    sentences.push(...chunker.flush());
    expect(sentences).toEqual([
      'Service revenue held steady.',
      'Installations are booked six weeks out.',
    ]);
  });

  it('does not split on decimals or common abbreviations', () => {
    const chunker = new SentenceChunker();
    const sentences = drain(chunker, [
      'The margin was 4.5 percent, e.g. after freight. Next sentence arrives. ',
    ]);
    sentences.push(...chunker.flush());
    expect(sentences).toEqual([
      'The margin was 4.5 percent, e.g. after freight.',
      'Next sentence arrives.',
    ]);
  });

  it('stops emitting at the response fence and never leaks fenced JSON', () => {
    const chunker = new SentenceChunker();
    const sentences = drain(chunker, [
      'The answer is yes. ',
      `${ASK_FENCE_OPEN}\n{"segments":[]}\n\`\`\``,
      'anything after is ignored. ',
    ]);
    sentences.push(...chunker.flush());
    expect(sentences).toEqual(['The answer is yes.']);
  });

  it('holds back a fence marker split across deltas', () => {
    const chunker = new SentenceChunker();
    const sentences = drain(chunker, ['Conclusion first. ``', '`ask-response\n{"x":1}']);
    sentences.push(...chunker.flush());
    expect(sentences).toEqual(['Conclusion first.']);
  });

  it('flush returns an unterminated trailing fragment as its own sentence', () => {
    const chunker = new SentenceChunker();
    chunker.push('Stopped mid');
    expect(chunker.flush()).toEqual(['Stopped mid']);
    expect(chunker.flush()).toEqual([]);
  });
});
