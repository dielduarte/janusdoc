import { describe, it, expect } from 'vitest';
import { parseRepo, formatComment } from './github.js';
import type { AnalysisResult } from '../types.js';

describe('github utilities', () => {
  describe('parseRepo', () => {
    it('parses owner/repo format correctly', () => {
      const result = parseRepo('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('handles complex repo names', () => {
      const result = parseRepo('my-org/my-complex-repo-name');
      expect(result).toEqual({ owner: 'my-org', repo: 'my-complex-repo-name' });
    });

    it('throws on invalid format', () => {
      expect(() => parseRepo('invalid')).toThrow('Invalid repository format');
      expect(() => parseRepo('')).toThrow('Invalid repository format');
    });
  });

  describe('formatComment', () => {
    it('returns empty string when no suggestions', () => {
      const result: AnalysisResult = {
        suggestions: [],
        summary: 'No updates needed',
      };

      expect(formatComment(result)).toBe('');
    });

    it('formats suggestions correctly', () => {
      const result: AnalysisResult = {
        summary: 'Found 1 document that may need updating.',
        suggestions: [
          {
            docPath: 'docs/api.md',
            reason: 'The API function signature changed',
            suggestedChanges: 'Update the parameter documentation',
            relatedCodeFiles: ['src/api.ts'],
          },
        ],
      };

      const comment = formatComment(result);

      expect(comment).toContain('## 📚 JanusDoc');
      expect(comment).toContain('docs/api.md');
      expect(comment).toContain('The API function signature changed');
      expect(comment).toContain('src/api.ts');
    });

    it('handles multiple suggestions', () => {
      const result: AnalysisResult = {
        summary: 'Found 2 documents that may need updating.',
        suggestions: [
          {
            docPath: 'docs/api.md',
            reason: 'API changed',
            suggestedChanges: 'Update API docs',
            relatedCodeFiles: ['src/api.ts'],
          },
          {
            docPath: 'docs/config.md',
            reason: 'Config options changed',
            suggestedChanges: 'Update config docs',
            relatedCodeFiles: ['src/config.ts'],
          },
        ],
      };

      const comment = formatComment(result);

      expect(comment).toContain('docs/api.md');
      expect(comment).toContain('docs/config.md');
    });
  });
});

