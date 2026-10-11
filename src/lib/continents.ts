export type Continent =
  'asia' | 'europe' | 'africa' | 'north_america' | 'south_america' | 'oceania' | 'antarctica';

export const CONTINENT_LABEL: Record<Continent, string> = {
  asia: '아시아',
  europe: '유럽',
  africa: '아프리카',
  north_america: '북아메리카',
  south_america: '남아메리카',
  oceania: '오세아니아',
  antarctica: '남극',
};

const GROUPS: Record<Continent, string> = {
  asia: 'AE AF AM AZ BD BH BN BT CN CY GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE',
  europe:
    'AD AL AT BA BE BG BY CH CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK',
  africa:
    'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
  north_america: 'AG BB BS BZ CA CR CU DM DO GD GL GT HN HT JM KN LC MX NI PA PR SV TT US VC',
  south_america: 'AR BO BR CL CO EC FK GY PE PY SR UY VE',
  oceania: 'AU FJ FM KI MH NC NR NZ PG PF PW SB TO TV VU WS GU',
  antarctica: 'AQ TF',
};

const BY_CODE = new Map<string, Continent>(
  (Object.entries(GROUPS) as [Continent, string][]).flatMap(([c, codes]) =>
    codes.split(' ').map((code) => [code, c] as const),
  ),
);

/** Static country → continent table (SPEC C-7). `null` for codes we do not know. */
export const continentOf = (alpha2: string): Continent | null => BY_CODE.get(alpha2.toUpperCase()) ?? null;
