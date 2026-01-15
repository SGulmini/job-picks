/**
 * TEST SUITE: Job Matching Pipeline
 * 
 * This test suite validates that the job matching system correctly handles:
 * 1. Query expansion with synonyms
 * 2. Location normalization
 * 3. Fuzzy/partial matching
 * 4. Fallback mechanisms
 * 
 * Run with: npm test or jest
 */

// Note: In a real setup, extract these to a utils file for easier testing
// For now, we'll test the logic inline

// Import types and test the exported functions
// Since these are in the same file, we test them directly

// Mock the functions we need to test
// Note: In a real setup, you'd extract these to a separate utils file

describe('Job Matching Pipeline Tests', () => {
  
  // ============================================================================
  // TEST 1: CRM + Milano Query (Main Bug Case)
  // ============================================================================
  test('Test 1: "crm" should match "CRM Manager", "CRM Specialist", "Customer Relationship Management"', () => {
    const testCases = [
      { role: "crm", title: "CRM Manager", expected: { matches: true, minScore: 180 } },
      { role: "crm", title: "CRM Specialist", expected: { matches: true, minScore: 180 } },
      { role: "crm", title: "Customer Relationship Management Manager", expected: { matches: true, minScore: 160 } },
      { role: "crm", title: "Senior CRM Manager", expected: { matches: true, minScore: 190 } },
      { role: "crm", title: "Crm e Marketing Automation", expected: { matches: true, minScore: 160 } },
      { role: "crm", title: "Software Engineer", expected: { matches: false } }, // Should not match
    ];

    testCases.forEach(({ role, title, expected }) => {
      const result = roleMatchesTitle(role, title);
      expect(result.matches).toBe(expected.matches);
      if (expected.matches && expected.minScore) {
        expect(result.score).toBeGreaterThanOrEqual(expected.minScore);
      }
    });
  });

  // ============================================================================
  // TEST 2: Location Normalization - Milano
  // ============================================================================
  test('Test 2: "Milano" should normalize to "Milan" and match location variants', () => {
    // Test normalization
    expect(normalizeCityForAdzuna("Milano")).toBe("Milan");
    expect(normalizeCityForAdzuna("milano")).toBe("Milan");
    expect(normalizeCityForAdzuna("MILANO")).toBe("Milan");

    // Test location variants
    const variants = getLocationVariants("Milano");
    expect(variants).toContain("milano");
    expect(variants).toContain("milan");
    expect(variants).toContain("lombardia");
    expect(variants).toContain("lombardy");

    // Test location matching
    expect(locationMatches("Milan, Italy", variants)).toBe(true);
    expect(locationMatches("Milano (MI)", variants)).toBe(true);
    expect(locationMatches("Lombardia, Italy", variants)).toBe(true);
    expect(locationMatches("Hybrid Milan", variants)).toBe(true);
    expect(locationMatches("Remote", variants)).toBe(false);
  });

  // ============================================================================
  // TEST 3: Query Expansion with Synonyms
  // ============================================================================
  test('Test 3: Query expansion should include synonyms for common acronyms', () => {
    const testCases = [
      { input: "crm", expectedSynonyms: ["customer relationship management", "crm manager"] },
      { input: "hr", expectedSynonyms: ["human resources", "hr manager"] },
      { input: "it", expectedSynonyms: ["information technology", "it specialist"] },
      { input: "qa", expectedSynonyms: ["quality assurance", "qa engineer"] },
      { input: "pm", expectedSynonyms: ["product manager", "project manager"] },
    ];

    testCases.forEach(({ input, expectedSynonyms }) => {
      const expansions = expandQuery(input);
      expect(expansions).toContain(input); // Original should be included
      expectedSynonyms.forEach(synonym => {
        expect(expansions.some(e => e.toLowerCase().includes(synonym.toLowerCase()))).toBe(true);
      });
    });
  });

  // ============================================================================
  // TEST 4: Text Normalization and Tokenization
  // ============================================================================
  test('Test 4: Text normalization should handle case, special chars, and whitespace', () => {
    expect(normalizeText("CRM Manager")).toBe("crm manager");
    expect(normalizeText("CRM-Manager")).toBe("crm manager");
    expect(normalizeText("CRM   Manager")).toBe("crm manager");
    expect(normalizeText("CRM (Manager)")).toBe("crm manager");
    expect(normalizeText("Customer Relationship Management")).toBe("customer relationship management");

    const tokens1 = tokenize("CRM Manager");
    expect(tokens1.has("crm")).toBe(true);
    expect(tokens1.has("manager")).toBe(true);

    const tokens2 = tokenize("Customer Relationship Management");
    expect(tokens2.has("customer")).toBe(true);
    expect(tokens2.has("relationship")).toBe(true);
    expect(tokens2.has("management")).toBe(true);
  });

  // ============================================================================
  // TEST 5: Multi-word Role Matching
  // ============================================================================
  test('Test 5: Multi-word roles should match with partial token matching', () => {
    const testCases = [
      { role: "data analyst", title: "Data Analyst", expected: { matches: true, minScore: 200 } },
      { role: "data analyst", title: "Senior Data Analyst", expected: { matches: true, minScore: 190 } },
      { role: "data analyst", title: "Data Analyst - Marketing", expected: { matches: true, minScore: 200 } },
      { role: "product manager", title: "Product Manager", expected: { matches: true, minScore: 200 } },
      { role: "product manager", title: "Senior Product Manager", expected: { matches: true, minScore: 190 } },
      { role: "software engineer", title: "Software Engineer", expected: { matches: true, minScore: 200 } },
    ];

    testCases.forEach(({ role, title, expected }) => {
      const result = roleMatchesTitle(role, title);
      expect(result.matches).toBe(expected.matches);
      if (expected.matches && expected.minScore) {
        expect(result.score).toBeGreaterThanOrEqual(expected.minScore);
      }
    });
  });

  // ============================================================================
  // TEST 6: Edge Cases and Special Characters
  // ============================================================================
  test('Test 6: Edge cases - empty strings, special chars, case variations', () => {
    // Empty role should not match
    expect(roleMatchesTitle("", "CRM Manager").matches).toBe(false);

    // Case variations should match
    expect(roleMatchesTitle("CRM", "crm manager").matches).toBe(true);
    expect(roleMatchesTitle("crm", "CRM Manager").matches).toBe(true);
    expect(roleMatchesTitle("Crm", "CRM Manager").matches).toBe(true);

    // Special characters in titles
    expect(roleMatchesTitle("crm", "CRM-Manager").matches).toBe(true);
    expect(roleMatchesTitle("crm", "CRM (Manager)").matches).toBe(true);
    expect(roleMatchesTitle("crm", "CRM/Manager").matches).toBe(true);
  });

  // ============================================================================
  // TEST 7: Location Matching with Variations
  // ============================================================================
  test('Test 7: Location matching should handle various formats', () => {
    const milanoVariants = getLocationVariants("Milano");
    
    const locationTests = [
      { location: "Milan, Italy", expected: true },
      { location: "Milano (MI)", expected: true },
      { location: "Lombardia, Italy", expected: true },
      { location: "Hybrid Milan", expected: true },
      { location: "Milan - Remote", expected: true },
      { location: "Rome, Italy", expected: false },
      { location: "Remote", expected: false },
    ];

    locationTests.forEach(({ location, expected }) => {
      expect(locationMatches(location, milanoVariants)).toBe(expected);
    });
  });

  // ============================================================================
  // TEST 8: Synonym Dictionary Coverage
  // ============================================================================
  test('Test 8: All common acronyms should have synonyms', () => {
    const acronyms = ["crm", "hr", "it", "qa", "pm", "ui", "ux", "dev", "seo"];
    
    acronyms.forEach(acronym => {
      const expansions = expandQuery(acronym);
      expect(expansions.length).toBeGreaterThan(1); // Should have at least original + synonyms
      expect(expansions).toContain(acronym); // Original should be included
    });
  });

  // ============================================================================
  // TEST 9: Italian City Normalization
  // ============================================================================
  test('Test 9: All major Italian cities should normalize correctly', () => {
    const cityTests = [
      { input: "Milano", expected: "Milan" },
      { input: "Roma", expected: "Rome" },
      { input: "Napoli", expected: "Naples" },
      { input: "Torino", expected: "Turin" },
      { input: "Firenze", expected: "Florence" },
      { input: "Genova", expected: "Genoa" },
      { input: "Bologna", expected: "Bologna" }, // Same in English
      { input: "Venezia", expected: "Venice" },
    ];

    cityTests.forEach(({ input, expected }) => {
      expect(normalizeCityForAdzuna(input)).toBe(expected);
    });
  });

  // ============================================================================
  // TEST 10: Integration Test - Full Pipeline
  // ============================================================================
  test('Test 10: Full pipeline test - CRM + Milano should return results', async () => {
    // This is a mock test - in real scenario, you'd mock the Adzuna API
    // For now, we test that the query expansion and normalization work
    
    const roles = ["crm"];
    const city = "Milano";
    
    // Test query expansion
    const expandedQuery = expandQuery(roles[0]);
    expect(expandedQuery.length).toBeGreaterThan(1);
    expect(expandedQuery.some(q => q.toLowerCase().includes("customer relationship"))).toBe(true);
    
    // Test city normalization
    const normalizedCity = normalizeCityForAdzuna(city);
    expect(normalizedCity).toBe("Milan");
    
    // Test location variants
    const variants = getLocationVariants(city);
    expect(variants.length).toBeGreaterThan(3); // Should have multiple variants
    
    // Test that a sample job would match
    const sampleJobs = [
      { title: "CRM Manager", location: "Milan, Italy" },
      { title: "CRM Specialist", location: "Milano (MI)" },
      { title: "Customer Relationship Management Manager", location: "Lombardia, Italy" },
    ];
    
    sampleJobs.forEach(job => {
      const roleMatch = roleMatchesTitle("crm", job.title);
      expect(roleMatch.matches).toBe(true);
      
      const locationMatch = locationMatches(job.location, variants);
      expect(locationMatch).toBe(true);
    });
  });
});

// Export test utilities for use in other tests
export {
  expandQuery,
  normalizeCityForAdzuna,
  getLocationVariants,
  roleMatchesTitle,
  locationMatches,
  normalizeText,
  tokenize,
};
