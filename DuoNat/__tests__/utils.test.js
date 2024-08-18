import utils from '../code/utils.js';

// Mock the window.location and URLSearchParams
const mockLocation = new URL('https://example.com');
global.window = Object.create(window);
global.window.location = mockLocation;

describe('utils', () => {
  describe('url.getURLParameters', () => {
    it('returns correct parameters from URL', () => {
      mockLocation.search = '?taxon1=123&taxon2=456&tags=tag1,tag2&level=2&setID=789&ranges=NA,EU';
      const params = utils.url.getURLParameters();
      expect(params).toEqual({
        taxon1: '123',
        taxon2: '456',
        tags: 'tag1,tag2',
        level: '2',
        setID: '789',
        ranges: 'NA,EU'
      });
    });

    it('returns null for missing parameters', () => {
      mockLocation.search = '?taxon1=123';
      const params = utils.url.getURLParameters();
      expect(params).toEqual({
        taxon1: '123',
        taxon2: null,
        tags: null,
        level: null,
        setID: null,
        ranges: null
      });
    });
  });

  describe('ui.debounce', () => {
    jest.useFakeTimers();

    it('debounces function calls', () => {
      const func = jest.fn();
      const debouncedFunc = utils.ui.debounce(func, 1000);
      debouncedFunc();
      debouncedFunc();
      debouncedFunc();
      expect(func).not.toBeCalled();
      jest.runAllTimers();
      expect(func).toBeCalledTimes(1);
    });
  });

  describe('string.capitalizeFirstLetter', () => {
    it('capitalizes first letter of string', () => {
      expect(utils.string.capitalizeFirstLetter('hello')).toBe('Hello');
    });

    it('returns empty string for empty input', () => {
      expect(utils.string.capitalizeFirstLetter('')).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(utils.string.capitalizeFirstLetter()).toBe('');
    });
  });

  describe('string.shortenSpeciesName', () => {
    it('shortens species name correctly', () => {
      expect(utils.string.shortenSpeciesName('Homo sapiens')).toBe('H. sapiens');
    });

    it('returns original string if not a two-part name', () => {
      expect(utils.string.shortenSpeciesName('Homo')).toBe('Homo');
    });

    it('returns empty string for empty input', () => {
      expect(utils.string.shortenSpeciesName('')).toBe('');
    });
  });

  describe('array.arraysEqual', () => {
    it('returns true for equal arrays', () => {
      expect(utils.array.arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('returns false for unequal arrays', () => {
      expect(utils.array.arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('returns true for empty arrays', () => {
      expect(utils.array.arraysEqual([], [])).toBe(true);
    });

    it('returns false for arrays of different lengths', () => {
      expect(utils.array.arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });
  });
});
