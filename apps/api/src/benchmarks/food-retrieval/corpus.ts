import {
  FOOD_RETRIEVAL_BENCHMARK_VERSION,
  type BenchmarkQueryClass,
  type BenchmarkQueryTag,
  type FoodRetrievalBenchmarkQuery,
} from './types.js';

type QueryDefinition = readonly [query: string, canonicalName: string];

const exact: readonly QueryDefinition[] = [
  ['banana', 'Banana'],
  ['apple', 'Apple'],
  ['orange', 'Orange'],
  ['pear', 'Pear'],
  ['mango', 'Mango'],
  ['avocado', 'Avocado'],
  ['tomato', 'Tomato'],
  ['cucumber', 'Cucumber'],
  ['carrot', 'Carrot'],
  ['broccoli', 'Broccoli'],
  ['spinach', 'Spinach'],
  ['potato', 'Potato'],
  ['rice', 'Rice'],
  ['oats', 'Oats'],
  ['quinoa', 'Quinoa'],
  ['lentils', 'Lentils'],
  ['chickpeas', 'Chickpeas'],
  ['black beans', 'Black beans'],
  ['salmon', 'Salmon'],
  ['tuna', 'Tuna'],
  ['chicken breast', 'Chicken breast'],
  ['beef steak', 'Beef steak'],
  ['whole milk', 'Whole milk'],
  ['plain yogurt', 'Plain yogurt'],
];

const preparation: readonly QueryDefinition[] = [
  ['baked sweet potato', 'Sweet potato, baked'],
  ['boiled potato', 'Potato, boiled'],
  ['cooked white rice', 'White rice, cooked'],
  ['brown rice cooked', 'Brown rice, cooked'],
  ['scrambled eggs', 'Egg, scrambled'],
  ['hard boiled egg', 'Egg, hard-boiled'],
  ['grilled chicken breast', 'Chicken breast, grilled'],
  ['roasted chicken thigh', 'Chicken thigh, roasted'],
  ['baked salmon', 'Salmon, baked'],
  ['grilled salmon', 'Salmon, grilled'],
  ['steamed broccoli', 'Broccoli, steamed'],
  ['roasted carrots', 'Carrots, roasted'],
  ['raw spinach', 'Spinach, raw'],
  ['cooked oatmeal', 'Oatmeal, cooked'],
  ['plain greek yogurt', 'Greek yogurt, plain'],
  ['low fat milk', 'Milk, low fat'],
  ['unsweetened almond milk', 'Almond milk, unsweetened'],
  ['whole wheat bread toasted', 'Whole wheat bread, toasted'],
  ['white bread toasted', 'White bread, toasted'],
  ['canned tuna in water', 'Tuna, canned in water'],
  ['dry lentils', 'Lentils, dry'],
  ['cooked chickpeas', 'Chickpeas, cooked'],
  ['frozen blueberries', 'Blueberries, frozen'],
  ['diced tomatoes canned', 'Tomatoes, canned, diced'],
];

const branded: readonly QueryDefinition[] = [
  ['Chobani plain greek yogurt', 'Plain Greek Yogurt'],
  ['Oikos triple zero vanilla', 'Triple Zero Vanilla Yogurt'],
  ['Fage 0 percent yogurt', 'Fage 0% Greek Yogurt'],
  ['Kirkland almond milk', 'Kirkland Almond Beverage'],
  ['Silk unsweetened almond milk', 'Silk Unsweetened Almond Milk'],
  ['Fairlife 2 percent milk', 'Fairlife 2% Milk'],
  ['Daisy sour cream', 'Daisy Sour Cream'],
  ['Philadelphia cream cheese', 'Philadelphia Cream Cheese'],
  ['Kraft mac and cheese', 'Kraft Macaroni and Cheese'],
  ['Barilla penne', 'Barilla Penne'],
  ['Quaker old fashioned oats', 'Quaker Old Fashioned Oats'],
  ['Cheerios original', 'Cheerios Original'],
  ['Kind dark chocolate nuts bar', 'Kind Dark Chocolate Nuts Bar'],
  ['Clif chocolate chip bar', 'Clif Chocolate Chip Bar'],
  ['RXBAR chocolate sea salt', 'RXBAR Chocolate Sea Salt'],
  ['Quest protein bar cookies cream', 'Quest Cookies and Cream Protein Bar'],
  ['Jif creamy peanut butter', 'Jif Creamy Peanut Butter'],
  ['Skippy natural peanut butter', 'Skippy Natural Peanut Butter'],
  ['Hershey milk chocolate', 'Hershey Milk Chocolate'],
  ['Nutella hazelnut spread', 'Nutella Hazelnut Spread'],
  ['Gatorade zero orange', 'Gatorade Zero Orange'],
  ['Coca Cola zero sugar', 'Coca-Cola Zero Sugar'],
  ['LaCroix lime sparkling water', 'LaCroix Lime Sparkling Water'],
  ['Starbucks cold brew black', 'Starbucks Cold Brew Black'],
];

