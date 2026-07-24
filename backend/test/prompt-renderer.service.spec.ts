import { BadRequestException } from '@nestjs/common';
import { PromptRendererService } from '../src/modules/ai/prompts/prompt-renderer.service';

describe('PromptRendererService', () => {
  const renderer = new PromptRendererService();

  describe('extractReferences', () => {
    it('returns the distinct, valid variable names referenced', () => {
      const refs = renderer.extractReferences('Hi {{name}}, {{name}} — see {{ company }}.');
      expect(refs.sort()).toEqual(['company', 'name']);
    });

    it('ignores syntactically invalid placeholders', () => {
      expect(renderer.extractReferences('{{ not valid }} {{ok}}')).toEqual(['ok']);
    });
  });

  describe('validate', () => {
    it('accepts a template whose references are declared or built-in', () => {
      const result = renderer.validate('Dear {{customer_name}}, today is {{today}}.', [
        'customer_name',
      ]);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('flags a duplicate declaration', () => {
      const result = renderer.validate('{{a}}', ['a', 'a']);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Duplicate variable declaration');
    });

    it('flags invalid placeholder syntax', () => {
      const result = renderer.validate('Hello {{first name}}', []);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Invalid variable syntax');
    });

    it('flags an empty placeholder', () => {
      const result = renderer.validate('Hello {{}}', []);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Empty variable placeholder');
    });

    it('flags unbalanced braces', () => {
      const result = renderer.validate('Hello {{name}', ['name']);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Unbalanced');
    });

    it('flags a referenced variable that is neither declared nor built-in', () => {
      const result = renderer.validate('Hello {{mystery}}', []);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('referenced but not declared');
    });

    it('flags a declared-but-unused variable', () => {
      const result = renderer.validate('Hello {{a}}', ['a', 'b']);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('"b" is not used');
    });
  });

  describe('render', () => {
    it('substitutes each placeholder with its value', () => {
      const out = renderer.render('Dear {{name}}, welcome to {{org}}.', {
        name: 'Ada',
        org: 'Voltx',
      });
      expect(out).toBe('Dear Ada, welcome to Voltx.');
    });

    it('throws when a referenced variable has no value', () => {
      expect(() => renderer.render('Hi {{name}}', {})).toThrow(BadRequestException);
    });

    it('throws on invalid placeholder syntax rather than emitting it', () => {
      expect(() => renderer.render('Hi {{bad name}}', {})).toThrow(BadRequestException);
    });

    it('never re-expands or evaluates substituted values (no template injection)', () => {
      // A value that itself looks like a placeholder must be inserted
      // literally, not resolved against `values` a second time.
      const out = renderer.render('{{a}} and {{b}}', { a: '{{b}}', b: 'SAFE' });
      expect(out).toBe('{{b}} and SAFE');

      // A value that looks like a JS template expression is inert text.
      const evaluated = renderer.render('{{expr}}', { expr: '${7*7}' });
      expect(evaluated).toBe('${7*7}');
    });
  });
});
