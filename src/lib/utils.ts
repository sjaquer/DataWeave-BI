import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the Levenshtein distance between two strings.
 * This is a measure of the difference between two sequences.
 * @param a The first string.
 * @param b The second string.
 * @returns The Levenshtein distance.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Finds the best match for a given province name from a list of canonical province names.
 * It uses Levenshtein distance to find the most similar string.
 * @param inputProvince The province name to match (potentially misspelled).
 * @param provinceList The canonical list of province names.
 * @param threshold The maximum allowed Levenshtein distance to be considered a match.
 * @returns The best matching province name from the list, or the original input if no good match is found.
 */
export function findBestProvinceMatch(
  inputProvince: string,
  provinceList: string[],
  threshold: number = 3
): string {
  if (!inputProvince) return inputProvince;

  const normalizedInput = inputProvince.trim().toLowerCase();
  
  // Direct match first
  for (const province of provinceList) {
    if (province.toLowerCase() === normalizedInput) {
      return province;
    }
  }

  let bestMatch: string = inputProvince;
  let minDistance = Infinity;

  for (const province of provinceList) {
    const distance = levenshteinDistance(normalizedInput, province.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = province;
    }
  }

  // Only return the match if it's within the similarity threshold
  return minDistance <= threshold ? bestMatch : inputProvince;
}