const semantic: readonly QueryDefinition[] = [
  ['brekkie eggs', 'Egg, whole'],
  ['morning porridge', 'Oatmeal, cooked'],
  ['orange fish fillet', 'Salmon'],
  ['bird breast meat', 'Chicken breast'],
  ['cow milk drink', 'Whole milk'],
  ['bean dip mashed chickpeas', 'Hummus'],
  ['potato fries air fried', 'French fries, air-fried'],
  ['noodle soup broth', 'Chicken noodle soup'],
  ['breakfast cereal rings', 'Cheerios'],
  ['nut spread sandwich filling', 'Peanut butter'],
  ['fermented cabbage side', 'Sauerkraut'],
  ['post workout protein drink', 'Protein shake'],
  ['sweet frozen fruit dessert', 'Fruit sorbet'],
  ['dark leafy vegetable iron', 'Spinach'],
  ['white fish mild fillet', 'Cod'],
  ['red meat burger patty', 'Beef burger'],
  ['creamy cultured breakfast', 'Greek yogurt'],
];

const normal: readonly QueryDefinition[] = [
  ['rice noodles', 'Rice noodles'],
  ['egg sandwich', 'Egg sandwich'],
  ['peanut butter cookies', 'Peanut butter cookies'],
  ['banana pudding', 'Banana pudding'],
  ['oat milk latte', 'Oat milk latte'],
  ['chicken caesar salad', 'Chicken Caesar salad'],
  ['turkey sandwich', 'Turkey sandwich'],
  ['beef tacos', 'Beef tacos'],
  ['vegetable soup', 'Vegetable soup'],
  ['lentil curry', 'Lentil curry'],
  ['chickpea salad', 'Chickpea salad'],
  ['black bean burrito', 'Black bean burrito'],
  ['salmon sushi roll', 'Salmon sushi roll'],
  ['tuna salad', 'Tuna salad'],
  ['chicken fried rice', 'Chicken fried rice'],
  ['beef stew', 'Beef stew'],
  ['fruit salad', 'Fruit salad'],
  ['berry smoothie', 'Berry smoothie'],
  ['greek yogurt parfait', 'Greek yogurt parfait'],
  ['whole wheat pancakes', 'Whole wheat pancakes'],
  ['avocado toast', 'Avocado toast'],
  ['tomato pasta', 'Tomato pasta'],
  ['roasted vegetable bowl', 'Roasted vegetable bowl'],
  ['protein oatmeal', 'Protein oatmeal'],
  ['greek yogrt', 'Greek yogurt, plain'],
  ['chiken breast', 'Chicken breast'],
  ['bananna', 'Banana'],
  ['pb sandwich', 'Peanut butter sandwich'],
  ['timmies iced capp', 'Iced Capp'],
  ['poutine', 'Poutine'],
  ['3017620422003', 'Nutella hazelnut spread'],
];

function definitionsFor(
  queryClass: BenchmarkQueryClass,
  definitions: readonly QueryDefinition[],
): QueryDefinition[] {
  return definitions.map(([query, canonicalName]) => [query, canonicalName]);
}

const definitions = [
  ...definitionsFor('exact', exact),
  ...definitionsFor('preparation', preparation),
  ...definitionsFor('branded', branded),
  ...definitionsFor('semantic', semantic),
  ...definitionsFor('normal', normal),
];

const SPECIAL_TAGS: Readonly<Record<string, readonly BenchmarkQueryTag[]>> = {
  'greek yogrt': ['misspelling', 'messy_fragment'],
  'chiken breast': ['misspelling'],
  bananna: ['misspelling'],
  'pb sandwich': ['abbreviation', 'messy_fragment'],
  'timmies iced capp': ['regional_terminology', 'messy_fragment'],
  poutine: ['regional_terminology'],
  '3017620422003': ['barcode'],
  rice: ['ambiguous'],
  'whole milk': ['ambiguous'],
  'avocado toast': ['ambiguous'],
};

function baseTag(queryClass: BenchmarkQueryClass): BenchmarkQueryTag {
  switch (queryClass) {
    case 'exact':
      return 'exact_generic';
    case 'branded':
      return 'exact_branded';
    case 'preparation':
      return 'preparation_form';
    case 'semantic':
      return 'semantic_descriptive';
    case 'normal':
      return 'compound';
  }
}

export const FOOD_RETRIEVAL_CORPUS: readonly FoodRetrievalBenchmarkQuery[] =
  definitions
    .map(([query, canonicalName], index) => {
      const queryClass: BenchmarkQueryClass =
        index < exact.length
          ? 'exact'
          : index < exact.length + preparation.length
            ? 'preparation'
            : index < exact.length + preparation.length + branded.length
              ? 'branded'
              : index <
                  exact.length +
                    preparation.length +
                    branded.length +
                    semantic.length
                ? 'semantic'
                : 'normal';
      const tags = [baseTag(queryClass), ...(SPECIAL_TAGS[query] ?? [])].filter(
        (tag, tagIndex, all) => all.indexOf(tag) === tagIndex,
      );
      return {
        id: `${queryClass}-${String(index + 1).padStart(3, '0')}`,
        query: query.trim(),
        split: index < 80 ? 'development' : 'holdout',
        queryClass,
        tags,
        gold: {
          canonicalName,
          expectedProvider:
            queryClass === 'branded' || tags.includes('barcode')
              ? 'open_food_facts'
              : 'usda_fdc',
          ...(tags.includes('barcode')
            ? { expectedSourceId: query.trim() }
            : {}),
        },
        normalSearch: queryClass === 'normal',
        requiresSafeDefault: queryClass !== 'semantic',
      } satisfies FoodRetrievalBenchmarkQuery;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

export { FOOD_RETRIEVAL_BENCHMARK_VERSION };
