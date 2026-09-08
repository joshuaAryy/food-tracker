export function targetOverrideFieldsForProfileEdit(input: {
  caloriesChanged: boolean;
  proteinChanged: boolean;
}): Array<'calories' | 'protein'> {
  return [
    ...(input.caloriesChanged ? (['calories'] as const) : []),
    ...(input.proteinChanged ? (['protein'] as const) : []),
  ];
}
