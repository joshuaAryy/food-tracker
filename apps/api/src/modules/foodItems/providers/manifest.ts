export interface FoodDatasetManifest {
  provider: 'cnf' | 'ciqual' | 'cofid';
  release: string;
  sourceUrl: string;
  artifactSha256: string;
  companionArtifactSha256?: string;
  license: string;
  notes: string;
}

/** Pinned official artifacts; imports must reject checksum changes. */
export const FOOD_DATASET_MANIFESTS: readonly FoodDatasetManifest[] = [
  {
    provider: 'cnf',
    release: '2026',
    sourceUrl:
      'https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/019f2a90-e3a9-489d-b6e1-f74f4ba1d006/download/cnf_fcen_all-files-data_2026.zip',
    artifactSha256:
      'f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd',
    license: 'Open Government Licence - Canada',
    notes: 'Health Canada Canadian Nutrient File relational CSV bundle.',
  },
  {
    provider: 'ciqual',
    release: '2025',
    sourceUrl: 'https://ciqual.anses.fr/',
    artifactSha256:
      '2c3495c8136d17356c50db410918da2102cb28096cb497c9cdf83c5f8ecb10ba',
    companionArtifactSha256:
      'e0b1de25b3039028205e9d54a96892e403e1b313c2efeb41180fabe132627478',
    license: 'Etalab Open Licence',
    notes:
      'Official composition XLSX joined with alim_2025_11_03.xml metadata.',
  },
  {
    provider: 'cofid',
    release: '2021',
    sourceUrl:
      'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
    artifactSha256:
      '436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d',
    license: 'UK Government publication terms',
    notes:
      'McCance and Widdowson CoFID 2021 workbook; old-food sheet excluded.',
  },
];

export function manifestFor(
  provider: FoodDatasetManifest['provider'],
  release: string,
): FoodDatasetManifest {
  const manifest = FOOD_DATASET_MANIFESTS.find(
    (entry) => entry.provider === provider && entry.release === release,
  );
  if (manifest === undefined)
    throw new Error(`No pinned dataset manifest for ${provider} ${release}`);
  return manifest;
}
