import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  type ClassificationMappingRecord,
  filterMappings,
  findMappingsForCategory,
  serializeMappingsToCsv,
  serializeMappingsToJson,
  summarizeMappings,
} from './classificationEngine';

const SAMPLE_MAPPINGS: ClassificationMappingRecord[] = [
  {
    mapping_id: 'M1',
    source_system: 'OpenFoodFacts',
    source_code: 'OFF:Plant-Based Meat & Burger Alternatives',
    source_label: 'Plant-Based Meat & Burger Alternatives',
    source_parent_label: 'OFF Catalog',
    source_item_count: 378,
    target_system: 'FoodEx2',
    target_code: 'A03TD',
    target_label: 'Plant-based meat analogues (extruded)',
    mapping_type: 'exact',
    hierarchy_direction: 'equivalent',
    confidence_tier: 'high',
    is_ambiguous: false,
    is_unmatched: false,
    candidate_targets: null,
    representative_agb_code: '25591',
    rationale: 'Direct 1:1 correspondence for plant-based meat analogues.',
    source_reference: 'EFSA FoodEx2; OFF',
    mapping_version: '3.0.0-phase3a',
  },
  {
    mapping_id: 'M2',
    source_system: 'Agribalyse',
    source_code: 'AGB:viandes, œufs, poissons/viandes crues',
    source_label: 'viandes crues (viandes, œufs, poissons)',
    source_parent_label: 'viandes, œufs, poissons',
    source_item_count: 135,
    target_system: 'FoodEx2',
    target_code: 'A01QX',
    target_label: 'Bovine & ovine ruminant red meat',
    mapping_type: 'ambiguous',
    hierarchy_direction: null,
    confidence_tier: 'low',
    is_ambiguous: true,
    is_unmatched: false,
    candidate_targets: 'A01QX (Ruminant); A01RG (Pork/poultry)',
    representative_agb_code: '6111',
    rationale: 'Merges beef, lamb, pork, and "poultry" cuts.',
    source_reference: 'ADEME Agribalyse 3.1.1; EFSA FoodEx2',
    mapping_version: '3.0.0-phase3a',
  },
  {
    mapping_id: 'M3',
    source_system: 'COICOP',
    source_code: 'CP0115',
    source_label: '01.1.5 Oils and fats',
    source_parent_label: 'CP01 Food',
    source_item_count: 1,
    target_system: 'FoodEx2',
    target_code: null,
    target_label: null,
    mapping_type: 'unmatched',
    hierarchy_direction: null,
    confidence_tier: 'unmatched',
    is_ambiguous: false,
    is_unmatched: true,
    candidate_targets: null,
    representative_agb_code: null,
    rationale: 'No matching FoodEx2 oils/fats group ingested in efsa_foodex2_surveys.',
    source_reference: 'Eurostat COICOP 2018',
    mapping_version: '3.0.0-phase3a',
  },
];

describe('classificationEngine (Phase 3A)', () => {
  it('filters cleanly by taxonomy, mapping type, ambiguous/unmatched flags, and search query', () => {
    expect(filterMappings(SAMPLE_MAPPINGS, { sourceSystem: 'Agribalyse' })).toHaveLength(1);
    expect(filterMappings(SAMPLE_MAPPINGS, { onlyAmbiguous: true }).map((r) => r.mapping_id)).toEqual(['M2']);
    expect(filterMappings(SAMPLE_MAPPINGS, { onlyUnmatched: true }).map((r) => r.mapping_id)).toEqual(['M3']);
    expect(filterMappings(SAMPLE_MAPPINGS, { mappingTypes: ['exact', 'unmatched'] })).toHaveLength(2);
    expect(filterMappings(SAMPLE_MAPPINGS, { searchQuery: 'CP0115' }).map((r) => r.mapping_id)).toEqual(['M3']);
  });

  it('computes traceable summary metrics without dropping unmatched records', () => {
    const res = summarizeMappings(SAMPLE_MAPPINGS);
    expect(res.data.totalRules).toBe(3);
    expect(res.data.totalSourceItemsCovered).toBe(514);
    expect(res.data.byMappingType.exact).toBe(1);
    expect(res.data.byMappingType.ambiguous).toBe(1);
    expect(res.data.byMappingType.unmatched).toBe(1);
    expect(res.missingness.includedRecords).toBe(2);
    expect(res.missingness.missingOrExcludedRecords).toBe(1);
    expect(res.provenance.dataNature).toBe('Manually Compiled');
  });

  it('supports bidirectional lookup for category inspection', () => {
    const foodexHits = findMappingsForCategory(SAMPLE_MAPPINGS, 'FoodEx2', 'A01RG');
    expect(foodexHits.map((r) => r.mapping_id)).toEqual(['M2']);
  });

  it('serializes valid CSV (RFC-4180 quotes) and JSON provenance envelopes', () => {
    const csv = serializeMappingsToCsv(SAMPLE_MAPPINGS);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('mapping_id,source_system,source_code');
    expect(csv).toContain('"Merges beef, lamb, pork, and ""poultry"" cuts."');

    const parsed = JSON.parse(serializeMappingsToJson(SAMPLE_MAPPINGS, { onlyUnmatched: false }));
    expect(parsed.schema_version).toBe('3.0.0-phase3a');
    expect(parsed.summary.totalRules).toBe(3);
    expect(parsed.records).toHaveLength(3);
  });

  it('passes curated known-good and known-bad classification regression checks against live dataset', () => {
    const mapPath = path.resolve(process.cwd(), 'public/data/classification_mappings.json');
    const live = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as ClassificationMappingRecord[];
    const byId = new Map(live.map((r) => [r.mapping_id, r]));

    // Known-good strict exact equivalences
    expect(byId.get('MAP_AGB_FOODEX2_27')?.mapping_type).toBe('exact'); // légumineuses <-> A011X
    expect(byId.get('MAP_OFF_FOODEX2_07')?.mapping_type).toBe('exact'); // Plant-Based Meat <-> A03TD

    // Known-bad exact inflation prevented (label overlap without full scope parity)
    expect(byId.get('MAP_AGB_COICOP_24')?.mapping_type).toBe('hierarchical'); // fruits excludes tree nuts in 01.1.6
    expect(byId.get('MAP_AGB_FOODEX2_24')?.mapping_type).toBe('hierarchical'); // AGB fruits includes canned/dried vs A01BS fresh
    expect(byId.get('MAP_OFF_COICOP_11')?.mapping_type).toBe('hierarchical'); // Whole grains narrower than CP0111 bakery

    // Known ambiguous & known unmatched preservation
    const rawMeatFx = live.find(
      (r) => r.source_code.endsWith('/viandes crues') && r.target_system === 'FoodEx2'
    );
    expect(rawMeatFx?.mapping_type).toBe('ambiguous');
    expect(byId.get('MAP_COICOP_FOODEX2_UNMATCHED_01')?.mapping_type).toBe('unmatched');
    expect(byId.get('MAP_COICOP_FOODEX2_UNMATCHED_01')?.target_code).toBeNull();
  });
});
