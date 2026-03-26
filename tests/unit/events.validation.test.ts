import { describe, it, expect } from '@jest/globals';
import {
  createEventSchema,
  updateEventSchema,
  searchEventsSchema,
} from '../../src/modules/events/events.validation';

describe('events.validation', () => {
  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

  describe('createEventSchema.type', () => {
    it('rejects VIRTUAL', () => {
      const result = createEventSchema.safeParse({
        title: 'In-person fallback test',
        description: 'This is a valid event description.',
        startDate,
        endDate,
        type: 'VIRTUAL',
      });

      expect(result.success).toBe(false);
    });

    it('rejects HYBRID', () => {
      const result = createEventSchema.safeParse({
        title: 'Hybrid rejection test',
        description: 'This is a valid event description.',
        startDate,
        endDate,
        type: 'HYBRID',
      });

      expect(result.success).toBe(false);
    });

    it('allows IN_PERSON', () => {
      const result = createEventSchema.safeParse({
        title: 'In person allowed',
        description: 'This is a valid event description.',
        startDate,
        endDate,
        type: 'IN_PERSON',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateEventSchema.type', () => {
    it('rejects VIRTUAL', () => {
      const result = updateEventSchema.safeParse({
        type: 'VIRTUAL',
      });

      expect(result.success).toBe(false);
    });

    it('rejects HYBRID', () => {
      const result = updateEventSchema.safeParse({
        type: 'HYBRID',
      });

      expect(result.success).toBe(false);
    });

    it('allows IN_PERSON', () => {
      const result = updateEventSchema.safeParse({
        type: 'IN_PERSON',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('searchEventsSchema.type', () => {
    it('rejects VIRTUAL', () => {
      const result = searchEventsSchema.safeParse({
        type: 'VIRTUAL',
      });

      expect(result.success).toBe(false);
    });

    it('rejects HYBRID', () => {
      const result = searchEventsSchema.safeParse({
        type: 'HYBRID',
      });

      expect(result.success).toBe(false);
    });

    it('allows IN_PERSON', () => {
      const result = searchEventsSchema.safeParse({
        type: 'IN_PERSON',
      });

      expect(result.success).toBe(true);
    });
  });
});

